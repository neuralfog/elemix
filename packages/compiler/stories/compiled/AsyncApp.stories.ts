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

        await waitFor(() =>
            expect(app.getAttribute('data-prepared')).toBe('async'),
        );

        await waitFor(() =>
            expect(find('.phase', canvasElement)?.textContent).toBe('ready'),
        );

        await waitFor(() =>
            expect(app.getAttribute('data-phase')).toBe('ready'),
        );

        click(find<HTMLButtonElement>('.bump', canvasElement) as HTMLButtonElement);
        expect(find('.ticks', canvasElement)?.textContent).toBe('1');
    },
};
