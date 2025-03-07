import { activeRenderers } from './renderers';

export const ref = <Value>(
    value: Value | undefined = undefined,
): { value?: Value } => {
    return {
        value,
    };
};

export const fastUID = (): string =>
    Math.floor(performance.now() * 1000).toString(36) +
    Math.random().toString(36).slice(2, 6);

export function render(): Promise<boolean> {
    return new Promise((resolve) => {
        const check = () => {
            if (activeRenderers.size === 0) {
                resolve(false);
            } else {
                setTimeout(check, 0);
            }
        };
        check();
    });
}

export const camelToKebabCase = (input: string): string => {
    return (
        input.match(
            /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|[0-9]*$)|[A-Z]?[a-z]+|[A-Z]|[0-9]+/g,
        ) || []
    )
        .map((x) => x.toLowerCase())
        .join('-');
};
