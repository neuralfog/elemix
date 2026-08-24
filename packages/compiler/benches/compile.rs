use criterion::{criterion_group, criterion_main, Criterion};
use elemix_compiler::{compile, compile_hydrate, compile_ssr};
use std::hint::black_box;

const SIMPLE: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { count: number };

// #component
export class CounterApp extends Component {
    // #state
    state: State = { count: 0 };

    increment = (): void => {
        this.state.count++;
    };

    template = (): Template =>
        tpl`<button @click=${this.increment}>count is ${this.state.count}</button>`;
}
"#;

const LIST: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type User = { id: number; name: string; role: string };
type State = { users: User[] };

// #component
export class CardListApp extends Component {
    // #state
    state: State = {
        users: [
            { id: 1, name: 'Ada', role: 'Engineer' },
            { id: 2, name: 'Grace', role: 'Engineer' },
        ],
    };

    template = (): Template => tpl`
        <div class="list">
            ${repeat(
                this.state.users,
                (user) => tpl`<div class="row">
                    <user-card :name=${user.name} :role=${user.role} />
                    <button class="drop" @click=${() => this.removeUser(user.id)}>x</button>
                </div>`,
                (user) => user.id,
            )}
        </div>
    `;
}
"#;

const MATCH: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import { match } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Load =
    | { kind: 'idle' }
    | { kind: 'loading'; pct: number }
    | { kind: 'ready'; url: string }
    | { kind: 'failed'; error: string };

type State = { load: Load };

// #component
export class MatchApp extends Component {
    // #state
    state: State = { load: { kind: 'idle' } };

    template = (): Template => tpl`
        <div class="stage">
            ${match(this.state.load, 'kind', {
                idle: () => tpl`<div class="card idle">Pick a state above</div>`,
                loading: (m) => tpl`<div class="card loading">Working ${m.pct}%</div>`,
                ready: (m) => tpl`<div class="card ready">Deployed to ${m.url}</div>`,
                failed: (m) => tpl`<div class="card failed">${m.error}</div>`,
            })}
        </div>
    `;
}
"#;

fn bench_compile(c: &mut Criterion) {
    let cases = [("simple", SIMPLE), ("list", LIST), ("match", MATCH)];

    let mut group = c.benchmark_group("compile");
    for (name, src) in cases {
        group.bench_function(name, |b| b.iter(|| compile(black_box(src))));
    }
    group.finish();

    let mut group = c.benchmark_group("compile_ssr");
    for (name, src) in cases {
        group.bench_function(name, |b| b.iter(|| compile_ssr(black_box(src), false)));
    }
    group.finish();

    let mut group = c.benchmark_group("compile_hydrate");
    for (name, src) in cases {
        group.bench_function(name, |b| b.iter(|| compile_hydrate(black_box(src), false)));
    }
    group.finish();
}

criterion_group!(benches, bench_compile);
criterion_main!(benches);
