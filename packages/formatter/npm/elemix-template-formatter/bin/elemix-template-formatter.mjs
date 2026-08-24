#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ext = process.platform === 'win32' ? '.exe' : '';
const pkg = `@neuralfog/elemix-template-formatter-${process.platform}-${process.arch}`;

let bin;
try {
    bin = join(
        dirname(require.resolve(`${pkg}/package.json`)),
        `elemix-template-formatter${ext}`,
    );
} catch {
    console.error(
        `elemix-template-formatter: no prebuilt binary for ${process.platform}-${process.arch} ` +
            `(missing optional dependency ${pkg}).`,
    );
    process.exit(1);
}

const { status, error } = spawnSync(bin, process.argv.slice(2), {
    stdio: 'inherit',
});
if (error) {
    console.error(
        `elemix-template-formatter: failed to launch ${bin}: ${error.message}`,
    );
    process.exit(1);
}
process.exit(status ?? 1);
