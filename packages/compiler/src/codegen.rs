use crate::emit::Emitter;
use crate::grammar::{classify, BindingKind};
use crate::lower::{
    find_html_spans, slice, split_call_args, split_commas, split_object_entries,
    split_template_literal, split_ternary,
};
use crate::template::node::NodePath;
use crate::template::parse::{parse, structural_holes, StructHole};
use std::collections::HashMap;

#[derive(Clone)]
struct Reactive {
    item: String,
    key_field: Option<String>,
}

#[derive(Default)]
struct Ctx {
    tpls: usize,
    vars: usize,
    decls: String,
    seen: HashMap<String, String>,
    reactive: Vec<Reactive>,
    tpl_prefix: &'static str,
}

impl Ctx {
    fn new(tpl_prefix: &'static str) -> Self {
        Ctx {
            tpl_prefix,
            ..Default::default()
        }
    }

    fn tpl(&mut self) -> String {
        let id = format!("_{}{}", self.tpl_prefix, self.tpls);
        self.tpls += 1;
        id
    }

    fn var(&mut self, prefix: &str) -> String {
        let v = format!("_{prefix}{}", self.vars);
        self.vars += 1;
        v
    }
}

pub struct Generated {
    pub decls: String,
    pub body: String,
}

pub fn generate(statics: &[String], holes: &[String], emitter: &dyn Emitter) -> Generated {
    let mut ctx = Ctx::new("t");
    let body = gen_template(statics, holes, &mut ctx, emitter, false, false);
    Generated {
        decls: ctx.decls,
        body,
    }
}

pub fn generate_all(
    templates: &[(Vec<String>, Vec<String>)],
    emitter: &dyn Emitter,
) -> (String, Vec<String>) {
    let mut ctx = Ctx::new("t");
    let bodies = templates
        .iter()
        .map(|(statics, holes)| gen_template(statics, holes, &mut ctx, emitter, false, false))
        .collect();
    (ctx.decls, bodies)
}

pub fn generate_free(
    templates: &[(Vec<String>, Vec<String>)],
    emitter: &dyn Emitter,
) -> (String, Vec<String>) {
    let mut ctx = Ctx::new("ft");
    let bodies = templates
        .iter()
        .map(|(statics, holes)| gen_template(statics, holes, &mut ctx, emitter, false, false))
        .collect();
    (ctx.decls, bodies)
}

pub fn generate_hydrate(statics: &[String], holes: &[String], emitter: &dyn Emitter) -> Generated {
    let mut ctx = Ctx::new("h");
    let lines = hydrate_bind(statics, holes, "root", false, &mut ctx, emitter);
    let mut body = lines.join("\n");
    body.push('\n');
    Generated {
        decls: ctx.decls,
        body,
    }
}

fn region_meta(holes: &[StructHole]) -> Vec<(bool, usize, usize)> {
    let mut groups: Vec<(NodePath, Vec<usize>)> = Vec::new();
    for (i, h) in holes.iter().enumerate() {
        match groups.iter_mut().find(|(p, _)| *p == h.parent) {
            Some(g) => g.1.push(i),
            None => groups.push((h.parent.clone(), vec![i])),
        }
    }
    let mut meta = vec![(false, 0usize, 0usize); holes.len()];
    for (_, idxs) in &groups {
        let multi = idxs.len() >= 2 && idxs.iter().all(|&i| holes[i].list);
        for (ord, &i) in idxs.iter().enumerate() {
            let lead = if ord == 0 {
                holes[i].before
            } else {
                holes[i].before - holes[idxs[ord - 1]].before - 1
            };
            meta[i] = (multi, ord, lead);
        }
    }
    meta
}

