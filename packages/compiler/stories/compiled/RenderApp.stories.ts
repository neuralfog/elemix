import { expect, userEvent } from 'storybook/test';
import './.emited/RenderApp';

export default { title: 'Compiled/RenderApp' };

export const Default = {
    render: () => '<render-app></render-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('render-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('render-app did not render a shadow root');

        const value = root.querySelector('.value');
        const buttons = root.querySelectorAll('button');
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
        await userEvent.click(silent);
        expect(value.textContent).toBe('0');
        await userEvent.click(silent);
        await userEvent.click(silent);
        expect(value.textContent).toBe('0');

        // render() escape hatch increments AND flushes all accumulated mutations:
        // 3 silent + 1 here = 4
        await userEvent.click(withRender);
        expect(value.textContent).toBe('4');

        // more silent clicks accumulate behind the scenes without re-rendering
        await userEvent.click(silent);
        await userEvent.click(silent);
        expect(value.textContent).toBe('4');

        // render() catches the DOM up again: 4 + 2 silent + 1 = 7
        await userEvent.click(withRender);
        expect(value.textContent).toBe('7');
    },
};
