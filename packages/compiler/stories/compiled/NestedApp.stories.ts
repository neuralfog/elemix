import { expect } from '@neuralfog/elemix-testing-library';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import { click } from '@neuralfog/elemix-testing-library/events';
import './.emited/NestedApp';

export default { title: 'Compiled/NestedApp' };

export const Default = {
    render: () => '<nested-app></nested-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const items = (cat: Element) =>
            query('ul li', cat).map((li) => li.textContent);

        // two seeded categories: Fruit (Apple, Banana), Vegetables (Carrot).
        // assert outer loop names AND inner loop item text.
        const categories = query('.category', canvasElement);
        expect(categories.length).toBe(2);

        const fruit = categories[0];
        const veg = categories[1];
        expect(find('.head strong', fruit)?.textContent).toBe('Fruit');
        expect(find('.head strong', veg)?.textContent).toBe('Vegetables');
        expect(items(fruit)).toEqual(['Apple', 'Banana']);
        expect(items(veg)).toEqual(['Carrot']);

        // each category head has a "+ item" button
        const fruitAdd = find('.head button', fruit) as HTMLButtonElement;
        const vegAdd = find('.head button', veg) as HTMLButtonElement;
        expect(fruitAdd.textContent).toBe('+ item');

        // add to the first category only -> inner keyed repeat patches just Fruit
        click(fruitAdd);
        expect(items(fruit)).toEqual(['Apple', 'Banana', 'New item']);
        expect(items(veg)).toEqual(['Carrot']); // untouched

        // add a second item to Fruit -> grows again, Vegetables still untouched
        click(fruitAdd);
        expect(items(fruit)).toEqual(['Apple', 'Banana', 'New item', 'New item']);
        expect(items(veg)).toEqual(['Carrot']);

        // now add to the SECOND category -> only Vegetables grows
        click(vegAdd);
        expect(items(veg)).toEqual(['Carrot', 'New item']);
        expect(items(fruit)).toEqual(['Apple', 'Banana', 'New item', 'New item']);
    },
};
