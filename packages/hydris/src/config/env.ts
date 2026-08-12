const read = (field: string): string | undefined => process.env[field];

export const env = {
    get(field: string, fallback?: string): string | undefined {
        return read(field) ?? fallback;
    },

    mandatory(field: string): string {
        const value = read(field);
        if (value === undefined || value === '') {
            throw new Error(`Missing mandatory environment variable: ${field}`);
        }
        return value;
    },

    boolean(field: string, fallback = false): boolean {
        const value = read(field);
        if (value === undefined) return fallback;
        return value === 'true' || value === 'True' || value === 'TRUE';
    },

    number(field: string, fallback?: number): number {
        const value = read(field);
        if (value === undefined) return fallback ?? Number.NaN;
        return Number(value);
    },

    list(field: string, fallback: string[] = []): string[] {
        const value = read(field);
        if (value === undefined) return fallback;
        const parts = value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        return parts.length ? parts : fallback;
    },
};
