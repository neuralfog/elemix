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
  - [] I was winning in memory department by a mile, but
    - proxy removal
    - automatic memo for list rendering and identity keys
    caused massive memory spike, a lot of tracking and object retention 😬

  - [x] Framework/Lib Api has been frozen - I don't want any more changes we are in the good spot

### I have beaten react to the ground!! My life work is complete!! 😂😂😂

**If goals can not be achieved, further work will be terminated as there is no point working on slop**

## Compiler - We don't React. We compile. 😂😂😂

WIP - experimental

- [] Main goals
   - [] Can we increase speed, although we close to the limitations of native DOM operations 🎉
   - [] Literal milliseconds do not matter on row swaps etc. This is faster than it has to be!!
   - [] Freedom and api is what matters

- [] Memory usage, this is a clear win
- [] Downside, a build step, although this is not an issue at all as it already goes through typescript
- [] Compiler first architecture opens some crazy opportunities later down the line ❤️

**Proceed to next stage only if happy with  compiler workflow and benchmark results**

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