#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bin =
    process.env.ELEMIX_ANALYZER ??
    join(here, '..', 'target', 'release', 'elemix-analyzer');
const { status, error } = spawnSync(bin, process.argv.slice(2), {
    stdio: 'inherit',
});
if (error) {
    console.error(`elemix-analyzer: failed to launch ${bin}: ${error.message}`);
    process.exit(1);
}
process.exit(status ?? 1);
