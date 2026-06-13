export const uncompiled = (name: string): never => {
    throw new Error(
        `elemix: \`${name}\` reached the runtime uncompiled — run the elemix compiler over your components.`,
    );
};
