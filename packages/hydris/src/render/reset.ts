let resetStyles: string | undefined;

export const setResetStyles = (css: string): void => {
    resetStyles = css;
};

export const applyResetToSsr = (html: string): string =>
    resetStyles === undefined
        ? html
        : html.replaceAll('<style data-ssr>', `<style data-ssr>${resetStyles}`);

export const resetDocumentStyle = (): string =>
    resetStyles === undefined ? '' : `<style>${resetStyles}</style>`;

export const resetConfigScript = (): string =>
    resetStyles === undefined
        ? ''
        : `<script>window.__elemix__=window.__elemix__||{};window.__elemix__.config=window.__elemix__.config||{};window.__elemix__.config.reset=${JSON.stringify(
              resetStyles,
          )}</script>`;
