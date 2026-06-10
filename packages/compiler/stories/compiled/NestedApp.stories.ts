import { expect, userEvent } from 'storybook/test';
import './.emited/NestedApp';

export default { title: 'Compiled/NestedApp' };

export const Default = {
    render: () => '<nested-app></nested-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('nested-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('nested-app did not render a shadow root');

        const items = (cat: Element) =>
            Array.from(cat.querySelectorAll('ul li')).map((li) => li.textContent);

        // two seeded categories: Fruit (Apple, Banana), Vegetables (Carrot).
        // assert outer loop names AND inner loop item text.
        const categories = root.querySelectorAll('.category');
        expect(categories.length).toBe(2);

        const fruit = categories[0];
        const veg = categories[1];
        expect(fruit.querySelector('.head strong')?.textContent).toBe('Fruit');
        expect(veg.querySelector('.head strong')?.textContent).toBe('Vegetables');
        expect(items(fruit)).toEqual(['Apple', 'Banana']);
        expect(items(veg)).toEqual(['Carrot']);

        // each category head has a "+ item" button
        const fruitAdd = fruit.querySelector('.head button') as HTMLButtonElement;
        const vegAdd = veg.querySelector('.head button') as HTMLButtonElement;
        expect(fruitAdd.textContent).toBe('+ item');

        // add to the first category only -> inner keyed repeat patches just Fruit
        await userEvent.click(fruitAdd);
        expect(items(fruit)).toEqual(['Apple', 'Banana', 'New item']);
        expect(items(veg)).toEqual(['Carrot']); // untouched

        // add a second item to Fruit -> grows again, Vegetables still untouched
        await userEvent.click(fruitAdd);
        expect(items(fruit)).toEqual(['Apple', 'Banana', 'New item', 'New item']);
        expect(items(veg)).toEqual(['Carrot']);

        // now add to the SECOND category -> only Vegetables grows
        await userEvent.click(vegAdd);
        expect(items(veg)).toEqual(['Carrot', 'New item']);
        expect(items(fruit)).toEqual(['Apple', 'Banana', 'New item', 'New item']);
    },
};
