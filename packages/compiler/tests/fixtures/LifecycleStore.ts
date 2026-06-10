import { state } from '@neuralfog/elemix';

export type LogEntry = { id: number; event: string };

export const log = state<{ entries: LogEntry[] }>({ entries: [] });

let seq = 0;

export const record = (event: string): void => {
    seq++;
    log.entries.push({ id: seq, event });
};

export const clearLog = (): void => {
    seq = 0;
    log.entries.splice(0);
};
