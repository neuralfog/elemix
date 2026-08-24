import { expect } from '@neuralfog/elemix-testing-library';
import { query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ResetProbeLight';

export default { title: 'Compiled/ResetProbeLight' };

type ConfigWindow = {
    __elemix__?: { config?: Record<string, unknown> };
};

export const Default = {
    render: () => {
        const w = window as unknown as ConfigWindow;
        w.__elemix__ = {
            config: {
                ...(w.__elemix__?.config ?? {}),
                reset: '.reset-probe{color:rgb(7,8,9)}',
            },
        };
        return '<reset-probe-light></reset-probe-light>';
    },
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const el = query('.reset-probe', canvasElement)[0];
        if (!el) throw new Error('reset-probe element missing');

        expect(el.textContent).toBe('probe');
        expect(getComputedStyle(el).color).toBe('rgb(7, 8, 9)');
    },
};
