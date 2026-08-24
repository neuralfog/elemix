import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/RenderApp';

export default { title: 'Compiled/RenderApp' };

export const Default = {
    render: () => '<render-app></render-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const value = find('.value', canvasElement);
        const buttons = query('button', canvasElement);
        const silent = buttons[0];
        const withRender = buttons[1];
        if (!value || !silent || !withRender) throw new Error('render-app missing value or buttons');

        expect(silent.textContent).toBe('Increment (silent)');
        expect(silent.classList.contains('ghost')).toBe(true);
        expect(withRender.textContent).toBe('Increment + render()');

        expect(value.textContent).toBe('0');

        click(silent);
        expect(value.textContent).toBe('0');
        click(silent);
        click(silent);
        expect(value.textContent).toBe('0');

        click(withRender);
        expect(value.textContent).toBe('4');

        click(silent);
        click(silent);
        expect(value.textContent).toBe('4');

        click(withRender);
        expect(value.textContent).toBe('7');
    },
};
