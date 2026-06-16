//! Stage 4 — walk the parsed template + classified bindings, driving the
//! emitter. Content node-holes recurse: a nested `` tpl`...` `` is lowered to an
//! inline IIFE builder spliced into the directive's argument, so `repeat`
//! becomes `_list` and `when`/`choose`/ternaries become `_child`.

use crate::emit::Emitter;
use crate::grammar::{classify, BindingKind};
use crate::lower::{
    find_html_spans, slice, split_call_args, split_commas, split_template_literal, split_ternary,
};
use crate::template::node::NodePath;
use crate::template::parse::parse;
use std::collections::HashMap;

/// Per-run state: globally-unique counters, the accumulated module-scope
/// `template(...)` declarations, and a markup→id cache so identical templates
/// (e.g. a helper embedded twice) share one `template()` const.
#[derive(Default)]
struct Ctx {
    tpls: usize,
    vars: usize,
    decls: String,
    seen: HashMap<String, String>,
}

impl Ctx {
    fn tpl(&mut self) -> String {
        let id = format!("_t{}", self.tpls);
        self.tpls += 1;
        id
    }

    fn var(&mut self, prefix: &str) -> String {
        let v = format!("_{prefix}{}", self.vars);
        self.vars += 1;
        v
    }
}

/// Generated source for one template: hoistable module-scope `template(...)`
/// declarations and the `view()` body.
pub struct Generated {
    pub decls: String,
    pub body: String,
}

/// Generate the `decls` + `view()` body for one top-level template.
pub fn generate(statics: &[String], holes: &[String], emitter: &dyn Emitter) -> Generated {
    let mut ctx = Ctx::default();
    let body = gen_template(statics, holes, &mut ctx, emitter, false);
    Generated {
        decls: ctx.decls,
        body,
    }
}

/// Generate `view()` bodies for several templates sharing ONE module scope:
/// the hoisted `template(...)` consts are numbered uniquely + deduped across all
/// of them, returned once, alongside each template's body. This is what lets a
/// file hold multiple components without their `_tN` consts colliding.
pub fn generate_all(
    templates: &[(Vec<String>, Vec<String>)],
    emitter: &dyn Emitter,
) -> (String, Vec<String>) {
    let mut ctx = Ctx::default();
    let bodies = templates
        .iter()
        .map(|(statics, holes)| gen_template(statics, holes, &mut ctx, emitter, false))
        .collect();
    (ctx.decls, bodies)
}

/// Generate the source for one top-level template: the module-scope
/// `template(...)` consts followed by the `view()` body.
pub fn codegen(statics: &[String], holes: &[String], emitter: &dyn Emitter) -> String {
    let g = generate(statics, holes, emitter);
    format!("{}{}", g.decls, g.body)
}

