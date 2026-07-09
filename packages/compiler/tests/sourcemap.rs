//! Source-map tests — the line-level map must never lie: every mapped output
//! line resolves to an original line with identical content (verbatim user code
//! survives the splice-based compile), and real user code is actually mapped.

use elemix_compiler::compile_with_map;

const SOURCE: &str = r#"import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
export class CounterApp extends Component {
    state = $__state({ count: 0 });
    increment = () => { this.state.count++; };
    template = () => tpl`<button @click=${this.increment}>${this.state.count}</button>`;
}
defineComponent('counter-app', CounterApp);
"#;

/// Decode the `mappings` VLQ string into `(generated_line, original_line)` pairs.
fn decoded_pairs(mappings: &str) -> Vec<(usize, usize)> {
    let mut pairs = Vec::new();
    let mut src_line: i64 = 0;
    for (gen_line, seg) in mappings.split(';').enumerate() {
        if seg.is_empty() {
            continue;
        }
        let vals = decode_segment(seg);
        // [genCol, sourceIdx, srcLineDelta, srcCol]
        src_line += vals[2];
        pairs.push((gen_line, src_line as usize));
    }
    pairs
}

fn decode_segment(seg: &str) -> Vec<i64> {
    let chars: Vec<char> = seg.chars().collect();
    let mut vals = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let mut result: i64 = 0;
        let mut shift = 0;
        loop {
            let d = b64(chars[i]);
            i += 1;
            result |= (d & 0b1_1111) << shift;
            if d & 0b10_0000 == 0 {
                break;
            }
            shift += 5;
        }
        let neg = result & 1 == 1;
        let v = result >> 1;
        vals.push(if neg { -v } else { v });
    }
    vals
}

fn b64(c: char) -> i64 {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    T.iter().position(|&x| x as char == c).unwrap() as i64
}

fn mappings_of(map: &str) -> String {
    let key = "\"mappings\":\"";
    let start = map.find(key).unwrap() + key.len();
    let rest = &map[start..];
    rest[..rest.find('"').unwrap()].to_string()
}

#[test]
fn map_is_a_v3_object_with_embedded_source() {
    let (_code, map) = compile_with_map(SOURCE, "CounterApp.ts");
    assert!(map.contains("\"version\":3"));
    assert!(map.contains("\"sources\":[\"CounterApp.ts\"]"));
    // self-contained: the original is embedded so devtools shows the tpl source
    assert!(map.contains("\"sourcesContent\":["));
}

#[test]
fn every_mapped_line_resolves_to_an_identical_original_line() {
    let (code, map) = compile_with_map(SOURCE, "CounterApp.ts");
    let src_lines: Vec<&str> = SOURCE.lines().collect();
    let out_lines: Vec<&str> = code.lines().collect();

    let pairs = decoded_pairs(&mappings_of(&map));
    assert!(!pairs.is_empty(), "no lines were mapped");

    for (gen, src) in &pairs {
        assert_eq!(
            out_lines[*gen], src_lines[*src],
            "line {gen} of output maps to line {src} of source, but they differ"
        );
    }
}

#[test]
fn verbatim_user_code_is_mapped_back() {
    let (code, map) = compile_with_map(SOURCE, "CounterApp.ts");
    let out_lines: Vec<&str> = code.lines().collect();
    let pairs = decoded_pairs(&mappings_of(&map));

    // the untouched method survives and resolves — the whole point of the map
    let mapped: Vec<&str> = pairs.iter().map(|(gen, _)| out_lines[*gen]).collect();
    assert!(
        mapped.iter().any(|l| l.contains("increment = () =>")),
        "the verbatim `increment` method was not mapped"
    );
    assert!(
        mapped
            .iter()
            .any(|l| l.contains("defineComponent('counter-app'")),
        "the verbatim `defineComponent` call was not mapped"
    );
}

#[test]
fn generated_lines_map_to_nothing() {
    // The view() body / hoisted consts are generated — they must NOT claim an
    // origin (no mapped output line may contain a runtime primitive call).
    let (code, map) = compile_with_map(SOURCE, "CounterApp.ts");
    let out_lines: Vec<&str> = code.lines().collect();
    let pairs = decoded_pairs(&mappings_of(&map));
    for (gen, _) in &pairs {
        let line = out_lines[*gen];
        assert!(
            !line.contains("view(): DocumentFragment") && !line.contains("= $__template("),
            "a generated line ({line}) was mapped to the source"
        );
    }
}
