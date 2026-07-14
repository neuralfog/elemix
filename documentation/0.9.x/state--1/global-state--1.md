# Global State

For state shared across components, export a reactive store from a module and read
it from any component's template. Mutating the store re-runs every binding that
depends on the changed cell, wherever it lives.

```elemix
// store.ts
import { state } from '@neuralfog/elemix';

// #state
export const store = state({ theme: 'dark' });
```

Any component can read `store.theme` in a template and stay in sync — no provider,
no context, no wiring.
