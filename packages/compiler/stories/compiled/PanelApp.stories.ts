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

        const buttons = query('button', canvasElement);
        const addBtn = buttons[0];
        const renameBtn = buttons[1];
        expect(addBtn.textContent).toBe('add');
        expect(renameBtn.textContent).toBe('rename');

        expect(heading.textContent).toBe('Inbox');
        expect(stat.textContent).toBe('3 open');

        click(renameBtn);
        expect(heading.textContent).toBe('Archive');
        expect(stat.textContent).toBe('3 open');

        click(renameBtn);
        expect(heading.textContent).toBe('Inbox');

        click(addBtn);
        expect(stat.textContent).toBe('4 open');
        click(addBtn);
        click(addBtn);
        expect(stat.textContent).toBe('6 open');
        expect(heading.textContent).toBe('Inbox');

        click(renameBtn);
        expect(heading.textContent).toBe('Archive');
        expect(stat.textContent).toBe('6 open');
        click(addBtn);
        expect(stat.textContent).toBe('7 open');
        expect(heading.textContent).toBe('Archive');
    },
};
