import { expect, userEvent } from 'storybook/test';
import './.emited/StyleApp';

export default { title: 'Compiled/StyleApp' };

export const Default = {
    render: () => '<style-app></style-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('style-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('style-app did not render a shadow root');

        const box = root.querySelector<HTMLElement>('.box');
        if (!box) throw new Error('style-app missing .box');

        // buttons in DOM order: color, size, background
        const buttons = root.querySelectorAll('button');
        const colorBtn = buttons[0];
        const sizeBtn = buttons[1];
        const bgBtn = buttons[2];

        // --- initial inline style object: color #1e293b, font-size 18px, bg #e0e7ff ---
        // browsers normalize hex colors to rgb() in inline style
        expect(box.style.color).toBe('rgb(30, 41, 59)'); // #1e293b
        expect(box.style.fontSize).toBe('18px');
        expect(box.style.background).toBe('rgb(224, 231, 255)'); // #e0e7ff

        // --- color: #1e293b -> #ffffff, and back ---
        await userEvent.click(colorBtn);
        expect(box.style.color).toBe('rgb(255, 255, 255)'); // #ffffff
        // other style declarations untouched
        expect(box.style.fontSize).toBe('18px');
        expect(box.style.background).toBe('rgb(224, 231, 255)');
        await userEvent.click(colorBtn);
        expect(box.style.color).toBe('rgb(30, 41, 59)'); // back to #1e293b

        // --- size: +4 each click until >=30, then wraps to 14 ---
        await userEvent.click(sizeBtn);
        expect(box.style.fontSize).toBe('22px'); // 18 -> 22
        await userEvent.click(sizeBtn);
        expect(box.style.fontSize).toBe('26px'); // 22 -> 26
        await userEvent.click(sizeBtn);
        expect(box.style.fontSize).toBe('30px'); // 26 -> 30
        await userEvent.click(sizeBtn);
        expect(box.style.fontSize).toBe('14px'); // >=30 wraps back to 14

        // --- background: #e0e7ff -> #6366f1, and back ---
        await userEvent.click(bgBtn);
        expect(box.style.background).toBe('rgb(99, 102, 241)'); // #6366f1
        await userEvent.click(bgBtn);
        expect(box.style.background).toBe('rgb(224, 231, 255)'); // back to #e0e7ff
    },
};
