# Roadmap

Target release of compiled templates `v0.9.0`

![elemix speed benchmark](.roadmap/speed.png)

![elemix memory benchmark](.roadmap/memory-transfer.png)

***Round 2*** 🏆🏆🏆

- Sitting very high on TOP - next to GREATEST `solid`, `ivi` and `svelte` 🙇🙇🙇
- Honestly this was way too easy 😂😂😂 
- Most commercial frameworks just got smoked big time 💨💨💨 React 🔫 - `gitgood` 🤓
- Pulled nice distance from `vue 3` and `lit` ♥️🥹
- No cheating, driving test fully via reactive state - no manual DOM operations 🙅🙅🙅
- Very happy with overall matrix, no yeller or red on any fields 💚💚💚
- Not the fastest, but incredibly consistent across the board 🏅
- `select row` - the fastest, faster than vanilla js ✅
- `smallest bundle` - across the board ✅ - this may change, but in good spot not to overinflate ☑️
- `second` - on first paint ahead of vanilla js ✅
- `lowest memory` after initial page load ✅
- I have to be careful I may spend rest of my life optimising trying to pull ahead 😂😂😂 Too addictive 🚬

- **Only tested selected matrix, the full picture will be visible on full release after `PR` to official repo**

***Officially not a slop, satisfied with results so further work will continue***

![batman vs mutant](.roadmap/batman-batman-vs-mutant.gif)

🦇🦇🦇

## Resolve Identity Crisis - What the hell is this ⁉️🐦‍🔥

- `customElements` rocks!! 🎸🤘
- This is not a framework, it's a library at best. Frameworks get in the way 🚷
- Opt-in reactivity, drive your own updates if you like 🏇
- `AOT` compiled templates with minimal runtime
- Be in charge of architecture 🌉
- Single dependency or bundle at runtime without any sub dependencies (no vulnerabilities nightmares) 👹
- `Constructable Stylesheet` API 💅
- Freedom - good library, framework or api does not get in the way - wishful thinking in the current state of
  the affairs and tooling 🤮
- Full encapsulation with `ShadowDOM`
- Will work in any environment, it is just augmented `HTML` node - Vue, React whatever 🤷
- `css` is just a string that gets adopted, use what ever you want 🤷
- `Reactive Elements` - CustomElements are amazing, Google claimed `WebComponents` don't want to touch that 😒
- Few primitives and you can do more than others. `state`, `ref` and `component` FINITO!! 🤌
  Anything else just write it, or `gitgood`
- Part of the native DOM flow `customElements` are just DOM nodes 🤏
- Native web is amazing, not the freaking abominations 🧟 that industry is pushing on me 🚫🚫
- Simpler API the better LLM can work with it 🤖

## Know the Limitations 🏁🏁

- High chances of clashing with native `HTMLElement` properties, not a biggy. Typescript catches it cleanly 🥅
- Class based API, not a problem is just how Web Platform works end of story 🏁 May change in the future 🧐
- Template primitives only work in the context of library, there is no issue with attributes
  May add special `attr` that will redirect in to props of the `:host`, actually this should be EZ 🤌
- At the moment still closely coupled with typescript, slowly going away from that so `js` should be supported
  sooner than later
- SSR - I don't give a flying `&*%*%*&` - is not a problem at all. `customElements` are notoriously difficult
  to fully server render 😒 Yeah, return `HTML` from server == `SSR` 😂 May poke at this in the future seems
  like interesting problem to have 🧐
- Tooling targeted at CLIs, don't have time to deal with editors - last thing I need in my life is to work with
  junk like (VSCode plugin eco system🤮)
- SPA don't care - what's the point ⁉️ If you really want to push it just use something from `npm` black hole 😂⚫

## TODOS

- [] Full release of `v0.9.0` and let's make it official 🎉🎉🎉
- [] Add banner to rust cli - omit for --stdin
- [] Add elemix to official benchmarks
- [] WASM package needs its own readme 🤔
- [] Poke at sourcemaps at some point ⏰️⏰️
- [] Design `compiler hints`
- [] Design a feature `analyzer` for templates `prop` typechecking `cli` only!!
  - [] Do I want analyzer in `v0.9.0` or defer it to => `v1.0.0` 🧐
  I have a repo in graveyard already in `typescript` 🤔
  - [] Also is this going to live in compiler or separate module

