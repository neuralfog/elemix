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
  - [] Benchmark is purely focused on hyper optimisation for list rendering, so yeah, tuff!! 😂😂😂

**If goals cannot be achieved, further work will be terminated as there is no point working on slop**

## Compiler - We don't React. We compile. 😂😂😂

☄️ It just happened. This just works 🥸

Target release of fully compiled framework is `v0.9.0`

## TODOS

- [] WASM package needs it's own readme 🤔
- [] Poke at sourcemaps at some point ⏰️⏰️
- [] `onMutation` - Hmmm... Added for one specific reason, detect DOM mutations in an async context, do I still need this ??
    Renderer is fully sync now, what it should be, no `ticking`, no waiting 🤔
- [] Design `compiler hints`
- [] At the moment the reactivity primitive is running off `defineProperty`, maybe better to swap to proxy.

### Phase 4 - Put it through its paces - BENCH Round 2 🔔🔔🔔

- [] Release v0.9.0-dev.0
- [] Update `perf` peronal repo with new toolchain and compiled version of framework ⚡️⚡️
- [] Got to check behaviour of vite plugin on more complicated projects - many files etc
- [] Render Cost Table looks suspicious - 4 nodes have been touched on moves, I'm pretty sure it should be just 2 🤔
- [] Run official benchamrks and 👀👀

### Phase 3 - Why would you use a fork for eating soup 🍴 Packaging and Tooling 🛠️

***Compiler As Vite Plugin 🥷🥷🥷***

- Closes the tooling chain 🔗 write `tpl` templates, vite compiles them on the fly as it loads each module - compile step invisible 🥷
- Drives the NATIVE binary 🚤🚤🚤
- Native CLI got a new `--stdin` mode 🚰 pipe source in 🪠🪠🪠
- Ships as `@neuralfog/elemix-vite` 📦 native compiler a dependency, `vite` a peer
- One tag rules them all 💍 a single `v*` tag fires BOTH the compiler + vite releases; vite waits for the compiler to land on npm
  first so an installer never sees a missing dependency ⏳
- The compiler dependency is auto-stamped to the release version during the workflow run 🤖 the plugin always pins the exact
  compiler build it ships with
- Release pipeline mapped in `RELEASE-PIPELINE.md` 🗺️
- Proven end to end via the throwaway repo `https://github.com/neuralfog/test-compiler` 🗑️ `pnpm prove:vite` builds a real component
  through the published package
- No source maps yet 🗺️❌ compiled output maps to `view()`, not the original `tpl`
- HMR not explicitly tested 🤔 transform re-runs per load so it should work, just unverified

***Compiler as WASM ⚙️⚙️⚙️***

- The whole `compalerino` served as WASM module 🕸️🦀 playground can transpile on every keystroke 🤯
- Went single crate, feature gated - no crate split shenanigans, simplicity wins 🧈
- `compile()` is pure `oxc`, zero IO, so it crosses the wasm boundary squeaky clean - only the filesystem/CLI
  bits (`clap`, `glob`, file scanning) get gated out behind a feature 🚪
- `wasm-pack` + `wasm-opt` spit out a tidy `--target web` package, squashed down to `~697kb` from a chunky 32MB debug blob 🪓🔥
- Ships as its own npm module `@neuralfog/elemix-compiler-wasm` 📦
- WASM output is BYTE for BYTE identical to native across all 37 fixtures 🧬 if it ever drifts the snapshots will scream 😲🔫
- Panic free on half typed garbage - `oxc` just shrugs and passes the source through, the module never dies 🛡️
  exactly what I need when the playground hammers it per keystroke ⌨️
- Final boss 🐉 a storybook story compiles a component INSIDE a real browser, compiled output rendered live on screen - wasm proven
  in its natural habitat 🦇
- Hooked into the test pipeline + CI, and publishes on the same `tag`
- Testing pipeline mapped in `COMPILER-TESTING-PIPELINE.md` 🗺️
- Channel delivery proven end to end via the throwaway repo `https://github.com/neuralfog/test-compiler` 🗑️
- Rust finally gets linted 🦀💈 The audacity 🙈

