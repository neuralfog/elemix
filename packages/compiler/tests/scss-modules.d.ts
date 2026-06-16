// Ambient type for Vite's `?inline` query on style modules — it resolves to the
// compiled CSS as a string. Lives outside `fixtures/` so the fixture globs
// (`fixtures/*.ts`) don't pick it up; wired into the fixtures typecheck via
// `tsconfig.fixtures.json`.
declare module '*.scss?inline' {
    const css: string;
    export default css;
}
