import { expect } from '@neuralfog/elemix-testing-library';
import { type } from '@neuralfog/elemix-testing-library/events';
import { query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ModelForwardApp';

export default { title: 'Compiled/ModelForwardApp' };

export const Default = {
    render: () => '<model-forward-app></model-forward-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const input = query<HTMLInputElement>('input', canvasElement)[0];
        const out = query('.out', canvasElement)[0];
        if (!input || !out)
            throw new Error('model-forward-app missing input or .out readout');

        expect(input.value).toBe('Ada');
        expect(out.textContent).toBe('Hello, Ada');

        type(input, ' Lovelace');
        expect(input.value).toBe('Ada Lovelace');
        expect(out.textContent).toBe('Hello, Ada Lovelace');
    },
};
