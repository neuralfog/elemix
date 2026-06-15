//! Generic pragma parsing — turn a pragma statement's `(statics, holes)` (the
//! same shape every template literal lowers to) into a `Vec<Directive>`. This
//! layer is deliberately ignorant of directive *meaning*: it only knows the
//! shape `#name word… ${expr}…`. Directives are split on `#` found in the
//! STATIC text, so a `#` inside an interpolation (`${'#fff'}`) is never mistaken
//! for a new directive — it arrives as an opaque [`Arg::Expr`].

use super::{Arg, Directive};

/// Split one pragma statement into its directives. `statics` has `holes.len()+1`
/// entries; the sequence is `statics[0] holes[0] statics[1] … statics[n]`.
///
/// Multi-statement blocks are handled by concatenating each statement's result
/// (see [`split_block`]); a statement may also be `#styles ${a}` alone.
pub fn split_directives(statics: &[String], holes: &[String]) -> Vec<Directive> {
    let mut out: Vec<Directive> = Vec::new();
    let mut cur: Option<Directive> = None;

    for (i, s) in statics.iter().enumerate() {
        let mut segments = s.split('#');
        // Text before the first `#` is trailing word-args of the open directive.
        if let Some(first) = segments.next() {
            push_words(cur.as_mut(), first);
        }
        for seg in segments {
            if let Some(done) = cur.take() {
                out.push(done);
            }
            let mut words = seg.split_whitespace();
            let name = words.next().unwrap_or_default().to_string();
            let args = words.map(|w| Arg::Word(w.to_string())).collect();
            cur = Some(Directive { name, args });
        }
        // A hole sits after this static chunk → an Expr arg of the open directive.
        if let Some(h) = holes.get(i) {
            if let Some(d) = cur.as_mut() {
                d.args.push(Arg::Expr(h.trim().to_string()));
            }
        }
    }
    if let Some(done) = cur.take() {
        out.push(done);
    }
    out
}

fn push_words(into: Option<&mut Directive>, text: &str) {
    if let Some(d) = into {
        for w in text.split_whitespace() {
            d.args.push(Arg::Word(w.to_string()));
        }
    }
}

/// Merge the directives of every statement in a pragma block, preserving order.
pub fn split_block(statements: &[(Vec<String>, Vec<String>)]) -> Vec<Directive> {
    let mut out = Vec::new();
    for (statics, holes) in statements {
        out.extend(split_directives(statics, holes));
    }
    out
}

/// Whether a template literal's first static chunk marks it as a pragma — the
/// first non-whitespace character is `#`. Used to pick pragma statements out of
/// the module body.
pub fn is_pragma(first_static: &str) -> bool {
    first_static.trim_start().starts_with('#')
}
