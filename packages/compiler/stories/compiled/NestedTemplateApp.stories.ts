import { expect } from '@neuralfog/elemix-testing-library';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import { click } from '@neuralfog/elemix-testing-library/events';
import './.emited/NestedTemplateApp';

export default { title: 'Compiled/NestedTemplateApp' };

export const Default = {
    render: () => '<nested-template-app></nested-template-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // initial title
        const h2 = find('h2', canvasElement);
        if (!h2) throw new Error('nested-template-app did not render an h2');
        expect(h2.textContent).toBe('Dashboard');

        // both reused chip templates start at "new"
        const chips = query('.chip', canvasElement);
        expect(chips.length).toBe(2);
        expect(chips[0].textContent).toBe('new');
        expect(chips[1].textContent).toBe('new');

        // buttons: "change title" then "change tag"
        const buttons = query('button', canvasElement);
        const titleButton = buttons[0];
        const tagButton = buttons[1];
        expect(titleButton.textContent).toBe('change title');
        expect(tagButton.textContent).toBe('change tag');

        // the embedded `chip` template is reused twice in "<chip> and again <chip>"
        const chipsHost = find('.chips', canvasElement);
        expect(chipsHost?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
            'new and again new',
        );

        // change title → h2 (a nested-template variable) swaps Dashboard -> Reports
        click(titleButton);
        expect(h2.textContent).toBe('Reports');

        // toggling title again swaps back -> Reports -> Dashboard
        click(titleButton);
        expect(h2.textContent).toBe('Dashboard');

        // change tag → BOTH reused chip templates update from the one shared cell
        click(tagButton);
        let updatedChips = query('.chip', canvasElement);
        expect(updatedChips[0].textContent).toBe('hot');
        expect(updatedChips[1].textContent).toBe('hot');
        expect(chipsHost?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
            'hot and again hot',
        );

        // toggling tag again swaps both reused chips back to "new"
        click(tagButton);
        updatedChips = query('.chip', canvasElement);
        expect(updatedChips[0].textContent).toBe('new');
        expect(updatedChips[1].textContent).toBe('new');
    },
};
