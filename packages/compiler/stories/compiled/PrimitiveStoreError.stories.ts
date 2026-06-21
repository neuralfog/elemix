import { expect } from 'storybook/test';

// A module-level primitive `#state` is a compile-time ERROR — inlined as a
// module-scope `throw`. We import the compiled module INSIDE the play function
// so the throw is catchable; a top-level import would crash the story module.
export default { title: 'Compiled/PrimitiveStoreError' };

export const InlinedError = {
    render: () =>
        '<pre data-testid="msg" style="margin:0;padding:16px;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;background:#2d1314;color:#f9b4b4;border-radius:8px">importing the compiled module…</pre>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        let caught: Error | null = null;
        try {
            // Evaluating PrimitiveStoreError.ts runs its inlined `throw`.
            await import('./.emited/PrimitiveStoreError');
        } catch (e) {
            caught = e as Error;
        }

        expect(caught).not.toBeNull();
        expect(caught?.message).toContain(
            '[elemix] module-level `#state` must be an object',
        );
        // and it points the user at the fix
        expect(caught?.message).toContain('export const store = { count: 0 };');

        const pre = canvasElement.querySelector('[data-testid="msg"]');
        if (pre) pre.textContent = caught?.message ?? '';
    },
};
