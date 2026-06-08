import { signal } from '../../src/Signal';

export const store = signal({
    value: 'Initial Signal Value',
});

export const restoreSignal = (): void => {
    store.value.value = 'Initial Signal Value';
    store.subscribers.clear();
};
