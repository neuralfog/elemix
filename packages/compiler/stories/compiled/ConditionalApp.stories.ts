import { expect, userEvent } from 'storybook/test';
import './.emited/ConditionalApp';

export default { title: 'Compiled/ConditionalApp' };

export const Default = {
    render: () => '<conditional-app></conditional-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('conditional-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('conditional-app did not render a shadow root');

        // initial: loggedIn=false → guest card present, welcome card absent
        const guest0 = root.querySelector('.card.guest');
        expect(guest0).toBeTruthy();
        expect(guest0?.textContent).toContain('You are signed out');
        expect(guest0?.textContent).toContain('Sign in to see your dashboard.');
        expect(root.querySelector('.card.welcome')).toBeNull();

        // initial: showTip=true → tip present with its copy
        const tip0 = root.querySelector('.tip');
        expect(tip0).toBeTruthy();
        expect(tip0?.textContent).toContain('mount and unmount');

        // button[0] toggles login ("Sign in"), button[1].ghost toggles tip ("Hide tip")
        const buttons = root.querySelectorAll('button');
        const signButton = buttons[0];
        const tipButton = buttons[1];
        expect(tipButton.classList.contains('ghost')).toBe(true);
        expect(signButton.textContent?.trim()).toBe('Sign in');
        expect(tipButton.textContent?.trim()).toBe('Hide tip');

        // sign in → welcome branch mounts, guest unmounts, label flips to "Sign out"
        await userEvent.click(signButton);
        const welcome = root.querySelector('.card.welcome');
        expect(welcome).toBeTruthy();
        expect(welcome?.textContent).toContain('Welcome back');
        expect(welcome?.textContent).toContain('You are signed in.');
        expect(root.querySelector('.card.guest')).toBeNull();
        expect(signButton.textContent?.trim()).toBe('Sign out');

        // sign out again → welcome unmounts, guest re-mounts, label back to "Sign in"
        await userEvent.click(signButton);
        expect(root.querySelector('.card.welcome')).toBeNull();
        expect(root.querySelector('.card.guest')).toBeTruthy();
        expect(signButton.textContent?.trim()).toBe('Sign in');

        // hide tip → tip branch ('' empty branch) unmounts, label flips to "Show tip"
        await userEvent.click(tipButton);
        expect(root.querySelector('.tip')).toBeNull();
        expect(tipButton.textContent?.trim()).toBe('Show tip');

        // show tip again → tip re-mounts, label back to "Hide tip"
        await userEvent.click(tipButton);
        expect(root.querySelector('.tip')).toBeTruthy();
        expect(tipButton.textContent?.trim()).toBe('Hide tip');

        // both conditionals are independent: sign in while tip is shown
        await userEvent.click(signButton);
        expect(root.querySelector('.card.welcome')).toBeTruthy();
        expect(root.querySelector('.tip')).toBeTruthy();
    },
};
