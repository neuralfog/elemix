#!/usr/bin/env bun
import { build, dev } from './build';

const command = process.argv[2];

if (command === 'dev') {
    await dev();
} else if (command === 'build') {
    await build();
} else {
    console.error(
        `elemix-ssr: unknown command ${command ?? '(none)'}, expected "dev" or "build"`,
    );
    process.exit(1);
}
