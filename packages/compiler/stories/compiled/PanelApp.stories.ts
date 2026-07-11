import { expect } from '@neuralfog/elemix-testing-library';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import { click } from '@neuralfog/elemix-testing-library/events';
import './.emited/PanelApp';

export default { title: 'Compiled/PanelApp' };

export const Default = {
    render: () => '<panel-app></panel-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const heading = find('h2', canvasElement);
        const stat = find('.stat', canvasElement);
        if (!heading || !stat) throw new Error('panel-app missing h2/.stat');

        // buttons in DOM order: add, rename
        const buttons = query('button', canvasElement);
        const addBtn = buttons[0];
        const renameBtn = buttons[1];
        expect(addBtn.textContent).toBe('add');
        expect(renameBtn.textContent).toBe('rename');

        // initial: title Inbox, count 3 (headerTemplate + statTemplate sub-templates)
        expect(heading.textContent).toBe('Inbox');
        expect(stat.textContent).toBe('3 open');

        // rename -> Inbox becomes Archive; stat sub-template untouched
        click(renameBtn);
        expect(heading.textContent).toBe('Archive');
        expect(stat.textContent).toBe('3 open');

        // rename again -> Archive flips back to Inbox
        click(renameBtn);
        expect(heading.textContent).toBe('Inbox');

        // add x3 -> count climbs to 6; header sub-template untouched
        click(addBtn);
        expect(stat.textContent).toBe('4 open');
        click(addBtn);
        click(addBtn);
        expect(stat.textContent).toBe('6 open');
        expect(heading.textContent).toBe('Inbox');

        // both sub-templates still independently reactive after interleaving
        click(renameBtn);
        expect(heading.textContent).toBe('Archive');
        expect(stat.textContent).toBe('6 open');
        click(addBtn);
        expect(stat.textContent).toBe('7 open');
        expect(heading.textContent).toBe('Archive');
    },
};
