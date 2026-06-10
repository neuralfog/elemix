import { expect, userEvent } from 'storybook/test';
import './.emited/DirectApp';

export default { title: 'Compiled/DirectApp' };

export const Default = {
    render: () => '<direct-app></direct-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('direct-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('direct-app did not render a shadow root');

        // initial class binding: box=true, active=true, rounded=false, large=false
        const box = root.querySelector('.box');
        if (!box) throw new Error('direct-app did not render a .box');
        expect(box.classList.contains('box')).toBe(true);
        expect(box.classList.contains('active')).toBe(true);
        expect(box.classList.contains('rounded')).toBe(false);
        expect(box.classList.contains('large')).toBe(false);

        // .toggles buttons in order: [active, rounded, large]
        const toggles = root.querySelectorAll('.toggles button');
        const activeToggle = toggles[0] as HTMLButtonElement;
        const roundedToggle = toggles[1] as HTMLButtonElement;
        const largeToggle = toggles[2] as HTMLButtonElement;
        expect(activeToggle.textContent).toBe('active');
        expect(roundedToggle.textContent).toBe('rounded');
        expect(largeToggle.textContent).toBe('large');

        // toggle active off → class removed; base "box" class always retained
        await userEvent.click(activeToggle);
        expect(box.classList.contains('active')).toBe(false);
        expect(box.classList.contains('box')).toBe(true);
        // toggle active back on
        await userEvent.click(activeToggle);
        expect(box.classList.contains('active')).toBe(true);

        // toggle rounded on then off
        await userEvent.click(roundedToggle);
        expect(box.classList.contains('rounded')).toBe(true);
        await userEvent.click(roundedToggle);
        expect(box.classList.contains('rounded')).toBe(false);

        // toggle large on then off
        await userEvent.click(largeToggle);
        expect(box.classList.contains('large')).toBe(true);
        await userEvent.click(largeToggle);
        expect(box.classList.contains('large')).toBe(false);

        // multiple classes can be active at once (independent toggles)
        await userEvent.click(roundedToggle);
        await userEvent.click(largeToggle);
        expect(box.classList.contains('active')).toBe(true);
        expect(box.classList.contains('rounded')).toBe(true);
        expect(box.classList.contains('large')).toBe(true);

        // checkbox drives disabled attribute on .action button
        const action = root.querySelector('.action') as HTMLButtonElement;
        expect(action.textContent).toBe('Action');
        const checkbox = root.querySelector(
            'input[type="checkbox"]',
        ) as HTMLInputElement;
        // initial: disabled=false → no attribute, checkbox unchecked
        expect(action.hasAttribute('disabled')).toBe(false);
        expect(checkbox.checked).toBe(false);

        // check → disabled attribute appears, checkbox reflects state
        await userEvent.click(checkbox);
        expect(action.hasAttribute('disabled')).toBe(true);
        expect(checkbox.checked).toBe(true);

        // uncheck → disabled attribute removed, action re-enabled
        await userEvent.click(checkbox);
        expect(action.hasAttribute('disabled')).toBe(false);
        expect(checkbox.checked).toBe(false);
    },
};