### Phase 6 - Close the release of v0.9.0 ❎

- [] Now I need a logotype or logo FML ☹️
- [] Update playground with WASM compiler
  - [] Update all examples with updated API, add new and maybe remove some
  - [] Playground needs some cleanup, better file management for examples, atm just a giant file 🤮
- [] Put a website at `elemix.dev`
- [] Update all `README` files at the moment is just autocomplete filler from the `minion` 🤖
- [] Add template repo 📍

### Phase 5 - General Polish And Wrinkle Ironing ⛓️‍💥

***Resiliance ⚙️⚙️⚙️***

- Statments before return in template procedure has been stripped, this has been fixed with
  prelude in rewrite stage 🥇
- So far hasn't seen any issues related to hoisting post compilation 🤔

***Computed Properties 🧮🧮🧮***

- No need for it, native getters do the job just fine `get test() {}`
- We have manual way to drive updates `this.render()` if nescessary
- The mechanic: the view's effect subscribes to whatever it reads through tracked getters. So:

```ts
get total() { return this.state.qty * this.state.price; }   // ✅ reads state → reactive
get total() { return this.qty * this.price; }               // ❌ plain fields → computes once, NEVER updates
```
- In the ❌ case the getter still runs and returns the right number on first paint, but nothing tracked it, so
  changing `this.qty` later won't re-run the view. This is by design 🎨
- At least one value in getter has to come from a reactive source ☢️
- Chains fine too: a getter reading another getter just works ⛓️

***Releae Pipeline Fixed 🪚🪚🪚***

- Entire pipeline reworked to fail early ❌
- `npm` packages will be only published if all artifacts available 📦
- Hopefully no more partialy released packages 🙏
- `RELEASE-PIPELINE.md` 🗺️

***Compiler Hints #⃣️#⃣️#⃣️***

- For time being the simplest possible solution to serve sole purpose of replacement for class decorator
- `#component` auto registers the component inlining `defineComponent` procedure, if no tag name will 
  be derived from class name. This was a headache in runtime as I had to preserve class names otherwise
  mangling would screw references, not an issue any more. If class named incorectly `defineComponent` will
  throw from custom element registry level 💥 May need to handle it gracefully, later when extending `compalerino`
  capabilites.
- `#tag my-component` defines tag name for custom element #⃣️
- `#styles ${css}` allows setting styles on component previously handled by static class field 💅
- `#form` registers component as form member ✍️
- The nice thing about going with string literals is that I can have dynamic values, also this is valid syntax
  in js world 🪐
- All fixtures are using new syntax now #⃣️

- [] `Compalerino` resilience
  - [] Pass file for transpilation based on the existence of compiler hint ⁉️
  - [] Multiple components per file

### Phase 4 - Put it through its paces - BENCH Round 2 🔔🔔🔔

***Optimisation Phase ⚙️🔨🪛***

- Bundle size `2.74kB` - most likely final form 😰
- Optimised a lot, emitted code and some obvious things in runtime, but this gets to the point that is very hard
  to move a needle and everything just becomes a trade off... I will park it here 🙂‍↕️🙂‍↕️

***Update Personal Perf Repo 🏁🏁🏁***

- All dependencies updated and there were no issues whatsoever with anything, shite 💩 just works 🤓
- Compilation with vite plugin just works, no hiccups whatsoever ⚙️
- HMR just works with `compalerino` 🙌😎
- Single `state` instead of `signal` was a good choice, there is also no shitty 💩 `foo.value` all over the place, this
  feels clean now ✨
- Cleaned up export barrels, so much better 🏋
- App feels way snappier than before, feels good!! 👌
- Chrome performance, first paint dropped by a mile 🚗
- Memory profile also looks better at a glance 🕵 Will do more digging later 🧠🧠🧠
- Ticks are a tad slower on 10k compared to the old renderer, but hey who the hell renders 10k components with ticking state
  (`animationFrame`) on every component coming from 3 different sources 😂 Yeah try having that in React - good luck 🍀

