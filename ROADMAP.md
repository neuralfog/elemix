# Roadmap

## Goals

- [x] ✅ Competitive with React, Vue and Angular
  - [x] Faster than React and Angular, very close to Vue benchmarks
  - [x] Weighted Geometric Mean:
    - vue                   1.23
    - elemix                1.32
    - angular               1.37
    - react 19 with hooks   1.42
  - [x] Beats all of them on byte transfer:
    - elemix    6.7kb
    - vue       22.8kb
    - react     51.4kb
    - angular   44.2kb
  - [x] Beats all of them on first paint:
    - elemix    60.6
    - vue       97.7
    - react     228.5
    - angular   180.8
  - [] I was winning in the memory department by a mile, but
    - proxy removal
    - automatic memo for list rendering and identity keys
    caused a massive memory spike, a lot of tracking and object retention 😬

  - [x] Framework/Lib Api has been frozen - I don't want any more changes we are in a good spot

### I have beaten react to the ground!! My life work is complete!! 😂😂😂

**If goals can not be achieved, further work will be terminated as there is no point working on slop**

## Compiler - We don't React. We compile. 😂😂😂

WIP - experimental

- [] Evaluate the compiler, otherwise kill it with fire 🔥🔥🔥 Entire thing!!

- [] Main goals
   - [] Can we increase speed, although we are close to the limitations of native DOM operations 🎉
   - [] Literal milliseconds do not matter on row swaps etc. This is faster than it has to be!!
   - [] Freedom and api is what matters

- [] Memory usage, this is a clear win
- [] Initial bundle size should drop, I would want to be in the range of 3 - 4kb ideally not 6.7kb 😬
- [] Generated code will add some weight, but this will be application code, reused by component instances...
- [] Downside, a build step, although this is not an issue at all as it already goes through typescript
- [] Compiler first architecture opens some crazy opportunities later down the line ❤️

- [] Code is kinda shite right now... 💩 This is clearly going in the direction of an effect (FP, OCaml, Solid) λ λ λ λ λ λ
  - [] Using generated code spat out from the compiler should make code a lot more readable and maintainable
  - [] Most likely all runtime code responsible for template evaluation will be gone or most of it
  - [] Same will apply to state, right now it is a hybrid between coarse rendering and granular observables with
    versioning and dirty flags - big mountain of crap in the middle of a clean room 🤮😂 It works though...

- [] Api has to stay unchanged - this is a must!!
  - [] Manual render `this.render()`
  - [] State, signals, and props
  - [] Apart from small changes like removing virtual attributes and moving statics!

- [] Rust 🤮 + OXC the javascript toolchain - battle tested, there is no better alternative
  - [] Unless I go my own way and write it from scratch in Zig, Odin or Ocaml 😂
  - [] Not sure if it's worth the pain though when I have a toolchain that I can use off the shelf
  - [] Dependency chain is not an issue as I can freeze version by compiled executable

- [] Exe shipped as npm module
  - [] Same as tsc, accepts params and configs etc
  - [] Delivery of different CPU architectures should not be an issue
  - [] Rust compiles to wasm - first class support - can still use it in playground
  - [] Where do I spit the files, do I augment original files and spit them out to `.cache`
    directory ?? 🤔
  - [] 2 pass compilation process, `elemix compiler` => tsc => js 

**Proceed to next stage only if happy with compiler workflow and benchmark results**

## Composition Like Api - Module as component - bit like svelte

Brief idea:

`#component #tag user-card` → Define pragma syntax for defining things like components and tags, most likely more


```ts
`#component #tag user-card`

const count = signal(0)
const inc = () => count.value++
const template = (): Template => html`<button @click=${inc}>${count.value}</button>`
```

→ becomes the existing class form, verbatim to what works now:

```ts
class UserCard extends Component {
  count = signal(0);
  inc = () => this.count.value++;
  template = () => html`<button @click=${this.inc}>${this.count.value}</button>`;
}
defineComponent('user-card', UserCard);
```

Most likely will need to handle context reference rewrite `this` not an issue.
Have to be aware of module scope and external scopes not to mangle references 🤔

This is just an idea, but do I even need to transpile to a class ?? Maybe not...
One thing I will not compromise on, target data structure has to be `customElement`!!

This will be a headache if I get there 😂❤️😂


## Chores

- [] Why is this static ?? `public static styles?: string[];` styles get adopted in `connectedCallback`
  - [] Leftover from decorator
  - [] Make it non static
  - [] Allow adopting styles during runtime (connected state)
    - [] Use getters and setters
- [] Why the hell do I need direct props 🤔 What's the difference between `.value=${}` and `value=${}` - none
  - [] Kill this thing with fire 🔥🔥🔥
  - [] Unnecessary dance with virtual attr and holes `value=${}` assignment just works in a reactive manner 🤔