fn hydrate_bind(
    statics: &[String],
    holes: &[String],
    root: &str,
    el: bool,
    ctx: &mut Ctx,
    emitter: &dyn Emitter,
) -> Vec<String> {
    let parsed = parse(statics, holes);
    let bindings: Vec<_> = parsed.holes.iter().map(classify).collect();
    let mut lines: Vec<String> = Vec::new();
    let mut grabbed: Vec<(NodePath, String)> = Vec::new();

    let adj = |p: &NodePath| -> NodePath {
        if el && !p.is_empty() {
            p[1..].to_vec()
        } else {
            p.clone()
        }
    };

    let is_split_text =
        |b: &crate::grammar::Binding| matches!(b.kind, BindingKind::Text) && !b.baked;
    let mut text_groups: Vec<(NodePath, Vec<usize>)> = Vec::new();
    for (i, (b, hole)) in bindings.iter().zip(&parsed.holes).enumerate() {
        if !is_split_text(b) {
            continue;
        }
        let parent = adj(&hole.path[..hole.path.len().saturating_sub(1)].to_vec());
        match text_groups.iter_mut().find(|(p, _)| *p == parent) {
            Some(g) => g.1.push(i),
            None => text_groups.push((parent, vec![i])),
        }
    }

    let is_structural = |b: &crate::grammar::Binding| {
        matches!(
            b.kind,
            BindingKind::List | BindingKind::Child | BindingKind::Splice
        )
    };

    let is_baked_text =
        |b: &crate::grammar::Binding| matches!(b.kind, BindingKind::Text) && b.baked;

    let mut node_for: Vec<String> = vec![String::new(); bindings.len()];
    for (i, b) in bindings.iter().enumerate() {
        if is_split_text(b) || is_structural(b) {
            continue;
        }
        if is_baked_text(b) {
            let parent = adj(&b.path[..b.path.len().saturating_sub(1)].to_vec());
            let el_var = grab(ctx, emitter, root, &parent, &mut grabbed, &mut lines);
            let node = ctx.var("n");
            lines.push(emitter.text(&node, &el_var));
            node_for[i] = node;
            continue;
        }
        node_for[i] = grab(ctx, emitter, root, &adj(&b.path), &mut grabbed, &mut lines);
    }

    for (parent, idxs) in &text_groups {
        let el_var = grab(ctx, emitter, root, parent, &mut grabbed, &mut lines);
        let lens = ctx.var("d");
        lines.push(emitter.dyn_lens(&lens, &el_var));
        let prefixes: Vec<usize> = idxs.iter().map(|&i| parsed.holes[i].prefix).collect();
        let run_index = idxs.first().map_or(0, |&i| parsed.holes[i].run_index);
        let vals = ctx.var("v");
        lines.push(emitter.split_run(&vals, &el_var, run_index, &prefixes, &lens));
        for (k, &i) in idxs.iter().enumerate() {
            node_for[i] = format!("{vals}[{k}]");
        }
    }

    let mut group: Vec<String> = Vec::new();
    for (b, node) in bindings.iter().zip(&node_for) {
        let name = b.name.as_deref().unwrap_or("");
        let g = b.expr.trim();
        match b.kind {
            BindingKind::Event => lines.push(emitter.event(node, name, &b.expr)),
            BindingKind::Model => lines.push(emitter.model(node, &b.expr)),
            BindingKind::OnModel => lines.push(emitter.onmodel(node, &b.expr)),
            BindingKind::Ref => lines.push(emitter.reference(node, &b.expr)),
            BindingKind::Text => group.push(emitter.set_text(node, g)),
            BindingKind::Attr => group.push(emitter.set_attr(node, name, g)),
            BindingKind::Class => group.push(emitter.set_class(node, "''", g)),
            BindingKind::Style => group.push(emitter.set_style(node, g)),
            BindingKind::Prop => group.push(emitter.set_prop(node, name, g)),
            BindingKind::List | BindingKind::Child | BindingKind::Splice => {}
        }
    }

    let mut counts: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
    for b in &bindings {
        if is_grouped(&b.kind) && is_simple_read(b.expr.trim()) {
            *counts.entry(b.expr.trim()).or_insert(0) += 1;
        }
    }
    let split = !counts.values().any(|&c| c >= 2);
    if split && group.len() > 1 {
        for w in &group {
            lines.push(emitter.bind_group(std::slice::from_ref(w)));
        }
    } else if !group.is_empty() {
        lines.push(emitter.bind_group(&group));
    }

    let all_holes = structural_holes(statics, holes);
    let region_meta = region_meta(&all_holes);
    let mut prepared: Vec<(String, String, StructHole, bool)> = Vec::new();
    for (i, sh) in all_holes.into_iter().enumerate() {
        let parent = grab(
            ctx,
            emitter,
            root,
            &adj(&sh.parent),
            &mut grabbed,
            &mut lines,
        );
        let bounds = ctx.var("b");
        let (multi, ordinal, lead) = region_meta[i];
        if multi {
            lines.push(emitter.span(&bounds, &parent, lead, ordinal));
        } else {
            lines.push(emitter.bounds(&bounds, &parent, sh.before, sh.after));
        }
        let resumable = !sh.list
            && !sh.expr.contains("repeat(")
            && branch_has_component(&sh.expr)
            && branches_single_root(&sh.expr);
        prepared.push((parent, bounds, sh, resumable));
    }

    let mut resume: Vec<String> = Vec::new();
    let mut fresh: Vec<String> = Vec::new();
    for (parent, bounds, sh, resumable) in prepared {
        if resumable {
            let seat = ctx.var("s");
            resume.push(emitter.seat(&seat, &parent, &bounds));
            let root_var = ctx.var("r");
            let hydrate_getter = child_getter(&sh.expr, ctx, emitter, Some(&root_var));
            let fresh_getter = child_getter(&sh.expr, ctx, emitter, None);
            resume.push(emitter.child_resume(
                &format!("{seat}[0]"),
                &format!("{seat}[1]"),
                &root_var,
                &hydrate_getter,
                &fresh_getter,
            ));
        } else {
            let anchor = ctx.var("a");
            fresh.push(emitter.reanchor(&anchor, &parent, &bounds));
            if sh.list {
                fresh.push(lower_list(&sh.expr, &anchor, ctx, emitter));
            } else {
                fresh.extend(lower_child(&sh.expr, &anchor, ctx, emitter));
            }
        }
    }
    lines.append(&mut resume);
    if !fresh.is_empty() {
        lines.push("$__fresh(() => {".to_string());
        lines.append(&mut fresh);
        lines.push("});".to_string());
    }

    lines
}

