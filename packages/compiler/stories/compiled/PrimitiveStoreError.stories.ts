import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';

export default { title: 'Compiled/PrimitiveStoreError' };

export const InlinedError = {
    render: () =>
        '<pre data-testid="msg" style="margin:0;padding:16px;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;background:#2d1314;color:#f9b4b4;border-radius:8px">importing the compiled module…</pre>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        let caught: Error | null = null;
        try {
            await import('./.emited/PrimitiveStoreError');
        } catch (e) {
            caught = e as Error;
        }

        expect(caught).not.toBeNull();
        expect(caught?.message).toContain(
            '[elemix] module-level `#state` must be an object',
        );
        expect(caught?.message).toContain('export const store = { count: 0 };');

        const pre = find('[data-testid="msg"]', canvasElement);
        if (pre) pre.textContent = caught?.message ?? '';
    },
};
