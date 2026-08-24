import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/DirectApp';

export default { title: 'Compiled/DirectApp' };

export const Default = {
    render: () => '<direct-app></direct-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const box = find('.box', canvasElement);
        if (!box) throw new Error('direct-app did not render a .box');
        expect(box.classList.contains('box')).toBe(true);
        expect(box.classList.contains('active')).toBe(true);
        expect(box.classList.contains('rounded')).toBe(false);
        expect(box.classList.contains('large')).toBe(false);

        const toggles = query('.toggles button', canvasElement);
        const activeToggle = toggles[0] as HTMLButtonElement;
        const roundedToggle = toggles[1] as HTMLButtonElement;
        const largeToggle = toggles[2] as HTMLButtonElement;
        expect(activeToggle.textContent).toBe('active');
        expect(roundedToggle.textContent).toBe('rounded');
        expect(largeToggle.textContent).toBe('large');

        click(activeToggle);
        expect(box.classList.contains('active')).toBe(false);
        expect(box.classList.contains('box')).toBe(true);
        click(activeToggle);
        expect(box.classList.contains('active')).toBe(true);

        click(roundedToggle);
        expect(box.classList.contains('rounded')).toBe(true);
        click(roundedToggle);
        expect(box.classList.contains('rounded')).toBe(false);

        click(largeToggle);
        expect(box.classList.contains('large')).toBe(true);
        click(largeToggle);
        expect(box.classList.contains('large')).toBe(false);

        click(roundedToggle);
        click(largeToggle);
        expect(box.classList.contains('active')).toBe(true);
        expect(box.classList.contains('rounded')).toBe(true);
        expect(box.classList.contains('large')).toBe(true);

        const action = find('.action', canvasElement) as HTMLButtonElement;
        expect(action.textContent).toBe('Action');
        const checkbox = find(
            'input[type="checkbox"]',
            canvasElement,
        ) as HTMLInputElement;
        expect(action.hasAttribute('disabled')).toBe(false);
        expect(checkbox.checked).toBe(false);

        click(checkbox);
        expect(action.hasAttribute('disabled')).toBe(true);
        expect(checkbox.checked).toBe(true);

        click(checkbox);
        expect(action.hasAttribute('disabled')).toBe(false);
        expect(checkbox.checked).toBe(false);
    },
};
