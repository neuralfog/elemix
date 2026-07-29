import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/BeforeMountApp';

export default { title: 'Compiled/BeforeMountApp' };

export const Default = {
    render: () => '<before-mount-app></before-mount-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const button = find<HTMLButtonElement>('button', canvasElement);
        if (!button) {
            throw new Error('before-mount-app did not render a button');
        }

        expect(button.textContent).toBe('count is 999');

        click(button);
        expect(button.textContent).toBe('count is 1000');
        click(button);
        expect(button.textContent).toBe('count is 1001');
    },
};
