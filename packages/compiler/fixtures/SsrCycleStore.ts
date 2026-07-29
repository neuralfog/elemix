export type CycleEntry = { id: number; event: string };

// #state
export const cycle: { entries: CycleEntry[] } = { entries: [] };

let seq = 0;

export const record = (event: string): void => {
    seq++;
    cycle.entries.push({ id: seq, event });
};
