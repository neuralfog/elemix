export type MutationTarget = { onMutation?(): void };

let owner: MutationTarget | null = null;
const pending = new Set<MutationTarget>();
let scheduled = false;

const flush = (): void => {
    scheduled = false;
    const batch = [...pending];
    pending.clear();
    for (const target of batch) target.onMutation?.();
};

export const currentOwner = (): MutationTarget | null => owner;

export const withOwner = <T>(target: MutationTarget | null, fn: () => T): T => {
    const prev = owner;
    owner = target;
    try {
        return fn();
    } finally {
        owner = prev;
    }
};

export const markMutation = (target: MutationTarget | null): void => {
    if (!target) return;
    pending.add(target);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(flush);
};
