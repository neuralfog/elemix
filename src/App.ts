type AppConfig = {
    cssReset?: string;
    entryPoint?: () => Promise<any>;
};

// biome-ignore lint:
export class App {
    static config: AppConfig = {};

    public static mergeConfigs(config: AppConfig): void {
        App.config = {
            ...App.config,
            ...config,
        };
    }
}

export const initApp = (config: AppConfig): void => {
    App.mergeConfigs(config);
    void App.config.entryPoint?.();
};
