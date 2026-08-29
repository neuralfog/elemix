const eventHandlerAttributes = (): string[] => {
    const names = new Set<string>();
    for (
        let proto: object | null = globalThis;
        proto !== null;
        proto = Object.getPrototypeOf(proto)
    ) {
        for (const key of Object.getOwnPropertyNames(proto)) {
            if (key.startsWith('on')) names.add(key);
        }
    }
    return [...names];
};

export const navSanitizerConfig = (): unknown => ({
    removeAttributes: eventHandlerAttributes(),
});
