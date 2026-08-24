use crate::template::parse::{fmt_array, Chunk, Rope};

fn wrap_ssr(prelude: &str, arr: &str) -> String {
    let pre = if prelude.is_empty() {
        String::new()
    } else {
        format!("{prelude}\n")
    };
    format!("$$__ssr(): unknown[] {{\n{pre}return {arr};\n}}")
}

pub fn ssr_method(
    host_tag: &str,
    style_body: Option<&str>,
    no_shadow: bool,
    client: bool,
    document: bool,
    prelude: &str,
    inner: Vec<Chunk>,
) -> String {
    if document {
        let mut r = Rope::new();
        r.static_str("<!doctype html>");
        r.extend(inner);
        let arr = fmt_array(&r.chunks);
        return wrap_ssr(prelude, &arr);
    }
    let tag = format!("${{this.$$__tag ?? '{host_tag}'}}");
    if client {
        return format!("$$__ssr(): unknown[] {{\nreturn [`<{tag}></{tag}>`];\n}}");
    }
    let (open, close) = if no_shadow {
        (format!("<{tag}>"), format!("</{tag}>"))
    } else {
        let style = match style_body {
            Some(body) => format!("<style data-ssr>{body}</style>"),
            None => String::new(),
        };
        (
            format!("<{tag}><template shadowrootmode=\"open\" shadowrootserializable=\"\">{style}"),
            format!("</template></{tag}>"),
        )
    };
    let mut r = Rope::new();
    r.static_str(&open);
    r.extend(inner);
    r.static_str(&close);
    let arr = fmt_array(&r.chunks);
    wrap_ssr(prelude, &arr)
}
