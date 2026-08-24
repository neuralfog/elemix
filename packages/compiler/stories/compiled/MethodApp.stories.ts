import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/MethodApp';

export default { title: 'Compiled/MethodApp' };

export const Default = {
    render: () => '<method-app></method-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        expect(find('.lbl', canvasElement)?.textContent).toBe('count');
        expect(find('.count', canvasElement)?.textContent).toBe('0');
        click(find('.inc', canvasElement) as HTMLButtonElement);
        expect(find('.count', canvasElement)?.textContent).toBe('1');
    },
};
