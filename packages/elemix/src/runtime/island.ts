export const $__island = <T = unknown>(id: string): T | undefined => {
    if (typeof document === 'undefined') return undefined;
    const el = document.getElementById(id);
    const text = el?.textContent;
    if (!text) return undefined;
    try {
        return JSON.parse(text) as T;
    } catch {
        return undefined;
    }
};
