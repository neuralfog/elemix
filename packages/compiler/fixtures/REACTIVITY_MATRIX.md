# Reactivity matrix

Reactivity regressions in elemix almost never show up as a wrong first render.
They show up on the first *mutation after* a structural boundary is torn down or
re-pointed: a conditional flips to null, a list clears, a child is dropped while
it still has live subscribers, a hole that produced a nested template now
produces nothing. Hand-picked feature fixtures render once and assert the HTML,
so they sail past this whole class.

These fixtures are deliberate torture cells. Each one is minimal (no styling),
sits a dynamic hole in a structural position, and drives it through the
transition sequence that exercises teardown. Every cell runs all three lanes:

- **CSR** (`csr-harness`) catches reactive setup/teardown on the client.
- **SSR** (`ssr-harness`, static render) catches render-shape.
- **Hydration** (`ssr-harness`, mutate after hydrate) catches the seam where the
  server DOM meets the client reactive graph. This is where the worst ones hide.

The grid is (hole-content kind) x (structural position) x (transition driven).
The transitions are the point, not the shapes.

## Axes

- **Content kind**: primitive, attribute, bare `tpl`, conditional `tpl:tpl`,
  conditional `tpl:empty`/`tpl:null`, list of primitives, list of `tpl`, list of
  components, child component, reactive slot.
- **Position**: only child, sibling of statics, adjacent sibling holes,
  hole-in-hole, inside a list row, inside a component slot, across a component
  boundary.
- **Transition**: value -> null -> value, empty -> one -> many -> empty, swap,
  reorder, toggle churn, flip inner while outer stays, drop a live child, mutate
  deep field after a toggle.

## Cells

| Fixture | Shape | Drives | Status |
| --- | --- | --- | --- |
| `MxSiblingHoles` | three adjacent holes between statics | each hole tpl <-> null, position stability | built |
| `MxNestedConditional` | conditional inside a conditional | flip inner while outer on, then drop outer | built |
| `MxConditionalChurn` | `cond ? tpl : ''` and `cond ? tpl : null` | repeated mount/unmount churn + live value in branch | built |
| `MxLiveChildTeardown` | conditional branch owns a child component with state | bump child to give it live subs, then drop it, then remount | built |
| `MxTextHole` | primitive hole among statics | value -> null -> value -> empty string -> number | todo |
| `MxAttrHole` | attribute hole next to static attrs | present -> absent -> changed, boolean attr | todo |
| `MxHoleInHole` | bare tpl hole nested in a bare tpl hole | flip inner, then flip outer | todo |
| `MxListTransitions` | keyed repeat of primitives/tpl | empty -> one -> many -> reorder -> swap -> clear -> rebuild | todo |
| `MxListOfComponents` | keyed repeat of child components with state | reorder / swap / remove middle / clear, identity follows key | todo |
| `MxListInConditional` | list inside a conditional | toggle the whole list on/off, mutate while shown | todo |
| `MxConditionalInRow` | per-row conditional inside list rows | toggle per row, reorder rows | todo |
| `MxComponentProp` | reactive prop into a child hole | update prop -> null prop -> swap child instance | todo |
| `MxDeepNest` | conditional -> list -> component -> conditional -> hole | a transition at every depth | todo |

Already covered elsewhere (do not duplicate): single conditional-null deref
(`NullGuardApp`), bare template sibling hydration (`VerbsPanelApp`), tpl-vs-primitive
swap (`DynamicChildApp`), keyed component list static render (`CardListApp`).
