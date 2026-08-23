import { $__setStorePersister } from '@neuralfog/elemix/runtime';

const PREFIX = 'store.';
const MAX_BYTES = 4096;
const YEAR = 60 * 60 * 24 * 365;

const write = (name: string, value: string): void => {
    const cookie = `${PREFIX}${name}=${encodeURIComponent(
        value,
    )}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
    if (cookie.length > MAX_BYTES) {
        throw new Error(
            `store "${name}" exceeds the ${MAX_BYTES} byte cookie limit (${cookie.length}); keep client stores small and store larger data server-side`,
        );
    }
    document.cookie = cookie;
};

if (typeof document !== 'undefined') {
    const pending = new Map<string, string>();
    let scheduled = false;
    const flush = (): void => {
        scheduled = false;
        const entries = [...pending];
        pending.clear();
        for (const [name, value] of entries) write(name, value);
    };
    $__setStorePersister((name, value) => {
        pending.set(name, value);
        if (!scheduled) {
            scheduled = true;
            queueMicrotask(flush);
        }
    });
}
