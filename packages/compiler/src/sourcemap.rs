//! Line-level source map (`cli` feature only).
//!
//! `compile` is splice-based: user code — imports, class methods, getters,
//! `defineComponent` — survives VERBATIM, only shifted down by the lines the
//! compiler inserts (the runtime import, hoisted `template(...)` consts, the
//! expanded `view()`). So we don't need to instrument the passes: an LCS over
//! the original vs. compiled lines recovers every preserved line's origin, and
//! generated lines (which match nothing) simply map to nothing.
//!
//! Granularity is line-level (column 0). That's all the value prop needs — a
//! browser stack frame / breakpoint in compiled output lands on the right line
//! of the original `.ts`. Hole-precise column mapping into `tpl` is deliberately
//! out of scope (see ROADMAP / the source-map design notes).

/// A `(generated_line, original_line)` pairing, 0-based, both monotonically
/// increasing (an LCS preserves order on both sides).
type Pair = (usize, usize);

/// Build a Source Map v3 JSON object mapping `output` back to `source`.
///
/// The map embeds `sourcesContent` so the chain is self-contained (devtools
/// shows the original `tpl` source); callers that know the real path overwrite
/// `sources[0]` afterwards (the Vite plugin does this with the module id).
pub fn line_map(source: &str, output: &str, source_name: &str) -> String {
    let src_lines: Vec<&str> = source.lines().collect();
    let out_lines: Vec<&str> = output.lines().collect();
    let pairs = align(&src_lines, &out_lines);
    let mappings = encode(&pairs);
    format!(
        "{{\"version\":3,\"file\":{file},\"sources\":[{src}],\"sourcesContent\":[{content}],\"names\":[],\"mappings\":\"{mappings}\"}}",
        file = json_string(source_name),
        src = json_string(source_name),
        content = json_string(source),
    )
}

/// Pair each output line back to the original line it came from, via LCS.
/// Blank lines are skipped — mapping whitespace adds noise, never value.
fn align(src: &[&str], out: &[&str]) -> Vec<Pair> {
    let n = src.len();
    let m = out.len();
    // dp[i][j] = LCS length of src[i..] / out[j..], flattened to one Vec.
    let stride = m + 1;
    let mut dp = vec![0u32; (n + 1) * stride];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            let v = if src[i] == out[j] {
                dp[(i + 1) * stride + (j + 1)] + 1
            } else {
                dp[(i + 1) * stride + j].max(dp[i * stride + (j + 1)])
            };
            dp[i * stride + j] = v;
        }
    }

    let mut pairs = Vec::new();
    let (mut i, mut j) = (0, 0);
    while i < n && j < m {
        if src[i] == out[j] {
            if !src[i].trim().is_empty() {
                pairs.push((j, i));
            }
            i += 1;
            j += 1;
        } else if dp[(i + 1) * stride + j] >= dp[i * stride + (j + 1)] {
            i += 1;
        } else {
            j += 1;
        }
    }
    pairs
}

/// Encode pairs as the `mappings` VLQ string: one `;` per generated line, one
/// segment `[genCol=0, source=0, srcLineDelta, srcCol=0]` on each mapped line.
fn encode(pairs: &[Pair]) -> String {
    let mut out = String::new();
    let mut prev_src_line: i64 = 0;
    let mut idx = 0;
    let last = pairs.last().map(|p| p.0).unwrap_or(0);
    for gen_line in 0..=last {
        if gen_line > 0 {
            out.push(';');
        }
        if idx < pairs.len() && pairs[idx].0 == gen_line {
            let src_line = pairs[idx].1 as i64;
            vlq(&mut out, 0); // generated column
            vlq(&mut out, 0); // source index (delta, always 0)
            vlq(&mut out, src_line - prev_src_line);
            vlq(&mut out, 0); // source column
            prev_src_line = src_line;
            idx += 1;
        }
    }
    out
}

const B64: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Append one base64 VLQ value (the source-map flavour: sign in the low bit).
fn vlq(out: &mut String, value: i64) {
    let mut v: u32 = if value < 0 {
        (((-value) as u32) << 1) | 1
    } else {
        (value as u32) << 1
    };
    loop {
        let mut digit = (v & 0b1_1111) as usize;
        v >>= 5;
        if v > 0 {
            digit |= 0b10_0000; // continuation bit
        }
        out.push(B64[digit] as char);
        if v == 0 {
            break;
        }
    }
}

/// Quote a string as a JSON string literal.
pub fn json_string(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}
