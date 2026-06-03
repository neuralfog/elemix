import { expect, test, describe } from 'vitest';
import { Reactive, UNSUPPORTED_COLLECTION_ERROR_MESSAGE } from '../reactive';

describe('Reactive — unsupported collection types', () => {
    const cases: Array<{ label: string; value: object }> = [
        { label: 'Map', value: new Map() },
        { label: 'WeakMap', value: new WeakMap() },
        { label: 'Set', value: new Set() },
        { label: 'WeakSet', value: new WeakSet() },
    ];

    for (const { label, value } of cases) {
        test(`rejects ${label} when read back through the reactive proxy`, () => {
            const reactive = new Reactive<{ data: unknown }>({
                data: value,
            });
            expect(() => {
                // reading `data` triggers the get-trap collection check
                void reactive.value.data;
            }).toThrow(UNSUPPORTED_COLLECTION_ERROR_MESSAGE);
        });
    }
});
