import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/ClientOnlyApp';

export default { title: 'Compiled/ClientOnlyApp' };

export const Default = {
    render: () => '<client-only-app></client-only-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const button = find<HTMLButtonElement>('button', canvasElement);
        if (!button) {
            throw new Error('client-only-app did not render a button');
        }

        expect(button.textContent).toBe('count is 7');

        click(button);
        expect(button.textContent).toBe('count is 8');
        click(button);
        expect(button.textContent).toBe('count is 9');
    },
};
