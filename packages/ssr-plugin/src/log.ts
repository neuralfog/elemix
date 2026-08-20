const noColor = !process.stdout.isTTY || process.env.NO_COLOR !== undefined;

const paint = (code: string, s: string): string =>
    noColor ? s : `\x1b[${code}m${s}\x1b[0m`;

const violet = (s: string): string => paint('38;2;167;139;250', s);
const dim = (s: string): string => paint('38;2;110;118;129', s);

const BAR = violet('▐▌');

export const log = (message: string): void =>
    console.log(`  ${BAR}  ${dim(message)}`);

export const logError = (message: string, err?: unknown): void => {
    console.error(`  ${BAR}  ${message}`);
    if (err !== undefined) console.error(err);
};
