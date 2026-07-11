import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/MultiRootApp';

export default { title: 'Compiled/MultiRootApp' };

export const Default = {
    render: () => '<multi-root-app></multi-root-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // a conditional branch with TWO root elements — both must mount
        expect(find('.a', canvasElement)?.textContent).toBe('a0');
        expect(find('.b', canvasElement)?.textContent).toBe('b');

        // updating state re-runs the conditional (it reads count); the SECOND
        // root must survive the re-render, not vanish
        click(find('.inc', canvasElement) as HTMLButtonElement);
        expect(find('.a', canvasElement)?.textContent).toBe('a1');
        expect(find('.b', canvasElement)?.textContent).toBe('b');
    },
};
