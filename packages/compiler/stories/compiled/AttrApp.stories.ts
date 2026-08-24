import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/AttrApp';

export default { title: 'Compiled/AttrApp' };

export const Default = {
    render: () => '<attr-app></attr-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const link = find('a.link', canvasElement);
        const badge = find('span.badge', canvasElement);
        const secret = find('.secret', canvasElement);
        if (!link || !badge || !secret)
            throw new Error('attr-app missing link/badge/secret');

        const buttons = query('button', canvasElement);
        const nextBtn = buttons[0];
        const renameBtn = buttons[1];
        const toggleBtn = buttons[2];

        expect(link.textContent?.trim()).toBe('Open profile #1');
        expect(link.getAttribute('href')).toBe('/users/1');
        expect(link.getAttribute('title')).toBe('Ada');
        expect(badge.textContent?.trim()).toBe('Ada');
        expect(badge.getAttribute('data-count')).toBe('1');
        expect(badge.getAttribute('aria-label')).toBe('Ada');
        expect(secret.hasAttribute('hidden')).toBe(false);

        click(nextBtn);
        expect(link.textContent?.trim()).toBe('Open profile #2');
        expect(link.getAttribute('href')).toBe('/users/2');
        expect(badge.getAttribute('data-count')).toBe('2');
        click(nextBtn);
        expect(link.textContent?.trim()).toBe('Open profile #3');
        expect(link.getAttribute('href')).toBe('/users/3');
        expect(badge.getAttribute('data-count')).toBe('3');

        click(renameBtn);
        expect(badge.textContent?.trim()).toBe('Grace');
        expect(badge.getAttribute('aria-label')).toBe('Grace');
        expect(link.getAttribute('title')).toBe('Grace');
        click(renameBtn);
        expect(badge.textContent?.trim()).toBe('Ada');
        expect(badge.getAttribute('aria-label')).toBe('Ada');
        expect(link.getAttribute('title')).toBe('Ada');

        click(toggleBtn);
        expect(secret.hasAttribute('hidden')).toBe(true);
        click(toggleBtn);
        expect(secret.hasAttribute('hidden')).toBe(false);
    },
};
