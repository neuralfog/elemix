import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/DynamicChildApp';

export default { title: 'Compiled/DynamicChildApp' };

export const Default = {
    render: () => '<dynamic-child-app></dynamic-child-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        expect(find('.row[data-id="a"] .icon-a', canvasElement)).not.toBeNull();
        expect(find('.row[data-id="b"] .icon-b', canvasElement)).not.toBeNull();
        expect(canvasElement.textContent?.includes('[object')).toBe(false);

        expect(find('.swap', canvasElement)?.textContent).toBe('plain');
        expect(find('.swap .badge', canvasElement)).toBeNull();

        click(find('.toggle', canvasElement) as HTMLButtonElement);
        expect(find('.swap .badge', canvasElement)?.textContent).toBe('NEW');

        click(find('.toggle', canvasElement) as HTMLButtonElement);
        expect(find('.swap .badge', canvasElement)).toBeNull();
        expect(find('.swap', canvasElement)?.textContent).toBe('plain');
    },
};