***Compiler Packaging 📦📦📦***

- Compiler now ships as an npm module `https://www.npmjs.com/package/@neuralfog/elemix-compiler` 📦
- Tightening the release process as we go, moving to `tag`-based releases 🏃🏾‍♂️🏃
- Compiler ships as an executable across the entire matrix of operating systems and CPU architectures 🤓
- Directives and the template definition `tpl` tag have been turned into compiler-only macros ✨
  JS will throw if any bleed into post-compiled sources 🥷🥷🥷
- Removed any traces of reflection from the codebase 🔥🔥🔥 What's the point in this case ⁉️
- Dropped `changeset` package 🤢 in favour of a few scripts
- Further defining the testing pipeline, now typechecking happens on fixtures which are user-defined
  components that still need to pass `Typescript` typechecking for correctness. Additionally I locked
  the output of `emitted` files with snapshots for further resilience. If anything changes, I need
  to know about it 😲🔫
- Fully tested `dev` version of compiler delivered via the `npm` channel on different OSes and CPUs via
  a temporary repo: `https://github.com/neuralfog/test-compiler` 🚅🚅
- Fixed an issue with imports for `tpl` during the rewrite stage in compalerino 🎯
- Bundle size back to `2.67kb`
- Minion has been invaluable, it earns its keep 💰

### Phase 2 - Compiler Implementation 🦀🦀🦀

This went better than I expected:
- Almost all tests in elemix have been removed now, decided to keep only tests related to package orchestration
  and render cost, old tests got me here, but they were only transient. So smash that delete button big time.
  Deleting code my favourite activity.
- Full integration testing happens in the compiler package, rust unit tests, compiler output. Compiled components
  passed through `typescript` and exhaustively tested for interaction with storybook.
- The idea of snapshotting was kinda cute, well, it did not work. I caught 3 different bugs related to emitted code by running
  components in real browser environment 💪💪💪
- Treat it as a first unoptimised pass - we will see what the benchmarks say, not getting my hopes up 🙈
- Entire runtime has been dropped 🌟
- Open for possibilities of custom `pragma like` hints that will be trivial to implement ❤️
- Best example I can think of replacing freaking decorators with custom compiler hints (in the end I get what I want
  just better and no coupling to typescript 🤮❤️)
- OXC does all the heavy lifting for me - tooling is absolutely amazing to work with, in opposition to trying to hook into
  the `typescript` compiler workflow with some shitty plugins that break on every release - what a joke!! 💩💩💩 Saying that
  I most likely will have to poke at that shite again... 💀🔫 FML
- Removed testing package 🥹 That stuff did some real heavy lifting 💪
- Repository is in an approved state to be merged to the main branch 🚀🚀🚀
- All work done in the past is not lost (interpreted renderer). If not for that, I would not be able to move to a compiled workflow,
  not to mention benefits like establishing an almost-final api and battle testing the concept 🥹🪦
- Most of the work that the compiler does is derived from the old `renderer` ❤️ The only reason why this happened so quickly ⚡
- Prototype => Proof => Compiler 🚀🚀
- All marker nodes have been dropped, on a 10k list this will have a big impact - 2 holes per row 20k redundant DOM nodes 💥💥💥
- Further tightening of public facing API
- Unified concept of state single `state()` for internal and global state definition
- Divorced from `html` notation for templates - that's Lit; this is not Lit, so `tpl` 🚀
- Bundle size down to `2.56kb` - not bad at all 😎😎😎
- Will the prerelease need a convention like `alpha` or `experimental`?

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
  heart surgery 😂 "This is an operating table and I am the surgeon here..." 🦇 I am batman 😂
  Note to self insanity levels increasing 😂😂😂
