import { signal } from '../../src/Signal';

export const CUSTOM_SIGNAL_FLAG = 'user defined signal flag';

export const signalWithFlag = signal(
    {
        value: 'Initial Signal Value',
    },
    CUSTOM_SIGNAL_FLAG,
);
