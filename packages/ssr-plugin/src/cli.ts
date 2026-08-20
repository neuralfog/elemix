#!/usr/bin/env bun
import { build, dev } from './build';

const args = process.argv.slice(2);
const command = args[0];

const hostFlag = args.indexOf('--host');
const host =
    hostFlag === -1
        ? undefined
        : args[hostFlag + 1] && !args[hostFlag + 1].startsWith('-')
          ? args[hostFlag + 1]
          : '0.0.0.0';

if (command === 'dev') {
    await dev({ host });
} else if (command === 'build') {
    await build();
} else {
    console.error(
        `elemix-ssr: unknown command ${command ?? '(none)'}, expected "dev" or "build"`,
    );
    process.exit(1);
}
