import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ConditionalApp';

export default { title: 'Compiled/ConditionalApp' };

export const Default = {
    render: () => '<conditional-app></conditional-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // initial: loggedIn=false → guest card present, welcome card absent
        const guest0 = find('.card.guest', canvasElement);
        expect(guest0).toBeTruthy();
        expect(guest0?.textContent).toContain('You are signed out');
        expect(guest0?.textContent).toContain('Sign in to see your dashboard.');
        expect(find('.card.welcome', canvasElement)).toBeNull();

        // initial: showTip=true → tip present with its copy
        const tip0 = find('.tip', canvasElement);
        expect(tip0).toBeTruthy();
        expect(tip0?.textContent).toContain('mount and unmount');

        // button[0] toggles login ("Sign in"), button[1].ghost toggles tip ("Hide tip")
        const buttons = query('button', canvasElement);
        const signButton = buttons[0];
        const tipButton = buttons[1];
        expect(tipButton.classList.contains('ghost')).toBe(true);
        expect(signButton.textContent?.trim()).toBe('Sign in');
        expect(tipButton.textContent?.trim()).toBe('Hide tip');

        // sign in → welcome branch mounts, guest unmounts, label flips to "Sign out"
        click(signButton);
        const welcome = find('.card.welcome', canvasElement);
        expect(welcome).toBeTruthy();
        expect(welcome?.textContent).toContain('Welcome back');
        expect(welcome?.textContent).toContain('You are signed in.');
        expect(find('.card.guest', canvasElement)).toBeNull();
        expect(signButton.textContent?.trim()).toBe('Sign out');

        // sign out again → welcome unmounts, guest re-mounts, label back to "Sign in"
        click(signButton);
        expect(find('.card.welcome', canvasElement)).toBeNull();
        expect(find('.card.guest', canvasElement)).toBeTruthy();
        expect(signButton.textContent?.trim()).toBe('Sign in');

        // hide tip → tip branch ('' empty branch) unmounts, label flips to "Show tip"
        click(tipButton);
        expect(find('.tip', canvasElement)).toBeNull();
        expect(tipButton.textContent?.trim()).toBe('Show tip');

        // show tip again → tip re-mounts, label back to "Hide tip"
        click(tipButton);
        expect(find('.tip', canvasElement)).toBeTruthy();
        expect(tipButton.textContent?.trim()).toBe('Hide tip');

        // both conditionals are independent: sign in while tip is shown
        click(signButton);
        expect(find('.card.welcome', canvasElement)).toBeTruthy();
        expect(find('.tip', canvasElement)).toBeTruthy();
    },
};
