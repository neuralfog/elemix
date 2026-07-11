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

        // buttons in DOM order: color, size, background
        const buttons = query('button', canvasElement);
        const colorBtn = buttons[0];
        const sizeBtn = buttons[1];
        const bgBtn = buttons[2];

        // --- initial inline style object: color #1e293b, font-size 18px, bg #e0e7ff ---
        // browsers normalize hex colors to rgb() in inline style
        expect(box.style.color).toBe('rgb(30, 41, 59)'); // #1e293b
        expect(box.style.fontSize).toBe('18px');
        expect(box.style.background).toBe('rgb(224, 231, 255)'); // #e0e7ff

        // --- color: #1e293b -> #ffffff, and back ---
        click(colorBtn);
        expect(box.style.color).toBe('rgb(255, 255, 255)'); // #ffffff
        // other style declarations untouched
        expect(box.style.fontSize).toBe('18px');
        expect(box.style.background).toBe('rgb(224, 231, 255)');
        click(colorBtn);
        expect(box.style.color).toBe('rgb(30, 41, 59)'); // back to #1e293b

        // --- size: +4 each click until >=30, then wraps to 14 ---
        click(sizeBtn);
        expect(box.style.fontSize).toBe('22px'); // 18 -> 22
        click(sizeBtn);
        expect(box.style.fontSize).toBe('26px'); // 22 -> 26
        click(sizeBtn);
        expect(box.style.fontSize).toBe('30px'); // 26 -> 30
        click(sizeBtn);
        expect(box.style.fontSize).toBe('14px'); // >=30 wraps back to 14

        // --- background: #e0e7ff -> #6366f1, and back ---
        click(bgBtn);
        expect(box.style.background).toBe('rgb(99, 102, 241)'); // #6366f1
        click(bgBtn);
        expect(box.style.background).toBe('rgb(224, 231, 255)'); // back to #e0e7ff
    },
};
