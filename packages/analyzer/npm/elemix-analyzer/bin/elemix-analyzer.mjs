#!/usr/bin/env node
// Launcher: resolve the prebuilt binary for this host from the matching
// platform package (installed via optionalDependencies) and exec it,
// forwarding argv and the exit code untouched.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ext = process.platform === 'win32' ? '.exe' : '';
const pkg = `@neuralfog/elemix-analyzer-${process.platform}-${process.arch}`;

let bin;
try {
    // Resolve the package.json (always present, no exports gate) and sit the
    // binary next to it — the binary itself has no extension, so it cannot be
    // require.resolve'd directly.
    bin = join(dirname(require.resolve(`${pkg}/package.json`)), `elemix-analyzer${ext}`);
} catch {
    console.error(
        `elemix-analyzer: no prebuilt binary for ${process.platform}-${process.arch} ` +
            `(missing optional dependency ${pkg}).`,
    );
    process.exit(1);
}

const { status, error } = spawnSync(bin, process.argv.slice(2), {
    stdio: 'inherit',
});
if (error) {
    console.error(`elemix-analyzer: failed to launch ${bin}: ${error.message}`);
    process.exit(1);
}
process.exit(status ?? 1);
