import { expect, userEvent } from 'storybook/test';
import './.emited/MultiStateApp';

export default { title: 'Compiled/MultiStateApp' };

export const Default = {
    render: () => '<multi-state-app></multi-state-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('multi-state-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('multi-state-app did not render a shadow root');

        const count = root.querySelector('.count');
        const name = root.querySelector('.name');
        const status = root.querySelector('.status');
        if (!count || !name || !status)
            throw new Error('multi-state-app missing count/name/status');

        // buttons in DOM order: +1, reset, toggle status, rename
        const buttons = root.querySelectorAll('button');
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
        await userEvent.click(incBtn);
        await userEvent.click(incBtn);
        await userEvent.click(incBtn);
        expect(count.textContent).toBe('3');
        expect(name.textContent).toBe('Ada');
        expect(status.textContent).toBe('online');

        // reset zeroes the counter; user slice still untouched
        await userEvent.click(resetBtn);
        expect(count.textContent).toBe('0');
        expect(name.textContent).toBe('Ada');

        // counter still works after reset
        await userEvent.click(incBtn);
        expect(count.textContent).toBe('1');

        // toggle status flips online -> offline, then back; counter untouched
        await userEvent.click(toggleBtn);
        expect(status.textContent).toBe('offline');
        expect(count.textContent).toBe('1');
        await userEvent.click(toggleBtn);
        expect(status.textContent).toBe('online');

        // rename flips Ada -> Grace -> Ada; counter + status untouched
        await userEvent.click(renameBtn);
        expect(name.textContent).toBe('Grace');
        expect(count.textContent).toBe('1');
        expect(status.textContent).toBe('online');
        await userEvent.click(renameBtn);
        expect(name.textContent).toBe('Ada');
    },
};
