// Diagnostic fixture: a MODULE-LEVEL `#state` with a bare primitive initializer.
// A module export has no `this` to hang an accessor on, so it can't be made
// reactive single-file — the compiler rejects it and inlines a module-scope
// `throw new Error('[elemix] …')` steering to an object store. (Bare primitives
// are reactive only as component class fields.)

// #state
export const count = 0;