## Compiler - We don't React. We compile. 😂😂😂

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

- The whole `compalerino` served as a WASM module 🕸️🦀 playground can transpile on every keystroke 🤯
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
  Deleting code is my favourite activity.
- Full integration testing happens in the compiler package, rust unit tests, compiler output. Compiled components
  passed through `typescript` and exhaustively tested for interaction with storybook.
- The idea of snapshotting was kinda cute, well, it did not work. I caught 3 different bugs related to emitted code by running
  components in a real browser environment 💪💪💪
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
- Rewritten reactivity model heavily inspired by Solid that just works. Channeling Ryan Carniato.
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

## DONE

- [x] (Not relevant anymore - gone with new architecture) Why the hell do I need direct props 🤔 What's the difference between `.value=${}` and `value=${}` - none
  - [x] Kill this thing with fire 🔥🔥🔥
  - [x] Unnecessary dance with virtual attr and holes `value=${}` assignment just works in a reactive manner 🤔
- [x] Rust 🤮 + OXC the javascript toolchain - battle tested, there is no better alternative
  - [x] Unless I go my own way and write it from scratch in Zig, Odin or OCaml 😂
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
- [x] Release v0.9.0-dev.0
- [x] Update `perf` personal repo with new toolchain and compiled version of framework ⚡️⚡️
- [x] Got to check behaviour of vite plugin on more complicated projects - many files etc - Just works!!
- [x] Render Cost Table looks suspicious - 4 nodes have been touched on moves, I'm pretty sure it should be just 2 🤔
  There was a bug!! 🐛🐛🐛
- [x] `onMutation` - Hmmm... Added for one specific reason, detect DOM mutations in an async context, do I still need this ??
    Renderer is fully sync now, what it should be, no `ticking`, no waiting 🤔 - has been removed, not needed anymore!
- [x] At the moment the reactivity primitive is running off `defineProperty`, maybe better to swap to proxy. - Not an issue at all!! 🚝🚝🚝
- [x] Run official benchmarks and 👀👀

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
  - [x] I am bringing bigger guns this time
    - [x] Now we are going after the rest of the party!!
    - [x] Benchmark is purely focused on hyper optimisation for list rendering, so yeah, tuff!! 😂😂😂

- [x] Near native performance going through thin layer of reactivity - well most likely not 🤔 Close enough 🎉
- [x] Memory will drop drastically ✅
- [x] Time to first paint should drop as there is less setup code before component mounts (no more template
  evaluation and tracking) ✅
- [x] Why is this static ?? `public static styles?: string[];` styles get adopted in `connectedCallback`
  - [x] Leftover from decorator
  - [x] Make it non static
  - [x] Allow adopting styles during runtime (connected state)
    - [x] Use getters and setters

- [x] Compiler hints (macros #⃣️) 🧐
  - [x] Syntax have to pass typescript typechecking phase - most likely `#component` <= This is just a valid string 🤔
  - [x] No special syntax - don't care about editors so it has to just work 🔩
  - [x] Do I make macros position line independent, maybe (global and line specific ones) ⁉️🧐
  - [x] Architecture for this has to be clean AF - ability to easily extend
    - [x] For now 2 types of macros `global` and `positioned`
  - [x] This will resolve two issues at once
    - [x] Decorators are Typescript dependent and stink 🦨
    - [x] Automatic component registration with tags derived from component classes, no more issue with name `mangling`
      after bundling
- [x] Release pipeline is junky ♻️ Mostly works... The order is not correct
  - [x] Organize workflows in to nicer dependency chain
- [x] Do I need concept of `computed(() => {})` ⁉️🧐 Don't really want it... Dig in to it 🪏 Proof the
  concept, otherwise add `computed` 🤮 The issue here - architecture has changed, the concept of computation
  was not needed before 🧐
- [x] Object destructuring in template procedure, this should already work 🤔