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
        // button order: "Increment (silent)" (.ghost) then "Increment + render()"
        const silent = buttons[0];
        const withRender = buttons[1];
        if (!value || !silent || !withRender) throw new Error('render-app missing value or buttons');

        // button labels
        expect(silent.textContent).toBe('Increment (silent)');
        expect(silent.classList.contains('ghost')).toBe(true);
        expect(withRender.textContent).toBe('Increment + render()');

        // count is a plain field, not reactive — starts at 0
        expect(value.textContent).toBe('0');

        // silent increments mutate count but do NOT flush to the DOM (still 0)
        click(silent);
        expect(value.textContent).toBe('0');
        click(silent);
        click(silent);
        expect(value.textContent).toBe('0');

        // render() escape hatch increments AND flushes all accumulated mutations:
        // 3 silent + 1 here = 4
        click(withRender);
        expect(value.textContent).toBe('4');

        // more silent clicks accumulate behind the scenes without re-rendering
        click(silent);
        click(silent);
        expect(value.textContent).toBe('4');

        // render() catches the DOM up again: 4 + 2 silent + 1 = 7
        click(withRender);
        expect(value.textContent).toBe('7');
    },
};
