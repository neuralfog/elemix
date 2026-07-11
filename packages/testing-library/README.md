# @neuralfog/elemix-testing-library

Testing utilities for Elemix components: shadow-piercing queries, real DOM
events, and assertions — a self-contained kit, no test framework required.

The API is split across three entry points:

| Import | Provides |
| --- | --- |
| `@neuralfog/elemix-testing-library` | `expect`, `waitFor` |
| `@neuralfog/elemix-testing-library/query` | queries |
| `@neuralfog/elemix-testing-library/events` | events |

## Queries

Elemix renders into shadow roots, so a plain `querySelector` stops at the first
boundary. These helpers walk the whole composed tree — through every open shadow
root — and take native CSS selectors. Every one is generic over the element type.

| Function | Returns |
| --- | --- |
| `find(selector, root?)` | first match, or `null` |
| `query(selector, root?)` | all matches, in tree order |
| `findFirst(selector, root?)` | first match, or `null` |
| `findLast(selector, root?)` | last match, or `null` |
| `findByTestId(id, root?)` | first `[data-testid]` match, or `null` |
| `queryByTestId(id, root?)` | all `[data-testid]` matches |

```ts
import { find, findByTestId } from '@neuralfog/elemix-testing-library/query';

const input = find<HTMLInputElement>('.email', host);
const submit = findByTestId('submit', host);
```

## Events

Real DOM events, dispatched on the real element with `bubbles` and `composed`
set the way a browser sets them — so they cross shadow boundaries and drive
Elemix reactivity, `~model`, and `@event` handlers exactly as a user would.

| Function | Fires |
| --- | --- |
| `type(el, text, init?)` | per character: `keydown` → `beforeinput` → `input` → `keyup` |
| `clear(el)` | empties the value and fires `input` |
| `setValue(el, value)` | sets the value and fires `input` + `change` |
| `click(el, init?)` | `pointerdown` → `mousedown` → `pointerup` → `mouseup` → `click` |
| `dispatch(el, type, init?)` | a real `CustomEvent` |
| `fire(el, event)` | any `Event` you construct yourself |

## Assertions

`expect` is a small, dependency-free matcher set; `waitFor` retries a callback
until it stops throwing (or times out).

| Matcher | Passes when |
| --- | --- |
| `toBe(value)` | `Object.is` equal |
| `toEqual(value)` | deeply equal |
| `toContain(value)` | string includes / array member |
| `toBeNull()` / `toBeDefined()` / `toBeUndefined()` | nullishness |
| `toBeTruthy()` / `toBeFalsy()` | truthiness |
| `toBeGreaterThan(n)` / `toBeLessThan(n)` (and `…OrEqual`) | ordering |

Every matcher negates through `.not`.

```ts
import { expect, waitFor } from '@neuralfog/elemix-testing-library';
import { click, type } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';

type(find<HTMLInputElement>('.name', host), 'Ada');
click(find('.save', host));

await waitFor(() => expect(find('.status', host)?.textContent).toBe('saved'));
```
