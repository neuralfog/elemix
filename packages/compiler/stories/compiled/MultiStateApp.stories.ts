import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/MultiStateApp';

export default { title: 'Compiled/MultiStateApp' };

export const Default = {
    render: () => '<multi-state-app></multi-state-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const count = find('.count', canvasElement);
        const name = find('.name', canvasElement);
        const status = find('.status', canvasElement);
        if (!count || !name || !status)
            throw new Error('multi-state-app missing count/name/status');

        // buttons in DOM order: +1, reset, toggle status, rename
        const buttons = query('button', canvasElement);
        const incBtn = buttons[0];
        const resetBtn = buttons[1];
        const toggleBtn = buttons[2];
        const renameBtn = buttons[3];
        expect(incBtn.textContent).toBe('+1');
        expect(resetBtn.textContent).toBe('reset');
        expect(toggleBtn.textContent).toBe('toggle status');
        expect(renameBtn.textContent).toBe('rename');

        // initial slices
        expect(count.textContent).toBe('0');
        expect(name.textContent).toBe('Ada');
        expect(status.textContent).toBe('online');

        // +1 three times bumps the counter slice only; user slice untouched
        click(incBtn);
        click(incBtn);
        click(incBtn);
        expect(count.textContent).toBe('3');
        expect(name.textContent).toBe('Ada');
        expect(status.textContent).toBe('online');

        // reset zeroes the counter; user slice still untouched
        click(resetBtn);
        expect(count.textContent).toBe('0');
        expect(name.textContent).toBe('Ada');

        // counter still works after reset
        click(incBtn);
        expect(count.textContent).toBe('1');

        // toggle status flips online -> offline, then back; counter untouched
        click(toggleBtn);
        expect(status.textContent).toBe('offline');
        expect(count.textContent).toBe('1');
        click(toggleBtn);
        expect(status.textContent).toBe('online');

        // rename flips Ada -> Grace -> Ada; counter + status untouched
        click(renameBtn);
        expect(name.textContent).toBe('Grace');
        expect(count.textContent).toBe('1');
        expect(status.textContent).toBe('online');
        click(renameBtn);
        expect(name.textContent).toBe('Ada');
    },
};