/// Generate one template body. `builder` switches the return between the whole
/// fragment (a view) and its first node (an embedded builder).
fn gen_template(
    statics: &[String],
    holes: &[String],
    ctx: &mut Ctx,
    emitter: &dyn Emitter,
    builder: bool,
) -> String {
    let parsed = parse(statics, holes);
    let bindings: Vec<_> = parsed.holes.iter().map(classify).collect();

    let tpl = match ctx.seen.get(&parsed.markup) {
        Some(id) => id.clone(),
        None => {
            let id = ctx.tpl();
            ctx.decls
                .push_str(&emitter.template_decl(&id, &parsed.markup));
            ctx.decls.push('\n');
            ctx.seen.insert(parsed.markup.clone(), id.clone());
            id
        }
    };

    let root = ctx.var("r");
    let mut lines = vec![emitter.clone_root(&root, &tpl)];
    let mut grabbed: Vec<(NodePath, String)> = Vec::new();

    // Phase 1: grab every binding's node WHILE THE CLONE IS PRISTINE. Bindings
    // that insert nodes (_child/_list/splice) shift sibling indices, so all
    // node references must be captured before any binding runs.
    let nodes: Vec<String> = bindings
        .iter()
        .map(|b| grab(ctx, emitter, &root, &b.path, &mut grabbed, &mut lines))
        .collect();

    // Phase 2: emit the bindings against the pre-grabbed vars. Value writes
    // (text/attr/class/style/prop) are collected into `group` and wrapped in ONE
    // effect per template instance, so a row costs a single Scope/Set rather than
    // one per binding. Their one-time setup (text anchors, class-initial capture)
    // stays inline; structural (list/child) and wiring (event/model/…) emit as-is.
    // Phase 2a — CSE: a pure member read (`a.b`, `this.x.y`) appearing in more
    // than one grouped value binding is otherwise read — and thus tracked — once
    // per occurrence. Hoist it to a single const at the top of the effect so the
    // row subscribes to that signal once. Only side-effect-free member chains
    // qualify; structural/event bindings are excluded and keep their raw expr.
    let mut cse: HashMap<String, String> = HashMap::new();
    let mut hoists: Vec<String> = Vec::new();
    {
        let mut counts: HashMap<&str, usize> = HashMap::new();
        for b in &bindings {
            if is_grouped(&b.kind) && is_simple_read(b.expr.trim()) {
                *counts.entry(b.expr.trim()).or_insert(0) += 1;
            }
        }
        for b in &bindings {
            if !is_grouped(&b.kind) {
                continue;
            }
            let e = b.expr.trim();
            if counts.get(e).copied().unwrap_or(0) >= 2 && !cse.contains_key(e) {
                let v = ctx.var("v");
                hoists.push(emitter.local(&v, e));
                cse.insert(e.to_string(), v);
            }
        }
    }

    let mut group: Vec<String> = hoists;
    for (b, node) in bindings.iter().zip(&nodes) {
        let name = b.name.as_deref().unwrap_or("");
        // grouped value writes use the hoisted var when their read was CSE'd
        let g = cse
            .get(b.expr.trim())
            .map(String::as_str)
            .unwrap_or(b.expr.as_str());
        match b.kind {
            BindingKind::Splice => {
                lines.push(emitter.pending("Splice content binding — symbol resolution pending"))
            }
            BindingKind::List => lines.push(lower_list(&b.expr, node, ctx, emitter)),
            BindingKind::Child => lines.extend(lower_child(&b.expr, node, ctx, emitter)),
            BindingKind::Text if b.baked => group.push(emitter.set_text(node, g)),
            BindingKind::Text => {
                let tnode = ctx.var("x");
                lines.push(emitter.text_anchor(&tnode, node));
                group.push(emitter.set_text(&tnode, g));
            }
            BindingKind::Attr => group.push(emitter.set_attr(node, name, g)),
            // A class binding fully absorbs any static class into its expression
            // (`class="a ${x}"` → one dynamic value), so the initial base is always
            // empty — no need to read it back off the DOM.
            BindingKind::Class => group.push(emitter.set_class(node, "''", g)),
            BindingKind::Style => group.push(emitter.set_style(node, g)),
            BindingKind::Prop => group.push(emitter.set_prop(node, name, g)),
            BindingKind::Event => lines.push(emitter.event(node, name, &b.expr)),
            BindingKind::Model => lines.push(emitter.model(node, &b.expr)),
            BindingKind::OnModel => lines.push(emitter.onmodel(node, &b.expr)),
            BindingKind::Ref => lines.push(emitter.reference(node, &b.expr)),
        }
    }

    if !group.is_empty() {
        lines.push(emitter.bind_group(&group));
    }

    lines.push(emitter.ret(&root, builder));
    let mut body = lines.join("\n");
    body.push('\n');
    body
}

/// Grab the node at `path` once, reusing the var if already grabbed. To avoid
/// re-walking from the root on every grab, walk from the longest already-grabbed
/// node that is a prefix of `path` (common-subexpression elimination) — this is
/// per-row hot code, so the saved `.children[i]` hops add up.
fn grab(
    ctx: &mut Ctx,
    emitter: &dyn Emitter,
    root: &str,
    path: &NodePath,
    grabbed: &mut Vec<(NodePath, String)>,
    lines: &mut Vec<String>,
) -> String {
    if let Some((_, var)) = grabbed.iter().find(|(p, _)| p == path) {
        return var.clone();
    }
    let from = grabbed
        .iter()
        .filter(|(p, _)| p.len() < path.len() && path.starts_with(p))
        .max_by_key(|(p, _)| p.len())
        .map(|(p, base)| (p.len(), base.clone()));
    let var = ctx.var("n");
    match from {
        Some((plen, base)) => {
            let remaining: NodePath = path[plen..].to_vec();
            lines.push(emitter.grab(&var, &base, &remaining));
        }
        None => lines.push(emitter.grab(&var, root, path)),
    }
    grabbed.push((path.clone(), var.clone()));
    var
}

/// `repeat(items, render, key)` → `_list(anchor, () => (items), key, render)`,
/// with nested `tpl` in `render` lowered to an IIFE builder.
fn lower_list(expr: &str, anchor: &str, ctx: &mut Ctx, emitter: &dyn Emitter) -> String {
    let args = split_call_args(expr);
    if args.len() < 2 {
        return emitter.pending("List: repeat() with unexpected arity");
    }
    let render = substitute_html(&args[1], ctx, emitter);
    let key = args
        .get(2)
        .cloned()
        .unwrap_or_else(|| "(_: unknown, i: number) => i".into());
    emitter.list(anchor, &args[0], &key, &render)
}

/// `when`/`choose`/ternary → `_child(anchor, () => (getter))`. The directive
/// call is erased; nested `tpl` becomes an IIFE builder. A ternary with a
/// `repeat(...)` branch is special-cased into a `_list` + `_child` pair.
fn lower_child(expr: &str, anchor: &str, ctx: &mut Ctx, emitter: &dyn Emitter) -> Vec<String> {
    if let Some((cond, then, els)) = split_ternary(expr) {
        if is_repeat(&then) || is_repeat(&els) {
            return lower_repeat_ternary(&cond, &then, &els, anchor, ctx, emitter);
        }
    }

    let trimmed = expr.trim_start();
    let getter = if trimmed.starts_with("when(") {
        let args = split_call_args(expr);
        let cond = args.first().cloned().unwrap_or_default();
        let body = substitute_html(&arrow_body(args.get(1)), ctx, emitter);
        format!("{cond} ? {body} : ''")
    } else if trimmed.starts_with("choose(") {
        lower_choose(expr, ctx, emitter)
    } else {
        // a ternary or direct template
        substitute_html(expr, ctx, emitter)
    };
    vec![emitter.child(anchor, &getter)]
}