- All the render code has been eliminated - no more baggage
- All reactivity code has been replaced with simplified model based on concept of the `effect`
- By deleting all the code final bundle size dropped to `2.67kb` without any feature loss 🌟
- Reduced number of classes to 1, can't get away from that... I need super daddy to extend from.
- Readability and maintainability of the codebase are incomparable, code is crystal clear 💎
- Reactivity primitive and `effect` system already tested and validated by reproducing playground
  apps and a few more to get a wider surface for compiler implementation.
- Hand rolling compiled components surfacing the final output created a contract that the compiler has to
  conform to.
- Directives will become noop macros just for the compiler, and will not be shipped in the final bundle.
- No more messing with template literals, `tpl` becomes a template for the compiler only, no more
  template literals at runtime ❤️
- LLM has been invaluable here with proper instrumentation I have generated implementation surface
  very quickly, would take me ages to type it all in ☠️ That includes `golden` components and
  stories running in real browser within storybook to assert behaviour
- Managed to repurpose LIS algo and list reconciliation

### Assumptions

- [] Near native performance going through thin layer of reactivity - well most likely not 🤔
- [] Memory will drop drastically
- [] Time to first paint should drop as there is less setup code before component mounts (no more template
  evaluation and tracking)

**Proceed to next stage only if happy with compiler workflow and benchmark results**

## Composition Like Api - Module as component - bit like svelte

Brief idea:

`#component #tag user-card` → Define pragma syntax for defining things like components and tags, most likely more


```ts
`#component #tag user-card`

const count = signal(0)
const inc = () => count.value++
const template = (): Template => tpl`<button @click=${inc}>${count.value}</button>`
```

→ becomes the existing class form, verbatim to what works now:

```ts
class UserCard extends Component {
  count = signal(0);
  inc = () => this.count.value++;
  template = () => tpl`<button @click=${this.inc}>${this.count.value}</button>`;
}
defineComponent('user-card', UserCard);
```

Most likely will need to handle context reference rewrites - `this` is not an issue.
Have to be aware of module scope and external scopes so as not to mangle references 🤔

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
- [x] Need to define `tpl` type for user to define templates
- [x] The whitespace rule has not been exercised yet...
- [x] All the tests are broken at the moment while migrating, they will be invaluable as a final boss to make sure there is no regression.
- [x] Semantics polish: state and signal are both functions now, conceptually there is no difference between the two.
  Stick with one or the other most likely `state()`, signals are a Solid thing...
- [x] Package compiler with multi-arch support via npm
- [x] Most likely need another two packages derived from compiler
- [x] Exe shipped as npm module
  - [x] Same as tsc, accepts params and configs etc
  - [x] Delivery of different CPU architectures should not be an issue
  - [x] Where do I spit the files, do I augment the original files and spit them out to the `.cache`
    directory ?? 🤔
  - [x] 2-pass compilation process, `elemix compiler` => tsc => js 
- [x] Turn `tpl` and directives into noop macros!
- [x] `tpl` needs to be exportable from the `elemix` package for proper typechecking
- [x] Typecheck fixtures as part of test
- [x] `tpl` import needs to be stripped once post-processed
- [x] Lock the emitted output of components with fixtures
- [x] I am using `Reflect` purely as a stylistic choice, may add a few nanoseconds as it is an additional function call.
  Most likely not an issue... - Killed with fire 🔥🔥🔥
- [x] Automate version management for the compiler
- [x] Tag management
- [x] Approve compiler packaging for `main` landing 🚀
- [x] `ec-wasm` needs to be able to transpile on `playground`
- [x] Rust compiles to wasm - first class support - can still use it in playground
- [x] Most likely `ec-vite` plugin, got to find a way to make compilation as painless and invisible as possible
    vite plugin is a good candidate here, we can hook into the `vite` compilation process, I did it before
- [x] Compiler `cli` may change based on two requirements above - Yes it did 😂
- [x] In theory this should be the easiest part, hard work is done!! 🚀🚀🚀 EZ just ton shite of work 💩💩💩
- [x] Streamline release with tags ✅
- [x] Finish single tag release for all packages, automated publishing via github actions
- [x] Add changelogs, refer to `https://github.com/brownhounds/migoro` for a full implementation with releases and workflows