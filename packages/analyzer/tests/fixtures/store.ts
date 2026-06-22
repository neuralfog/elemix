// A module-level `#state` store must hold an OBJECT. A bare primitive export
// can't be reactive single-file — the analyzer must steer it to an object store.
// #state
export const count = 0;

// #state — valid: an object store.
export const settings = { theme: 'dark', count: 0 };
