# Roadmap

## Goals

***Round 1***

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
  - [x] I was winning in the memory department by a mile, but
    - proxy removal
    - automatic memo for list rendering and identity keys
    caused a massive memory spike, a lot of tracking and object retention 😬

  - [x] Framework/Lib Api has been frozen - I don't want any more changes we are in a good spot

### I have beaten react to the ground!! My life work is complete!! 😂😂😂

***Round 2***

- [] I am bringing bigger guns this time
  - [] Now we are going after the rest of the party!!

**If goals can not be achieved, further work will be terminated as there is no point working on slop**

## Compiler - We don't React. We compile. 😂😂😂

WIP - fading in to reality

This will work better than I thought massive wins already 🥸

Target release of fully compiled framework is `v0.9.0`

### Phase 1 - Get ready before fun starts

What went well:
- All the tests and apps - playground, perf and stealth app containing more than 100 components
  created a nice contract that is hard to break
- Runtime layer was a good idea - exposing a minimal integration layer that generated code
  can call into, this will simplify code generation as the contract is already established
- Rewritten reactivity model heavily inspired by solid that just works. Channeling Ryan Carniato.
  There is no need to reinvent the wheel.
- I had a completely different idea of how to handle generated code, it was supposed to be a bolt on
  for existing instances... Well rewrite in place - basically trying to do zero cost abstraction here.
  Lower down to native code as much as possible.
- Ripping off the bandaid and literally starting from scratch. Best decision ever. Performed open
  heart transplant 😂 "This is an operating table and I am the surgeon here..." 🦇 I am batman 😂
  Note to self insanity levels increasing 😂😂😂
- All the render code has been eliminated - no more baggage
- All reactivity code has been replaced with simplified model based on concept of the `effect`
- By deleting all the code final bundle size dropped to `2.67kb` without any feature loss 🌟
- Reduced amount of classes to 1, can't get away from that... I need super daddy to extend from.
- Readability and maintainability of the codebase are incomparable, code is crystal clear 💎
- Reactivity primitive and `effect` system already tested and validated by reproducing playground
  apps and few more to get wider surface for compiler implementation.
- Hand rolling compiled components surfacing the final output created a contract that the compiler has to
  conform to.
- Directives will become noop macros just for compiler, will not be shipped in final bundle.
- No more messing with template literals, `html` becomes a template for compiler only, no more
  template literals during run time ❤️
- LLM has been invaluable here with proper instrumentation I have generated implementation surface
  very quickly, would take me ages to type it all in ☠️ That includes `golden` components and
  stories running in real browser within storybook to assert behaviour
- Managed to repurpose LIS algo and list reconciliation

### Assumptions

- [] Near native performance going through thin layer of reactivity
- [] Memory will drop drastically
- [] Time to first paint should drop as there is less setup code before component mounts (no more template
  evaluation and tracking)
 
## TODOS

- [] All the tests are broken at the moment while migrating, they will be invaluable as a final boss to make
  sure there is no regression.
- [] At the moment reactivity primitive is running of `defineProperty`, maybe better to swap to proxy.
- [] I am using `Reflect` purely stylistic choice, may add few nanoseconds as is additional function call.
  Most likely not an issue...
- [] Need to define `html` type for user to define templates
- [] The whitespace rule has not been exercised yet...

- [ ] Exe shipped as npm module
  - [ ] Same as tsc, accepts params and configs etc
  - [ ] Delivery of different CPU architectures should not be an issue
  - [ ] Rust compiles to wasm - first class support - can still use it in playground
  - [ ] Where do I spit the files, do I augment original files and spit them out to `.cache`
    directory ?? 🤔
  - [ ] 2 pass compilation process, `elemix compiler` => tsc => js 

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


## DONE

- [x] (Not relevant anymore - gone with new architecture) Why the hell do I need direct props 🤔 What's the difference between `.value=${}` and `value=${}` - none
  - [x] Kill this thing with fire 🔥🔥🔥
  - [x] Unnecessary dance with virtual attr and holes `value=${}` assignment just works in a reactive manner 🤔

- [x] Rust 🤮 + OXC the javascript toolchain - battle tested, there is no better alternative
  - [x] Unless I go my own way and write it from scratch in Zig, Odin or Ocaml 😂
  - [x] Not sure if it's worth the pain though when I have a toolchain that I can use off the shelf
  - [x] Dependency chain is not an issue as I can freeze version by compiled executable

- [x] Api has to stay unchanged - this is a must!!
  - [x] Manual render `this.render()`
  - [x] State, signals, and props
  - [x] Apart from small changes like removing virtual attributes and moving statics!

- [x] Main goals
   - [x] Can we increase speed, although we are close to the limitations of native DOM operations 🎉
   - [x] Literal milliseconds do not matter on row swaps etc. This is faster than it has to be!!
   - [x] Freedom and api is what matters

- [x] Memory usage, this is a clear win
- [x] Initial bundle size should drop, I would want to be in the range of 3 - 4kb ideally not 6.7kb 😬
- [x] Generated code will add some weight, but this will be application code, reused by component instances...
- [x] Downside, a build step, although this is not an issue at all as it already goes through typescript
- [x] Compiler first architecture opens some crazy opportunities later down the line ❤️

- [x] Code is kinda shite right now... 💩 This is clearly going in the direction of an effect (FP, OCaml, Solid) λ λ λ λ λ λ
  - [x] Using generated code spat out from the compiler should make code a lot more readable and maintainable
  - [x] Most likely all runtime code responsible for template evaluation will be gone or most of it
  - [x] Same will apply to state, right now it is a hybrid between coarse rendering and granular observables with
    versioning and dirty flags - big mountain of crap in the middle of a clean room 🤮😂 It works though...

- [x] Evaluate the compiler, otherwise kill it with fire 🔥🔥🔥 Entire thing!! - Yeah it will work...