export const ref = <Value>(
    value: Value | undefined = undefined,
): { value?: Value } => {
    return {
        value,
    };
};
