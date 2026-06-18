import { expect } from 'storybook/test';

// A compile-time ERROR (unknown pragma) is inlined as a module-scope `throw`.
// We import the compiled module INSIDE the play function so the throw is
// catchable — a top-level import would crash the whole story module instead.
export default { title: 'Compiled/ErrorApp' };

export const InlinedError = {
    render: () =>
        '<pre data-testid="msg" style="margin:0;padding:16px;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;background:#2d1314;color:#f9b4b4;border-radius:8px">importing the compiled module…</pre>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        let caught: Error | null = null;
        try {
            // Evaluating ErrorApp.ts runs its inlined `throw new Error(...)`.
            await import('./.emited/ErrorApp');
        } catch (e) {
            caught = e as Error;
        }

        expect(caught).not.toBeNull();
        expect(caught?.message).toContain(
            '[elemix] ErrorApp: unknown pragma directive `#frobnicate`',
        );

        const pre = canvasElement.querySelector('[data-testid="msg"]');
        if (pre) pre.textContent = caught?.message ?? '';
    },
};
