import { expect } from '@neuralfog/elemix-testing-library';
import { click, keyDown, setValue } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/TodoApp';

export default { title: 'Compiled/TodoApp' };

// addItem() resets the ~model ref programmatically, which clears the DOM input.
// The testing-library setValue/keyDown helpers dispatch native input/keydown
// events that read the live DOM value, so they drive the model across resets.
export const Default = {
    render: () => '<todo-app></todo-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const input = find<HTMLInputElement>('input', canvasElement);
        const addBtn = find<HTMLButtonElement>('button.add', canvasElement);
        if (!input || !addBtn)
            throw new Error('todo-app did not render input + Add button');

        // header + placeholder are statically rendered
        expect(find('h3', canvasElement)?.textContent).toBe('Todos');
        expect(input.getAttribute('placeholder')).toBe('What needs doing?');

        // starts with the single seeded todo
        expect(query('li', canvasElement).length).toBe(1);
        expect(find('li span', canvasElement)?.textContent).toBe('Learn Elemix');

        // whitespace-only draft is rejected by the trim() guard (no row added)
        setValue(input, '   ');
        click(addBtn);
        expect(query('li', canvasElement).length).toBe(1);
        // the model still holds the whitespace (guard returns before clearing)
        expect(input.value).toBe('   ');

        // real text added via the Add button (@click path); model clears on add
        setValue(input, 'Buy milk');
        click(addBtn);
        let items = query('li', canvasElement);
        expect(items.length).toBe(2);
        expect(find('span', items[1])?.textContent).toBe('Buy milk');
        expect(input.value).toBe('');

        // second todo via the Enter @keydown path
        setValue(input, 'Walk dog');
        keyDown(input, 'Enter');
        items = query('li', canvasElement);
        expect(items.length).toBe(3);
        expect(find('span', items[2])?.textContent).toBe('Walk dog');
        expect(input.value).toBe('');

        // remove the middle row -> list shrinks and reorders, keys stay stable
        const removeMilk = find<HTMLButtonElement>('button.remove', items[1]);
        if (!removeMilk) throw new Error('missing remove button');
        expect(removeMilk.textContent).toBe('×');
        click(removeMilk);
        items = query('li', canvasElement);
        expect(items.length).toBe(2);
        expect(find('span', items[0])?.textContent).toBe('Learn Elemix');
        expect(find('span', items[1])?.textContent).toBe('Walk dog');

        // remove remaining rows down to an empty list
        click(find<HTMLButtonElement>('button.remove', items[1]) as HTMLButtonElement);
        items = query('li', canvasElement);
        expect(items.length).toBe(1);
        click(find<HTMLButtonElement>('button.remove', items[0]) as HTMLButtonElement);
        expect(query('li', canvasElement).length).toBe(0);

        // list rebuilds from empty after a fresh add
        setValue(input, 'Restart');
        keyDown(input, 'Enter');
        items = query('li', canvasElement);
        expect(items.length).toBe(1);
        expect(find('span', items[0])?.textContent).toBe('Restart');
    },
};
