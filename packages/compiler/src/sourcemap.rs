type Pair = (usize, usize);

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

fn align(src: &[&str], out: &[&str]) -> Vec<Pair> {
    let n = src.len();
    let m = out.len();
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

fn encode(pairs: &[Pair]) -> String {
    let mut out = String::new();
    let mut prev_src_line: i64 = 0;
    let mut idx = 0;
    let last = pairs.last().map_or(0, |p| p.0);
    for gen_line in 0..=last {
        if gen_line > 0 {
            out.push(';');
        }
        if idx < pairs.len() && pairs[idx].0 == gen_line {
            let src_line = pairs[idx].1 as i64;
            vlq(&mut out, 0);
            vlq(&mut out, 0);
            vlq(&mut out, src_line - prev_src_line);
            vlq(&mut out, 0);
            prev_src_line = src_line;
            idx += 1;
        }
    }
    out
}

const B64: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

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
            digit |= 0b10_0000;
        }
        out.push(B64[digit] as char);
        if v == 0 {
            break;
        }
    }
}

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
