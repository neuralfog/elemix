import { expect, userEvent } from 'storybook/test';
import './.emited/NestedTemplateApp';

export default { title: 'Compiled/NestedTemplateApp' };

export const Default = {
    render: () => '<nested-template-app></nested-template-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('nested-template-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('nested-template-app did not render a shadow root');

        // initial title
        const h2 = root.querySelector('h2');
        if (!h2) throw new Error('nested-template-app did not render an h2');
        expect(h2.textContent).toBe('Dashboard');

        // both reused chip templates start at "new"
        const chips = root.querySelectorAll('.chip');
        expect(chips.length).toBe(2);
        expect(chips[0].textContent).toBe('new');
        expect(chips[1].textContent).toBe('new');

        // buttons: "change title" then "change tag"
        const buttons = root.querySelectorAll('button');
        const titleButton = buttons[0];
        const tagButton = buttons[1];
        expect(titleButton.textContent).toBe('change title');
        expect(tagButton.textContent).toBe('change tag');

        // the embedded `chip` template is reused twice in "<chip> and again <chip>"
        const chipsHost = root.querySelector('.chips');
        expect(chipsHost?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
            'new and again new',
        );

        // change title → h2 (a nested-template variable) swaps Dashboard -> Reports
        await userEvent.click(titleButton);
        expect(h2.textContent).toBe('Reports');

        // toggling title again swaps back -> Reports -> Dashboard
        await userEvent.click(titleButton);
        expect(h2.textContent).toBe('Dashboard');

        // change tag → BOTH reused chip templates update from the one shared cell
        await userEvent.click(tagButton);
        let updatedChips = root.querySelectorAll('.chip');
        expect(updatedChips[0].textContent).toBe('hot');
        expect(updatedChips[1].textContent).toBe('hot');
        expect(chipsHost?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
            'hot and again hot',
        );

        // toggling tag again swaps both reused chips back to "new"
        await userEvent.click(tagButton);
        updatedChips = root.querySelectorAll('.chip');
        expect(updatedChips[0].textContent).toBe('new');
        expect(updatedChips[1].textContent).toBe('new');
    },
};
