import { expect, userEvent, waitFor } from 'storybook/test';
import './.emited/AsyncApp';

export default { title: 'Compiled/AsyncApp' };

export const Default = {
    render: () => '<async-app></async-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('async-app');
        if (!app) throw new Error('async-app did not render');
        const root = app.shadowRoot;
        if (!root) throw new Error('async-app has no shadow root');

        // async #before-mount ran to completion — the value it set *past* its
        // `await` is what we see, proving the async tail executed.
        await waitFor(() =>
            expect(app.getAttribute('data-prepared')).toBe('async'),
        );

        // async #mount mutated reactive state across an `await` — the template
        // re-rendered, settling on the post-await value.
        await waitFor(() =>
            expect(root.querySelector('.phase')?.textContent).toBe('ready'),
        );

        // async #effect tracked `state.phase` (read before its `await`), so it
        // re-ran on every change and its async tail mirrored the final value.
        await waitFor(() => expect(app.getAttribute('data-phase')).toBe('ready'));

        // sync reactivity is untouched by the async hooks — a click still
        // re-renders synchronously.
        await userEvent.click(root.querySelector('.bump') as HTMLButtonElement);
        expect(root.querySelector('.ticks')?.textContent).toBe('1');
    },
};
