import { expect, userEvent } from 'storybook/test';
import './.emited/TodoApp';

export default { title: 'Compiled/TodoApp' };

// elemix `~model` is two-way: addItem() resets the ref programmatically, which
// clears the DOM input. userEvent.type keeps its own internal buffer and
// concatenates against the stale value after such a reset — so drive the model
// through native input/keydown events instead, which read the live DOM value.
const setValue = (el: HTMLInputElement, value: string): void => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
};
const pressEnter = (el: HTMLInputElement): void => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};

export const Default = {
    render: () => '<todo-app></todo-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('todo-app');
        const root = app?.shadowRoot;
        const input = root?.querySelector('input') as HTMLInputElement;
        const addBtn = root?.querySelector('button.add') as HTMLButtonElement;
        if (!root || !input || !addBtn)
            throw new Error('todo-app did not render input + Add button');

        // header + placeholder are statically rendered
        expect(root.querySelector('h3')?.textContent).toBe('Todos');
        expect(input.getAttribute('placeholder')).toBe('What needs doing?');

        // starts with the single seeded todo
        expect(root.querySelectorAll('li').length).toBe(1);
        expect(root.querySelector('li span')?.textContent).toBe('Learn Elemix');

        // whitespace-only draft is rejected by the trim() guard (no row added)
        setValue(input, '   ');
        await userEvent.click(addBtn);
        expect(root.querySelectorAll('li').length).toBe(1);
        // the model still holds the whitespace (guard returns before clearing)
        expect(input.value).toBe('   ');

        // real text added via the Add button (@click path); model clears on add
        setValue(input, 'Buy milk');
        await userEvent.click(addBtn);
        let items = root.querySelectorAll('li');
        expect(items.length).toBe(2);
        expect(items[1].querySelector('span')?.textContent).toBe('Buy milk');
        expect(input.value).toBe('');

        // second todo via the Enter @keydown path
        setValue(input, 'Walk dog');
        pressEnter(input);
        items = root.querySelectorAll('li');
        expect(items.length).toBe(3);
        expect(items[2].querySelector('span')?.textContent).toBe('Walk dog');
        expect(input.value).toBe('');

        // remove the middle row -> list shrinks and reorders, keys stay stable
        const removeMilk = items[1].querySelector('button.remove') as HTMLButtonElement;
        expect(removeMilk.textContent).toBe('×');
        await userEvent.click(removeMilk);
        items = root.querySelectorAll('li');
        expect(items.length).toBe(2);
        expect(items[0].querySelector('span')?.textContent).toBe('Learn Elemix');
        expect(items[1].querySelector('span')?.textContent).toBe('Walk dog');

        // remove remaining rows down to an empty list
        await userEvent.click(items[1].querySelector('button.remove') as HTMLButtonElement);
        items = root.querySelectorAll('li');
        expect(items.length).toBe(1);
        await userEvent.click(items[0].querySelector('button.remove') as HTMLButtonElement);
        expect(root.querySelectorAll('li').length).toBe(0);

        // list rebuilds from empty after a fresh add
        setValue(input, 'Restart');
        pressEnter(input);
        items = root.querySelectorAll('li');
        expect(items.length).toBe(1);
        expect(items[0].querySelector('span')?.textContent).toBe('Restart');
    },
};
