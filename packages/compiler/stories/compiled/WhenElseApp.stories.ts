import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/WhenElseApp';

export default { title: 'Compiled/WhenElseApp' };

export const Default = {
    render: () => '<when-else-app></when-else-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // condition is false → the `otherwise` (third) branch must render.
        // Regression: the compiler used to drop the otherwise branch and emit
        // '' for the false case, so this card never appeared.
        const idle = find('.card.idle', canvasElement);
        expect(idle).toBeTruthy();
        expect(idle?.textContent).toContain('Please log in');
        expect(find('.card.ready', canvasElement)).toBeNull();

        // toggle true → the then branch mounts, otherwise unmounts
        click(find('.toggle', canvasElement) as HTMLButtonElement);
        const ready = find('.card.ready', canvasElement);
        expect(ready).toBeTruthy();
        expect(ready?.textContent).toContain('Welcome back');
        expect(find('.card.idle', canvasElement)).toBeNull();

        // toggle back → otherwise branch re-mounts
        click(find('.toggle', canvasElement) as HTMLButtonElement);
        expect(find('.card.idle', canvasElement)?.textContent).toContain(
            'Please log in',
        );
        expect(find('.card.ready', canvasElement)).toBeNull();
    },
};
