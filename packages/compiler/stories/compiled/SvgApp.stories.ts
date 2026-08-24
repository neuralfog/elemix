import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/SvgApp';

export default { title: 'Compiled/SvgApp' };

export const Default = {
    render: () => '<svg-app></svg-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const circle = find('circle', canvasElement);
        if (!circle) throw new Error('svg-app missing circle');

        const buttons = query('button', canvasElement);
        const moveBtn = buttons[0];
        const growBtn = buttons[1];
        const recolorBtn = buttons[2];
        if (!moveBtn || !growBtn || !recolorBtn) {
            throw new Error('svg-app missing one of move/grow/recolor buttons');
        }
        expect(moveBtn.textContent?.trim()).toBe('move');
        expect(growBtn.textContent?.trim()).toBe('grow');
        expect(recolorBtn.textContent?.trim()).toBe('recolor');

        expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');

        expect(circle.getAttribute('cx')).toBe('100');
        expect(circle.getAttribute('cy')).toBe('100');
        expect(circle.getAttribute('r')).toBe('40');
        expect(circle.getAttribute('fill')).toBe('#6366f1');

        click(moveBtn);
        expect(circle.getAttribute('cx')).toBe('60');
        expect(circle.getAttribute('cy')).toBe('140');
        click(moveBtn);
        expect(circle.getAttribute('cx')).toBe('100');
        expect(circle.getAttribute('cy')).toBe('100');

        click(growBtn);
        expect(circle.getAttribute('r')).toBe('60');
        click(growBtn);
        expect(circle.getAttribute('r')).toBe('80');
        click(growBtn);
        expect(circle.getAttribute('r')).toBe('20');
        click(growBtn);
        expect(circle.getAttribute('r')).toBe('40');

        click(recolorBtn);
        expect(circle.getAttribute('fill')).toBe('#ef4444');
        click(recolorBtn);
        expect(circle.getAttribute('fill')).toBe('#22c55e');
        click(recolorBtn);
        expect(circle.getAttribute('fill')).toBe('#f59e0b');
        click(recolorBtn);
        expect(circle.getAttribute('fill')).toBe('#6366f1');
    },
};
