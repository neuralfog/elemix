import { expect } from '@neuralfog/elemix-testing-library';
import { type } from '@neuralfog/elemix-testing-library/events';
import { query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ModelApp';

export default { title: 'Compiled/ModelApp' };

export const Default = {
    render: () => '<model-app></model-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const inputs = query<HTMLInputElement>('input', canvasElement);
        const outs = query('.out', canvasElement);
        const nameInput = inputs[0];
        const volumeInput = inputs[1];
        const nameOut = outs[0];
        const volumeOut = outs[1];
        if (!nameInput || !volumeInput || !nameOut || !volumeOut)
            throw new Error('model-app missing inputs or .out readouts');

        expect(nameInput.value).toBe('Ada');
        expect(nameOut.textContent).toBe('Hello, Ada');

        type(nameInput, ' Lovelace');
        expect(nameInput.value).toBe('Ada Lovelace');
        expect(nameOut.textContent).toBe('Hello, Ada Lovelace');

        expect(volumeInput.value).toBe('50');
        expect(volumeOut.textContent).toBe('Volume: 50');

        type(volumeInput, '9');
        expect(volumeInput.value).toBe('100');
        expect(volumeOut.textContent).toBe('Volume: 100');
    },
};
