import { expect, waitFor } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/AsyncApp';

export default { title: 'Compiled/AsyncApp' };

export const Default = {
    render: () => '<async-app></async-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('async-app', canvasElement);
        if (!app) throw new Error('async-app did not render');

        // async #before-mount ran to completion — the value it set *past* its
        // `await` is what we see, proving the async tail executed.
        await waitFor(() =>
            expect(app.getAttribute('data-prepared')).toBe('async'),
        );

        // async #mount mutated reactive state across an `await` — the template
        // re-rendered, settling on the post-await value.
        await waitFor(() =>
            expect(find('.phase', canvasElement)?.textContent).toBe('ready'),
        );

        // async #effect tracked `state.phase` (read before its `await`), so it
        // re-ran on every change and its async tail mirrored the final value.
        await waitFor(() =>
            expect(app.getAttribute('data-phase')).toBe('ready'),
        );

        // sync reactivity is untouched by the async hooks — a click still
        // re-renders synchronously.
        click(find<HTMLButtonElement>('.bump', canvasElement) as HTMLButtonElement);
        expect(find('.ticks', canvasElement)?.textContent).toBe('1');
    },
};
