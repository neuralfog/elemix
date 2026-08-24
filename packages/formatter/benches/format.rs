use criterion::{criterion_group, criterion_main, Criterion};
use elemix_template_formatter::{format_source, Options};
use std::hint::black_box;

fn opts() -> Options {
    Options {
        width: 80,
        tab_width: 4,
        ..Options::default()
    }
}

const SMALL: &str = "class C {\n    template = () => tpl`\n      <div    class=\"card\"   >\n    <span>${this.count}</span>\n        </div>\n    `;\n}\n";

const NESTED: &str = "class C {\n    template = () => tpl`\n  <div class=\"tree\">\n${repeat(this.state.groups, (group) => tpl`\n<section class=\"group\"><header class=\"group-head\"><h2 class=\"title\">${group.title}</h2></header>\n<ul class=\"items\">${repeat(group.items, (item) => tpl`\n<li class=\"item\"><div class=\"item-body\"><span class=\"label\">${item.label}</span></div><div class=\"item-meta\"><code>${item.id}</code></div></li>\n`, (item) => item.id)}</ul></section>\n`, (group) => group.id)}\n  </div>\n    `;\n}\n";

const RAW_TEXT: &str = "class C {\n    template = () => tpl`\n        <style>${this.css}</style>\n        <style>\n            .box { color: ${this.color}; padding: 10px; margin: 0 auto; }\n            .row { display: flex; gap: 8px; align-items: center; }\n        </style>\n        <pre>  line one\n    line two indented\n  line three\n      line four deeper\n  line five</pre>\n        <script>const x = 1; const y = 2; function f() { return x + y; }</script>\n        <div>${this.label}</div>\n    `;\n}\n";

fn bench_format(c: &mut Criterion) {
    let opts = opts();
    let mut group = c.benchmark_group("format_source");
    group.bench_function("small", |b| {
        b.iter(|| format_source(black_box(SMALL), black_box(&opts)));
    });
    group.bench_function("nested", |b| {
        b.iter(|| format_source(black_box(NESTED), black_box(&opts)));
    });
    group.bench_function("raw_text", |b| {
        b.iter(|| format_source(black_box(RAW_TEXT), black_box(&opts)));
    });
    group.finish();
}

criterion_group!(benches, bench_format);
criterion_main!(benches);
