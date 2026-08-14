export type UnhandledHandler = (error: unknown) => void;

let handler: UnhandledHandler = (error) => {
    console.error(error);
};

export const setUnhandledHandler = (fn: UnhandledHandler): void => {
    handler = fn;
};

export const handleUnhandled = (error: unknown): void => {
    handler(error);
};
