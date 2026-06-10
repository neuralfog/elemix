import { expect, userEvent } from 'storybook/test';
import './.emited/AttrApp';

export default { title: 'Compiled/AttrApp' };

export const Default = {
    render: () => '<attr-app></attr-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('attr-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('attr-app did not render a shadow root');

        const link = root.querySelector('a.link');
        const badge = root.querySelector('span.badge');
        const secret = root.querySelector('.secret');
        if (!link || !badge || !secret)
            throw new Error('attr-app missing link/badge/secret');

        // buttons in DOM order: next user, rename, toggle secret
        const buttons = root.querySelectorAll('button');
        const nextBtn = buttons[0];
        const renameBtn = buttons[1];
        const toggleBtn = buttons[2];

        // --- initial: userId 1, label Ada, collapsed false ---
        expect(link.textContent?.trim()).toBe('Open profile #1');
        // interpolated href attr + title attr (both bound to state)
        expect(link.getAttribute('href')).toBe('/users/1');
        expect(link.getAttribute('title')).toBe('Ada');
        // badge text + data-* / aria-* attrs
        expect(badge.textContent?.trim()).toBe('Ada');
        expect(badge.getAttribute('data-count')).toBe('1');
        expect(badge.getAttribute('aria-label')).toBe('Ada');
        // collapsed=false -> hidden boolean attr absent (content visible)
        expect(secret.hasAttribute('hidden')).toBe(false);

        // --- next user: userId 1 -> 2 -> 3, href/data-count/text all track it ---
        await userEvent.click(nextBtn);
        expect(link.textContent?.trim()).toBe('Open profile #2');
        expect(link.getAttribute('href')).toBe('/users/2');
        expect(badge.getAttribute('data-count')).toBe('2');
        await userEvent.click(nextBtn);
        expect(link.textContent?.trim()).toBe('Open profile #3');
        expect(link.getAttribute('href')).toBe('/users/3');
        expect(badge.getAttribute('data-count')).toBe('3');

        // --- rename: Ada -> Grace (title + aria-label + badge text) ---
        await userEvent.click(renameBtn);
        expect(badge.textContent?.trim()).toBe('Grace');
        expect(badge.getAttribute('aria-label')).toBe('Grace');
        expect(link.getAttribute('title')).toBe('Grace');
        // rename back: Grace -> Ada
        await userEvent.click(renameBtn);
        expect(badge.textContent?.trim()).toBe('Ada');
        expect(badge.getAttribute('aria-label')).toBe('Ada');
        expect(link.getAttribute('title')).toBe('Ada');

        // --- toggle secret: boolean attr presence flips both directions ---
        await userEvent.click(toggleBtn);
        expect(secret.hasAttribute('hidden')).toBe(true);
        await userEvent.click(toggleBtn);
        expect(secret.hasAttribute('hidden')).toBe(false);
    },
};
