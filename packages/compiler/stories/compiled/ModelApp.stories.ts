import { expect } from '@neuralfog/elemix-testing-library';
import { type } from '@neuralfog/elemix-testing-library/events';
import { query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ModelApp';

export default { title: 'Compiled/ModelApp' };

export const Default = {
    render: () => '<model-app></model-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // input[0] / .out[0]  -> name (~model)
        // input[1] / .out[1]  -> volume (~model + ~onmodel clamp 0–100)
        const inputs = query<HTMLInputElement>('input', canvasElement);
        const outs = query('.out', canvasElement);
        const nameInput = inputs[0];
        const volumeInput = inputs[1];
        const nameOut = outs[0];
        const volumeOut = outs[1];
        if (!nameInput || !volumeInput || !nameOut || !volumeOut)
            throw new Error('model-app missing inputs or .out readouts');

        // --- name field: plain two-way ~model ---
        // initial ref value is "Ada"
        expect(nameInput.value).toBe('Ada');
        expect(nameOut.textContent).toBe('Hello, Ada');

        // two-way _model binding: typing flows straight through to the readout
        type(nameInput, ' Lovelace');
        expect(nameInput.value).toBe('Ada Lovelace');
        expect(nameOut.textContent).toBe('Hello, Ada Lovelace');

        // --- volume field: ~model + ~onmodel transform (clamp 0–100) ---
        // initial ref value is "50"
        expect(volumeInput.value).toBe('50');
        expect(volumeOut.textContent).toBe('Volume: 50');

        // append-typing exercises the clamp on every keystroke. "50" + "9" -> "509"
        // -> clamp -> "100". The clamped value is written back into the input (two-way).
        type(volumeInput, '9');
        expect(volumeInput.value).toBe('100');
        expect(volumeOut.textContent).toBe('Volume: 100');
    },
};
