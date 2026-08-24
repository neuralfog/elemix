import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ConditionalApp';

export default { title: 'Compiled/ConditionalApp' };

export const Default = {
    render: () => '<conditional-app></conditional-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const guest0 = find('.card.guest', canvasElement);
        expect(guest0).toBeTruthy();
        expect(guest0?.textContent).toContain('You are signed out');
        expect(guest0?.textContent).toContain('Sign in to see your dashboard.');
        expect(find('.card.welcome', canvasElement)).toBeNull();

        const tip0 = find('.tip', canvasElement);
        expect(tip0).toBeTruthy();
        expect(tip0?.textContent).toContain('mount and unmount');

        const buttons = query('button', canvasElement);
        const signButton = buttons[0];
        const tipButton = buttons[1];
        expect(tipButton.classList.contains('ghost')).toBe(true);
        expect(signButton.textContent?.trim()).toBe('Sign in');
        expect(tipButton.textContent?.trim()).toBe('Hide tip');

        click(signButton);
        const welcome = find('.card.welcome', canvasElement);
        expect(welcome).toBeTruthy();
        expect(welcome?.textContent).toContain('Welcome back');
        expect(welcome?.textContent).toContain('You are signed in.');
        expect(find('.card.guest', canvasElement)).toBeNull();
        expect(signButton.textContent?.trim()).toBe('Sign out');

        click(signButton);
        expect(find('.card.welcome', canvasElement)).toBeNull();
        expect(find('.card.guest', canvasElement)).toBeTruthy();
        expect(signButton.textContent?.trim()).toBe('Sign in');

        click(tipButton);
        expect(find('.tip', canvasElement)).toBeNull();
        expect(tipButton.textContent?.trim()).toBe('Show tip');

        click(tipButton);
        expect(find('.tip', canvasElement)).toBeTruthy();
        expect(tipButton.textContent?.trim()).toBe('Hide tip');

        click(signButton);
        expect(find('.card.welcome', canvasElement)).toBeTruthy();
        expect(find('.tip', canvasElement)).toBeTruthy();
    },
};
