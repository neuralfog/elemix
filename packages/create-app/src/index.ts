import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const TEMPLATE = 'https://github.com/neuralfog/elemix-template.git';

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    magenta: '\x1b[35m',
};

const mark = `${c.magenta}▐▌${c.reset}`;

const version = (): string => {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
        readFileSync(join(here, '..', 'package.json'), 'utf8'),
    );
    return pkg.version;
};

const banner = (): void => {
    process.stderr.write('\n');
    process.stderr.write(
        `  ${mark}  ${c.bold}elemix${c.reset} ${c.dim}·${c.reset} create app\n`,
    );
    process.stderr.write(`  ${mark}  ${c.dim}v${version()}${c.reset}\n`);
    process.stderr.write('\n');
};

const die = (message: string): never => {
    process.stderr.write(`  ${c.red}error${c.reset}  ${message}\n\n`);
    process.exit(1);
};

const ask = (question: string, fallback: string): Promise<string> => {
    const rl = createInterface({
        input: process.stdin,
        output: process.stderr,
    });
    return new Promise((res) => {
        rl.question(
            `  ${mark}  ${question} ${c.dim}(${fallback})${c.reset} `,
            (answer) => {
                rl.close();
                res(answer.trim() || fallback);
            },
        );
    });
};

const hasGit = (): boolean => {
    try {
        execFileSync('git', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
};

const main = async (): Promise<void> => {
    banner();

    if (!hasGit()) {
        die('git is required but was not found on your PATH.');
    }

    const arg = process.argv[2];
    const name = arg ?? (await ask('Project directory', 'elemix-app'));
    const dir = resolve(process.cwd(), name);

    if (existsSync(dir) && readdirSync(dir).length > 0) {
        die(`${name} already exists and is not empty.`);
    }

    process.stderr.write(
        `  ${mark}  cloning template into ${c.bold}${name}${c.reset}\n`,
    );
    try {
        execFileSync('git', ['clone', '--depth', '1', TEMPLATE, dir], {
            stdio: 'ignore',
        });
    } catch {
        die(`failed to clone ${TEMPLATE}`);
    }

    rmSync(join(dir, '.git'), { recursive: true, force: true });

    process.stderr.write(
        `\n  ${c.green}✓${c.reset}  ${c.bold}${name}${c.reset} is ready\n\n`,
    );
    process.stderr.write(`  ${c.dim}next steps${c.reset}\n`);
    process.stderr.write(`    cd ${name}\n`);
    process.stderr.write('    pnpm install\n');
    process.stderr.write('    pnpm dev\n\n');
};

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
