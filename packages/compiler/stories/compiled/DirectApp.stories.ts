import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/DirectApp';

export default { title: 'Compiled/DirectApp' };

export const Default = {
    render: () => '<direct-app></direct-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // initial class binding: box=true, active=true, rounded=false, large=false
        const box = find('.box', canvasElement);
        if (!box) throw new Error('direct-app did not render a .box');
        expect(box.classList.contains('box')).toBe(true);
        expect(box.classList.contains('active')).toBe(true);
        expect(box.classList.contains('rounded')).toBe(false);
        expect(box.classList.contains('large')).toBe(false);

        // .toggles buttons in order: [active, rounded, large]
        const toggles = query('.toggles button', canvasElement);
        const activeToggle = toggles[0] as HTMLButtonElement;
        const roundedToggle = toggles[1] as HTMLButtonElement;
        const largeToggle = toggles[2] as HTMLButtonElement;
        expect(activeToggle.textContent).toBe('active');
        expect(roundedToggle.textContent).toBe('rounded');
        expect(largeToggle.textContent).toBe('large');

        // toggle active off → class removed; base "box" class always retained
        click(activeToggle);
        expect(box.classList.contains('active')).toBe(false);
        expect(box.classList.contains('box')).toBe(true);
        // toggle active back on
        click(activeToggle);
        expect(box.classList.contains('active')).toBe(true);

        // toggle rounded on then off
        click(roundedToggle);
        expect(box.classList.contains('rounded')).toBe(true);
        click(roundedToggle);
        expect(box.classList.contains('rounded')).toBe(false);

        // toggle large on then off
        click(largeToggle);
        expect(box.classList.contains('large')).toBe(true);
        click(largeToggle);
        expect(box.classList.contains('large')).toBe(false);

        // multiple classes can be active at once (independent toggles)
        click(roundedToggle);
        click(largeToggle);
        expect(box.classList.contains('active')).toBe(true);
        expect(box.classList.contains('rounded')).toBe(true);
        expect(box.classList.contains('large')).toBe(true);

        // checkbox drives disabled attribute on .action button
        const action = find('.action', canvasElement) as HTMLButtonElement;
        expect(action.textContent).toBe('Action');
        const checkbox = find(
            'input[type="checkbox"]',
            canvasElement,
        ) as HTMLInputElement;
        // initial: disabled=false → no attribute, checkbox unchecked
        expect(action.hasAttribute('disabled')).toBe(false);
        expect(checkbox.checked).toBe(false);

        // check → disabled attribute appears, checkbox reflects state
        click(checkbox);
        expect(action.hasAttribute('disabled')).toBe(true);
        expect(checkbox.checked).toBe(true);

        // uncheck → disabled attribute removed, action re-enabled
        click(checkbox);
        expect(action.hasAttribute('disabled')).toBe(false);
        expect(checkbox.checked).toBe(false);
    },
};