fn is_repeat(branch: &str) -> bool {
    branch.trim_start().starts_with("repeat(")
}

/// `cond ? repeat(...) : else` (or the mirror) → a `_list` whose items are
/// guarded by `cond` plus a `_child` for the other branch, sharing the spot via
/// a second runtime-created anchor. Keeps the list's keyed reconcile.
fn lower_repeat_ternary(
    cond: &str,
    then: &str,
    els: &str,
    anchor: &str,
    ctx: &mut Ctx,
    emitter: &dyn Emitter,
) -> Vec<String> {
    let then_is_repeat = is_repeat(then);
    let (repeat_src, other_src) = if then_is_repeat {
        (then, els)
    } else {
        (els, then)
    };

    let args = split_call_args(repeat_src);
    if args.len() < 2 {
        return vec![emitter.pending("repeat-in-ternary: repeat() with unexpected arity")];
    }
    let render = substitute_html(&args[1], ctx, emitter);
    let key = args
        .get(2)
        .cloned()
        .unwrap_or_else(|| "(_: unknown, i: number) => i".into());
    let other = substitute_html(other_src, ctx, emitter);

    let list_anchor = ctx.var("a");
    let items = if then_is_repeat {
        format!("{cond} ? {} : []", args[0])
    } else {
        format!("{cond} ? [] : {}", args[0])
    };
    let child_getter = if then_is_repeat {
        format!("{cond} ? '' : {other}")
    } else {
        format!("{cond} ? {other} : ''")
    };

    vec![
        emitter.comment_anchor(&list_anchor, anchor),
        emitter.list(&list_anchor, &items, &key, &render),
        emitter.child(anchor, &child_getter),
    ]
}

/// `choose([[c1, f1], ..., [true, fd]])` → a right-folded ternary chain
/// `c1 ? (f1)() : ... : (fd)()`.
fn lower_choose(expr: &str, ctx: &mut Ctx, emitter: &dyn Emitter) -> String {
    let args = split_call_args(expr);
    let Some(arr) = args.first() else {
        return "''".into();
    };
    let inner = strip_brackets(arr);
    let mut chain = String::from("''");
    for pair in split_commas(&inner).into_iter().rev() {
        let parts = split_commas(&strip_brackets(&pair));
        let cond = parts.first().cloned().unwrap_or_default();
        let body = substitute_html(&arrow_body(parts.get(1)), ctx, emitter);
        chain = format!("{cond} ? {body} : {chain}");
    }
    chain
}

/// The body of a zero-arg factory `() => EXPR`. Falls back to calling a
/// non-arrow factory `(f)()`.
fn arrow_body(factory: Option<&String>) -> String {
    let Some(f) = factory else {
        return "''".into();
    };
    let t = f.trim();
    match t.find("=>") {
        Some(idx) => t[idx + 2..].trim().to_string(),
        None => format!("({t})()"),
    }
}

/// Replace each top-level `tpl` template in `expr` with an inline IIFE builder.
fn substitute_html(expr: &str, ctx: &mut Ctx, emitter: &dyn Emitter) -> String {
    let spans = find_html_spans(expr);
    if spans.is_empty() {
        return expr.to_string();
    }
    let total = expr.chars().count();
    let mut out = String::new();
    let mut last = 0;
    for (start, end) in spans {
        out.push_str(&slice(expr, last, start));
        let html_src = slice(expr, start, end);
        let (statics, holes) = split_template_literal(&html_src);
        let inner = gen_template(&statics, &holes, ctx, emitter, true);
        out.push_str(&format!("(() => {{\n{inner}}})()"));
        last = end;
    }
    out.push_str(&slice(expr, last, total));
    out
}

fn strip_brackets(s: &str) -> String {
    let t = s.trim();
    t.strip_prefix('[')
        .and_then(|x| x.strip_suffix(']'))
        .unwrap_or(t)
        .to_string()
}

/// Grouped value bindings share one effect, so a read duplicated across them is
/// the CSE candidate; structural (list/child) and wiring (event/model/…)
/// bindings evaluate elsewhere and are excluded.
fn is_grouped(k: &BindingKind) -> bool {
    matches!(
        k,
        BindingKind::Text
            | BindingKind::Attr
            | BindingKind::Class
            | BindingKind::Style
            | BindingKind::Prop
    )
}

fn is_js_ident(p: &str) -> bool {
    let mut chars = p.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' || c == '$' => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
}

/// A pure member chain (`a.b`, `this.x.y`) — safe to read once and reuse. Rejects
/// anything with a call, index, operator or whitespace (potential side effects or
/// a differing value), and bare identifiers (no signal read, nothing to save).
fn is_simple_read(e: &str) -> bool {
    let parts: Vec<&str> = e.split('.').collect();
    parts.len() >= 2 && parts.iter().all(|p| is_js_ident(p))
}
