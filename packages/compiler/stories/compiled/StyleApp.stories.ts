import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/StyleApp';

export default { title: 'Compiled/StyleApp' };

export const Default = {
    render: () => '<style-app></style-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const box = find<HTMLElement>('.box', canvasElement);
        if (!box) throw new Error('style-app missing .box');

        const buttons = query('button', canvasElement);
        const colorBtn = buttons[0];
        const sizeBtn = buttons[1];
        const bgBtn = buttons[2];

        expect(box.style.color).toBe('rgb(30, 41, 59)'); // #1e293b
        expect(box.style.fontSize).toBe('18px');
        expect(box.style.background).toBe('rgb(224, 231, 255)'); // #e0e7ff

        click(colorBtn);
        expect(box.style.color).toBe('rgb(255, 255, 255)'); // #ffffff
        expect(box.style.fontSize).toBe('18px');
        expect(box.style.background).toBe('rgb(224, 231, 255)');
        click(colorBtn);
        expect(box.style.color).toBe('rgb(30, 41, 59)');

        click(sizeBtn);
        expect(box.style.fontSize).toBe('22px');
        click(sizeBtn);
        expect(box.style.fontSize).toBe('26px');
        click(sizeBtn);
        expect(box.style.fontSize).toBe('30px');
        click(sizeBtn);
        expect(box.style.fontSize).toBe('14px');

        click(bgBtn);
        expect(box.style.background).toBe('rgb(99, 102, 241)'); // #6366f1
        click(bgBtn);
        expect(box.style.background).toBe('rgb(224, 231, 255)');
    },
};
