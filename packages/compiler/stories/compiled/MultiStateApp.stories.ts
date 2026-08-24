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

        const buttons = query('button', canvasElement);
        const incBtn = buttons[0];
        const resetBtn = buttons[1];
        const toggleBtn = buttons[2];
        const renameBtn = buttons[3];
        expect(incBtn.textContent).toBe('+1');
        expect(resetBtn.textContent).toBe('reset');
        expect(toggleBtn.textContent).toBe('toggle status');
        expect(renameBtn.textContent).toBe('rename');

        expect(count.textContent).toBe('0');
        expect(name.textContent).toBe('Ada');
        expect(status.textContent).toBe('online');

        click(incBtn);
        click(incBtn);
        click(incBtn);
        expect(count.textContent).toBe('3');
        expect(name.textContent).toBe('Ada');
        expect(status.textContent).toBe('online');

        click(resetBtn);
        expect(count.textContent).toBe('0');
        expect(name.textContent).toBe('Ada');

        click(incBtn);
        expect(count.textContent).toBe('1');

        click(toggleBtn);
        expect(status.textContent).toBe('offline');
        expect(count.textContent).toBe('1');
        click(toggleBtn);
        expect(status.textContent).toBe('online');

        click(renameBtn);
        expect(name.textContent).toBe('Grace');
        expect(count.textContent).toBe('1');
        expect(status.textContent).toBe('online');
        click(renameBtn);
        expect(name.textContent).toBe('Ada');
    },
};
