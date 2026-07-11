export interface WaitForOptions {
    timeout?: number;
    interval?: number;
}

export const waitFor = <T>(
    callback: () => T | Promise<T>,
    options: WaitForOptions = {},
): Promise<T> => {
    const timeout = options.timeout ?? 1000;
    const interval = options.interval ?? 50;

    return new Promise<T>((resolve, reject) => {
        const start = Date.now();
        let settled = false;

        const attempt = (): void => {
            Promise.resolve()
                .then(callback)
                .then((value) => {
                    settled = true;
                    resolve(value);
                })
                .catch((error) => {
                    if (settled) return;
                    if (Date.now() - start >= timeout) {
                        reject(error);
                        return;
                    }
                    setTimeout(attempt, interval);
                });
        };

        attempt();
    });
};
