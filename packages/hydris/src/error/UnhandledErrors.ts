export type UnhandledHandler = (error: unknown) => void;

export class UnhandledErrors {
    private static handler: UnhandledHandler = (error) => {
        console.error(error);
    };

    static setHandler(fn: UnhandledHandler): void {
        UnhandledErrors.handler = fn;
    }

    static handle(error: unknown): void {
        UnhandledErrors.handler(error);
    }
}
