const g = globalThis as { litIssuedWarnings?: Set<string> };
g.litIssuedWarnings = new Set(['dev-mode']);

export {};
