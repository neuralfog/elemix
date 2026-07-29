import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/BeforeMountStoreApp';

export default { title: 'Compiled/BeforeMountStoreApp' };

export const Default = {
    render: () => '<before-mount-store-app></before-mount-store-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const button = find<HTMLButtonElement>('button', canvasElement);
        if (!button) {
            throw new Error('before-mount-store-app did not render a button');
        }

        expect(button.textContent).toBe('count is 999');

        click(button);
        expect(button.textContent).toBe('count is 1000');
        click(button);
        expect(button.textContent).toBe('count is 1001');
    },
};
