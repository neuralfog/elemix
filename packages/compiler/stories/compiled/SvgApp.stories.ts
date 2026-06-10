import { expect, userEvent } from 'storybook/test';
import './.emited/SvgApp';

export default { title: 'Compiled/SvgApp' };

export const Default = {
    render: () => '<svg-app></svg-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('svg-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('svg-app did not render a shadow root');

        const circle = root.querySelector('circle');
        if (!circle) throw new Error('svg-app missing circle');

        // buttons in DOM order: move, grow, recolor
        const buttons = root.querySelectorAll('button');
        const moveBtn = buttons[0];
        const growBtn = buttons[1];
        const recolorBtn = buttons[2];
        if (!moveBtn || !growBtn || !recolorBtn) {
            throw new Error('svg-app missing one of move/grow/recolor buttons');
        }
        expect(moveBtn.textContent?.trim()).toBe('move');
        expect(growBtn.textContent?.trim()).toBe('grow');
        expect(recolorBtn.textContent?.trim()).toBe('recolor');

        // the circle binds cx/cy/r/fill via setAttribute in the SVG namespace
        expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');

        // initial attribute values
        expect(circle.getAttribute('cx')).toBe('100');
        expect(circle.getAttribute('cy')).toBe('100');
        expect(circle.getAttribute('r')).toBe('40');
        expect(circle.getAttribute('fill')).toBe('#6366f1');

        // move toggles cx 100->60 and cy 100->140
        await userEvent.click(moveBtn);
        expect(circle.getAttribute('cx')).toBe('60');
        expect(circle.getAttribute('cy')).toBe('140');
        // move again toggles back to the origin
        await userEvent.click(moveBtn);
        expect(circle.getAttribute('cx')).toBe('100');
        expect(circle.getAttribute('cy')).toBe('100');

        // grow steps r by 20: 40 -> 60 -> 80, then wraps to 20
        await userEvent.click(growBtn);
        expect(circle.getAttribute('r')).toBe('60');
        await userEvent.click(growBtn);
        expect(circle.getAttribute('r')).toBe('80');
        await userEvent.click(growBtn); // r >= 80 -> wrap to 20
        expect(circle.getAttribute('r')).toBe('20');
        await userEvent.click(growBtn);
        expect(circle.getAttribute('r')).toBe('40');

        // recolor cycles through the 4-color palette and wraps back to the first
        await userEvent.click(recolorBtn);
        expect(circle.getAttribute('fill')).toBe('#ef4444');
        await userEvent.click(recolorBtn);
        expect(circle.getAttribute('fill')).toBe('#22c55e');
        await userEvent.click(recolorBtn);
        expect(circle.getAttribute('fill')).toBe('#f59e0b');
        await userEvent.click(recolorBtn); // wraps back to COLORS[0]
        expect(circle.getAttribute('fill')).toBe('#6366f1');
    },
};