fn branch_has_component(expr: &str) -> bool {
    for (start, end) in find_html_spans(expr) {
        let (statics, _) = split_template_literal(&slice(expr, start, end));
        for st in &statics {
            if has_custom_tag(st) {
                return true;
            }
        }
    }
    false
}

fn has_custom_tag(markup: &str) -> bool {
    let bytes = markup.as_bytes();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'<' && bytes[i + 1].is_ascii_lowercase() {
            let mut j = i + 1;
            let mut hyphen = false;
            while j < bytes.len() && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'-') {
                if bytes[j] == b'-' {
                    hyphen = true;
                }
                j += 1;
            }
            if hyphen {
                return true;
            }
            i = j;
        } else {
            i += 1;
        }
    }
    false
}

fn branches_single_root(expr: &str) -> bool {
    for (start, end) in find_html_spans(expr) {
        let (statics, holes) = split_template_literal(&slice(expr, start, end));
        if !parse(&statics, &holes).single_root {
            return false;
        }
    }
    true
}

pub fn codegen(statics: &[String], holes: &[String], emitter: &dyn Emitter) -> String {
    let g = generate(statics, holes, emitter);
    format!("{}{}", g.decls, g.body)
}

fn gen_template(
    statics: &[String],
    holes: &[String],
    ctx: &mut Ctx,
    emitter: &dyn Emitter,
    builder: bool,
    multi_root: bool,
) -> String {
    let parsed = parse(statics, holes);
    let bindings: Vec<_> = parsed.holes.iter().map(classify).collect();

    let el = builder && parsed.single_root;

    let seen_key = if el {
        format!("\u{0}el\u{0}{}", parsed.markup)
    } else {
        parsed.markup.clone()
    };
    let tpl = match ctx.seen.get(&seen_key) {
        Some(id) => id.clone(),
        None => {
            let id = ctx.tpl();
            let decl = if el {
                emitter.template_el_decl(&id, &parsed.markup)
            } else {
                emitter.template_decl(&id, &parsed.markup)
            };
            ctx.decls.push_str(&decl);
            ctx.decls.push('\n');
            ctx.seen.insert(seen_key, id.clone());
            id
        }
    };

    let root = ctx.var("r");
    let mut lines = vec![if el {
        emitter.clone_el(&root, &tpl)
    } else {
        emitter.clone_root(&root, &tpl)
    }];
    let mut grabbed: Vec<(NodePath, String)> = Vec::new();

    let nodes: Vec<String> = bindings
        .iter()
        .map(|b| {
            let path: NodePath = if el && !b.path.is_empty() {
                b.path[1..].to_vec()
            } else {
                b.path.clone()
            };
            grab(ctx, emitter, &root, &path, &mut grabbed, &mut lines)
        })
        .collect();

    let mut cse: HashMap<String, String> = HashMap::new();
    let mut hoists: Vec<String> = Vec::new();
    let mut static_hoists: Vec<String> = Vec::new();
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
                if is_static_key(e, ctx) {
                    static_hoists.push(emitter.local(&v, &static_raw(e)));
                } else {
                    hoists.push(emitter.local(&v, e));
                }
                cse.insert(e.to_string(), v);
            }
        }
    }

    let split = hoists.is_empty();
    let mut group: Vec<String> = hoists;
    let mut statics: Vec<String> = static_hoists;
    for (b, node) in bindings.iter().zip(&nodes) {
        let name = b.name.as_deref().unwrap_or("");
        let stat = is_grouped(&b.kind) && is_static_key(b.expr.trim(), ctx);
        let read: String = match cse.get(b.expr.trim()) {
            Some(v) => v.clone(),
            None if stat => static_raw(b.expr.trim()),
            None => b.expr.trim().to_string(),
        };
        let g = read.as_str();
        match b.kind {
            BindingKind::Splice => {
                lines.push(emitter.pending("Splice content binding - symbol resolution pending"));
            }
            BindingKind::List => lines.push(lower_list(&b.expr, node, ctx, emitter)),
            BindingKind::Child => lines.extend(lower_child(&b.expr, node, ctx, emitter)),
            BindingKind::Text if b.baked => {
                if stat {
                    statics.push(emitter.set_text_direct(node, g));
                } else {
                    group.push(emitter.set_text(node, g));
                }
            }
            BindingKind::Text => {
                let tnode = ctx.var("x");
                lines.push(emitter.text_anchor(&tnode, node));
                if stat {
                    statics.push(emitter.set_text_direct(&tnode, g));
                } else {
                    group.push(emitter.set_text(&tnode, g));
                }
            }
            BindingKind::Attr => {
                if stat {
                    statics.push(emitter.set_attr_direct(node, name, g));
                } else {
                    group.push(emitter.set_attr(node, name, g));
                }
            }
            BindingKind::Class => {
                let w = emitter.set_class(node, "''", g);
                if stat {
                    statics.push(w);
                } else {
                    group.push(w);
                }
            }
            BindingKind::Style => {
                let w = emitter.set_style(node, g);
                if stat {
                    statics.push(w);
                } else {
                    group.push(w);
                }
            }
            BindingKind::Prop => {
                let w = emitter.set_prop(node, name, g);
                if stat {
                    statics.push(w);
                } else {
                    group.push(w);
                }
            }
            BindingKind::Event => lines.push(emitter.event(node, name, &b.expr)),
            BindingKind::Model => lines.push(emitter.model(node, &b.expr)),
            BindingKind::OnModel => lines.push(emitter.onmodel(node, &b.expr)),
            BindingKind::Ref => lines.push(emitter.reference(node, &b.expr)),
        }
    }

    lines.append(&mut statics);
    if !group.is_empty() {
        if split && group.len() > 1 {
            for w in &group {
                lines.push(emitter.bind_group(std::slice::from_ref(w)));
            }
        } else {
            lines.push(emitter.bind_group(&group));
        }
    }

    lines.push(emitter.ret(&root, builder, el, multi_root));
    let mut body = lines.join("\n");
    body.push('\n');
    body
}

