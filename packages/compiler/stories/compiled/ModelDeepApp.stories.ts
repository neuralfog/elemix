import { expect } from '@neuralfog/elemix-testing-library';
import { type } from '@neuralfog/elemix-testing-library/events';
import { query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ModelDeepApp';

export default { title: 'Compiled/ModelDeepApp' };

export const Default = {
    render: () => '<model-deep-app></model-deep-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // The ref lives in the root (#state) and is forwarded down three nested
        // components (outer > middle > inner) via :model props before the leaf
        // binds it with ~model. Typing must still flow back to the root readout.
        const input = query<HTMLInputElement>('input', canvasElement)[0];
        const out = query('.out', canvasElement)[0];
        if (!input || !out)
            throw new Error('model-deep-app missing input or .out readout');

        expect(input.value).toBe('Ada');
        expect(out.textContent).toBe('Hello, Ada');

        type(input, ' Lovelace');
        expect(input.value).toBe('Ada Lovelace');
        expect(out.textContent).toBe('Hello, Ada Lovelace');
    },
};
