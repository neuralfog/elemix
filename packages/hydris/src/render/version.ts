let assetVersion: string | undefined;
let versionLocked = false;

export const setAssetVersion = (token: string | undefined): void => {
    if (versionLocked) {
        throw new Error(
            'App.version() must be called before App.serve(); the asset version is locked once the server boots.',
        );
    }
    assetVersion = token;
};

export const lockAssetVersion = (): void => {
    versionLocked = true;
};

export const getAssetVersion = (): string | undefined => assetVersion;

export const asset = (path: string): string => {
    if (assetVersion === undefined) return path;
    return `${path}${path.includes('?') ? '&' : '?'}v=${assetVersion}`;
};