fn grab(
    ctx: &mut Ctx,
    emitter: &dyn Emitter,
    root: &str,
    path: &NodePath,
    grabbed: &mut Vec<(NodePath, String)>,
    lines: &mut Vec<String>,
) -> String {
    if path.is_empty() {
        return root.to_string();
    }
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

fn lower_list(expr: &str, anchor: &str, ctx: &mut Ctx, emitter: &dyn Emitter) -> String {
    let args = split_call_args(expr);
    if args.len() < 2 {
        return emitter.pending("List: repeat() with unexpected arity");
    }
    let reactive = arrow_first_param(&args[1]).map(|item| Reactive {
        item,
        key_field: args.get(2).and_then(|k| key_field(k)),
    });
    let pushed = reactive.is_some();
    if let Some(r) = reactive {
        ctx.reactive.push(r);
    }
    let render = substitute_html(&args[1], ctx, emitter, true);
    if pushed {
        ctx.reactive.pop();
    }
    let key = args
        .get(2)
        .cloned()
        .unwrap_or_else(|| "(_: unknown, i: number) => i".into());
    emitter.list(anchor, &args[0], &key, &render)
}

fn lower_child(expr: &str, anchor: &str, ctx: &mut Ctx, emitter: &dyn Emitter) -> Vec<String> {
    if let Some((cond, then, els)) = split_ternary(expr) {
        if is_repeat(&then) || is_repeat(&els) {
            return lower_repeat_ternary(&cond, &then, &els, anchor, ctx, emitter);
        }
    }

    let getter = child_getter(expr, ctx, emitter, None);
    vec![emitter.child(anchor, &getter)]
}

fn child_getter(expr: &str, ctx: &mut Ctx, emitter: &dyn Emitter, hy: Option<&str>) -> String {
    let trimmed = expr.trim_start();
    if trimmed.starts_with("when(") {
        let args = split_call_args(expr);
        let cond = args.first().cloned().unwrap_or_default();
        let body = sub(&arrow_body(args.get(1)), ctx, emitter, true, hy);
        let els = sub(&arrow_body(args.get(2)), ctx, emitter, true, hy);
        format!("{cond} ? {body} : {els}")
    } else if trimmed.starts_with("choose(") {
        lower_choose(expr, ctx, emitter, hy)
    } else if trimmed.starts_with("match(") {
        lower_match(expr, ctx, emitter, hy)
    } else {
        sub(expr, ctx, emitter, true, hy)
    }
}

fn sub(
    expr: &str,
    ctx: &mut Ctx,
    emitter: &dyn Emitter,
    multi_root: bool,
    hy: Option<&str>,
) -> String {
    match hy {
        Some(root) => substitute_html_hydrate(expr, root, ctx, emitter),
        None => substitute_html(expr, ctx, emitter, multi_root),
    }
}

fn substitute_html_hydrate(expr: &str, root: &str, ctx: &mut Ctx, emitter: &dyn Emitter) -> String {
    let spans = find_html_spans(expr);
    if spans.is_empty() {
        return expr.to_string();
    }
    let total = expr.chars().count();
    let mut out = String::new();
    let mut last = 0;
    for (start, end) in spans {
        out.push_str(&slice(expr, last, start));
        let (statics, holes) = split_template_literal(&slice(expr, start, end));
        let single = parse(&statics, &holes).single_root;
        let inner = hydrate_bind(&statics, &holes, root, single, ctx, emitter);
        out.push_str(&format!(
            "(() => {{\n{}\nreturn {root};\n}})()",
            inner.join("\n")
        ));
        last = end;
    }
    out.push_str(&slice(expr, last, total));
    out
}

fn is_repeat(branch: &str) -> bool {
    branch.trim_start().starts_with("repeat(")
}

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
    let reactive = arrow_first_param(&args[1]).map(|item| Reactive {
        item,
        key_field: args.get(2).and_then(|k| key_field(k)),
    });
    let pushed = reactive.is_some();
    if let Some(r) = reactive {
        ctx.reactive.push(r);
    }
    let render = substitute_html(&args[1], ctx, emitter, true);
    if pushed {
        ctx.reactive.pop();
    }
    let key = args
        .get(2)
        .cloned()
        .unwrap_or_else(|| "(_: unknown, i: number) => i".into());
    let other = substitute_html(other_src, ctx, emitter, true);

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

fn lower_choose(expr: &str, ctx: &mut Ctx, emitter: &dyn Emitter, hy: Option<&str>) -> String {
    let args = split_call_args(expr);
    let Some(arr) = args.first() else {
        return "''".into();
    };
    let inner = strip_brackets(arr);
    let mut chain = String::from("''");
    for pair in split_commas(&inner).into_iter().rev() {
        let parts = split_commas(&strip_brackets(&pair));
        let cond = parts.first().cloned().unwrap_or_default();
        let body = sub(&arrow_body(parts.get(1)), ctx, emitter, true, hy);
        chain = format!("{cond} ? {body} : {chain}");
    }
    chain
}

fn lower_match(expr: &str, ctx: &mut Ctx, emitter: &dyn Emitter, hy: Option<&str>) -> String {
    let args = split_call_args(expr);
    let Some(value) = args.first().cloned() else {
        return "''".into();
    };
    let keyed = args.len() >= 3;
    let (dispatch, cases_idx) = if keyed {
        let key = args[1].trim();
        (format!("({value})[{key}]"), 2)
    } else {
        (value.clone(), 1)
    };
    let Some(cases) = args.get(cases_idx) else {
        return "''".into();
    };
    let mut chain = String::from("''");
    for (key, val) in split_object_entries(cases).into_iter().rev() {
        let rhs = key_compare_rhs(&key);
        let body = if keyed {
            let arm = sub(&val, ctx, emitter, true, hy);
            format!("({arm})({value})")
        } else {
            sub(&arrow_body(Some(&val)), ctx, emitter, true, hy)
        };
        chain = format!("{dispatch} === {rhs} ? {body} : {chain}");
    }
    chain
}

fn key_compare_rhs(key: &str) -> String {
    let k = key.trim();
    let quoted = k.starts_with('\'') || k.starts_with('"') || k.starts_with('`');
    let numeric = !k.is_empty() && k.chars().all(|c| c.is_ascii_digit());
    if k.len() >= 2 && k.starts_with('[') && k.ends_with(']') {
        format!("({})", k[1..k.len() - 1].trim())
    } else if quoted || numeric {
        k.to_string()
    } else {
        format!("'{k}'")
    }
}

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

fn substitute_html(expr: &str, ctx: &mut Ctx, emitter: &dyn Emitter, multi_root: bool) -> String {
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
        let inner = gen_template(&statics, &holes, ctx, emitter, true, multi_root);
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

fn is_simple_read(e: &str) -> bool {
    let parts: Vec<&str> = e.split('.').collect();
    parts.len() >= 2 && parts.iter().all(|p| is_js_ident(p))
}

fn arrow_first_param(arrow: &str) -> Option<String> {
    let (params, _) = arrow.split_once("=>")?;
    let params = params.trim();
    let params = params
        .strip_prefix('(')
        .map_or(params, |p| p.trim_end_matches(')'));
    let name = params.split(',').next()?.split(':').next()?.trim();
    if is_js_ident(name) {
        Some(name.to_string())
    } else {
        None
    }
}

fn key_field(key_arrow: &str) -> Option<String> {
    let param = arrow_first_param(key_arrow)?;
    let (_, body) = key_arrow.split_once("=>")?;
    let field = body.trim().strip_prefix(&param)?.trim().strip_prefix('.')?;
    if is_js_ident(field) {
        Some(field.to_string())
    } else {
        None
    }
}

fn is_static_key(expr: &str, ctx: &Ctx) -> bool {
    match ctx.reactive.last() {
        Some(Reactive {
            item,
            key_field: Some(kf),
        }) => expr == format!("{item}.{kf}"),
        _ => false,
    }
}

fn static_raw(expr: &str) -> String {
    match expr.split_once('.') {
        Some((root, rest)) => format!("$__toRaw({root}).{rest}"),
        None => expr.to_string(),
    }
}
