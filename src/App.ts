// TODO: Come back to this
// cssReset stupid idea, better to have more generic list of styles instances
// that get passed to every component
//
// Does it have to be a class ?? I do like it though LOL
// what is that entry point for, was that for router ? :shrug:
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
