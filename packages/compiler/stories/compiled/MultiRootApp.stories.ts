import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/MultiRootApp';

export default { title: 'Compiled/MultiRootApp' };

export const Default = {
    render: () => '<multi-root-app></multi-root-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        expect(find('.a', canvasElement)?.textContent).toBe('a0');
        expect(find('.b', canvasElement)?.textContent).toBe('b');

        click(find('.inc', canvasElement) as HTMLButtonElement);
        expect(find('.a', canvasElement)?.textContent).toBe('a1');
        expect(find('.b', canvasElement)?.textContent).toBe('b');
    },
};
