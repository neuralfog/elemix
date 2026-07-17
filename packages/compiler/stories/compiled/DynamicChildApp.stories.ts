import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/DynamicChildApp';

export default { title: 'Compiled/DynamicChildApp' };

export const Default = {
    render: () => '<dynamic-child-app></dynamic-child-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // A template returned through a non-inlinable function (data property
        // `it.icon()`) lands in a plain content hole the compiler classifies as
        // text. It must MOUNT as a node, not stringify to [object DocumentFragment].
        expect(find('.row[data-id="a"] .icon-a', canvasElement)).not.toBeNull();
        expect(find('.row[data-id="b"] .icon-b', canvasElement)).not.toBeNull();
        expect(canvasElement.textContent?.includes('[object')).toBe(false);

        // The swap hole starts as plain text.
        expect(find('.swap', canvasElement)?.textContent).toBe('plain');
        expect(find('.swap .badge', canvasElement)).toBeNull();

        // Toggling swaps the text for a mounted template node.
        click(find('.toggle', canvasElement) as HTMLButtonElement);
        expect(find('.swap .badge', canvasElement)?.textContent).toBe('NEW');

        // Toggling back removes the mounted node and restores the text.
        click(find('.toggle', canvasElement) as HTMLButtonElement);
        expect(find('.swap .badge', canvasElement)).toBeNull();
        expect(find('.swap', canvasElement)?.textContent).toBe('plain');
    },
};
