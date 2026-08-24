import { jsonIsland } from './island';

let resetStyles: string | undefined;

export const setResetStyles = (css: string): void => {
    resetStyles = css;
};

export const applyResetToSsr = (html: string): string =>
    resetStyles === undefined
        ? html
        : html.replaceAll('<style data-ssr>', `<style data-ssr>${resetStyles}`);

export const resetDocumentStyle = (): string =>
    resetStyles === undefined ? '' : `<style data-reset>${resetStyles}</style>`;

export const resetConfigScript = (): string =>
    resetStyles === undefined ? '' : jsonIsland('__elemix_reset', resetStyles);
