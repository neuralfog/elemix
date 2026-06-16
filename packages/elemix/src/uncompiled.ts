export const uncompiled = (name: string): never => {
    throw new Error(`elemix: \`${name}\` is compile-only — run the compiler`);
};
