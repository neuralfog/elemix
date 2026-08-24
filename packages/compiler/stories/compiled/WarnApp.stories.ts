import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';

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
        expect(registrationThrew).toBe(true);

        const pre = find('[data-testid="msg"]', canvasElement);
        if (pre) pre.textContent = warnings.find((w) => w.includes('[elemix]')) ?? '';
    },
};
