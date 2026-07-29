import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PID_FILE = join(HARNESS_ROOT, 'tests', '.server.pid');

export const PORT = Number(process.env.HARNESS_PORT ?? 4319);
export const BASE_URL = `http://localhost:${PORT}`;

const run = (command: string, args: string[]): Promise<void> =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: HARNESS_ROOT,
            stdio: 'inherit',
        });
        child.on('error', reject);
        child.on('close', (code) =>
            code === 0
                ? resolve()
                : reject(
                      new Error(`${command} ${args.join(' ')} exited ${code}`),
                  ),
        );
    });

const waitForReady = async (timeoutMs: number): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const ok = await fetch(BASE_URL, { redirect: 'manual' })
            .then((res) => res.status > 0)
            .catch(() => false);
        if (ok) return;
        await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(
        `harness did not respond at ${BASE_URL} within ${timeoutMs}ms`,
    );
};

export const startHarness = async (): Promise<void> => {
    if (!process.env.HARNESS_SKIP_BUILD) {
        await run('pnpm', ['build']);
    }

    const server = spawn('bun', ['./dist/index.js'], {
        cwd: HARNESS_ROOT,
        env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
        detached: true,
        stdio: 'ignore',
    });
    server.unref();
    if (server.pid === undefined) {
        throw new Error('failed to spawn harness server');
    }
    writeFileSync(PID_FILE, String(server.pid));

    await waitForReady(30_000);
};

export const stopHarness = (): void => {
    if (!existsSync(PID_FILE)) return;
    const pid = Number(readFileSync(PID_FILE, 'utf8').trim());
    rmSync(PID_FILE, { force: true });
    try {
        process.kill(-pid, 'SIGTERM');
    } catch {
        return;
    }
};
