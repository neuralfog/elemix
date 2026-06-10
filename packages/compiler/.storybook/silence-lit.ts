// Silence the "Lit is in dev mode" banner — @storybook/web-components-vite
// pulls lit-html in for its own rendering even though elemix doesn't use it.
const g = globalThis as { litIssuedWarnings?: Set<string> };
g.litIssuedWarnings = new Set(['dev-mode']);

export {};
