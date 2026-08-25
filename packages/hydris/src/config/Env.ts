export class Env {
    private static read(field: string): string | undefined {
        return process.env[field];
    }

    static get(field: string, fallback?: string): string | undefined {
        return Env.read(field) ?? fallback;
    }

    static mandatory(field: string): string {
        const value = Env.read(field);
        if (value === undefined || value === '') {
            throw new Error(`Missing mandatory environment variable: ${field}`);
        }
        return value;
    }

    static boolean(field: string, fallback = false): boolean {
        const value = Env.read(field);
        if (value === undefined) return fallback;
        return value === 'true' || value === 'True' || value === 'TRUE';
    }

    static number(field: string, fallback?: number): number {
        const value = Env.read(field);
        if (value === undefined) return fallback ?? Number.NaN;
        return Number(value);
    }

    static list(field: string, fallback: string[] = []): string[] {
        const value = Env.read(field);
        if (value === undefined) return fallback;
        const parts = value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        return parts.length ? parts : fallback;
    }
}
