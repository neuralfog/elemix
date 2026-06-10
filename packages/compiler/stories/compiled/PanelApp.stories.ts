import { expect, userEvent } from 'storybook/test';
import './.emited/PanelApp';

export default { title: 'Compiled/PanelApp' };

export const Default = {
    render: () => '<panel-app></panel-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('panel-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('panel-app did not render a shadow root');

        const heading = root.querySelector('h2');
        const stat = root.querySelector('.stat');
        if (!heading || !stat) throw new Error('panel-app missing h2/.stat');

        // buttons in DOM order: add, rename
        const buttons = root.querySelectorAll('button');
        const addBtn = buttons[0];
        const renameBtn = buttons[1];
        expect(addBtn.textContent).toBe('add');
        expect(renameBtn.textContent).toBe('rename');

        // initial: title Inbox, count 3 (headerTemplate + statTemplate sub-templates)
        expect(heading.textContent).toBe('Inbox');
        expect(stat.textContent).toBe('3 open');

        // rename -> Inbox becomes Archive; stat sub-template untouched
        await userEvent.click(renameBtn);
        expect(heading.textContent).toBe('Archive');
        expect(stat.textContent).toBe('3 open');

        // rename again -> Archive flips back to Inbox
        await userEvent.click(renameBtn);
        expect(heading.textContent).toBe('Inbox');

        // add x3 -> count climbs to 6; header sub-template untouched
        await userEvent.click(addBtn);
        expect(stat.textContent).toBe('4 open');
        await userEvent.click(addBtn);
        await userEvent.click(addBtn);
        expect(stat.textContent).toBe('6 open');
        expect(heading.textContent).toBe('Inbox');

        // both sub-templates still independently reactive after interleaving
        await userEvent.click(renameBtn);
        expect(heading.textContent).toBe('Archive');
        expect(stat.textContent).toBe('6 open');
        await userEvent.click(addBtn);
        expect(stat.textContent).toBe('7 open');
        expect(heading.textContent).toBe('Archive');
    },
};
