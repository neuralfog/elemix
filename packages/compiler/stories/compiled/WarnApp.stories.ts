import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';

// A compile-time WARNING (a tag with no hyphen) is inlined as `console.warn`.
// The component still compiles and tries to register — but the invalid tag makes
// `customElements.define` throw, which is exactly what the warning predicted. We
// spy on console.warn and import inside play so both are observable.
export default { title: 'Compiled/WarnApp' };

export const InlinedWarning = {
    render: () =>
        '<pre data-testid="msg" style="margin:0;padding:16px;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;background:#2d2a13;color:#f0e0a0;border-radius:8px">importing the compiled module…</pre>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const warnings: string[] = [];
        const original = console.warn;
        console.warn = (...args: unknown[]): void => {
            warnings.push(String(args[0]));
        };

        let registrationThrew = false;
        try {
            // The module logs the warning (top of file), then `define('warnapp')`
            // throws on the invalid name.
            await import('./.emited/WarnApp');
        } catch {
            registrationThrew = true;
        } finally {
            console.warn = original;
        }

        expect(
            warnings.some((w) =>
                w.includes(
                    '[elemix] WarnApp: tag `warnapp` is not a valid custom element name',
                ),
            ),
        ).toBe(true);
        // the warning was right — the runtime registration really does throw
        expect(registrationThrew).toBe(true);

        const pre = find('[data-testid="msg"]', canvasElement);
        if (pre) pre.textContent = warnings.find((w) => w.includes('[elemix]')) ?? '';
    },
};
