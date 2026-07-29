import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const devBinary = (): string | null => {
    const target = `${import.meta.dir}/../../compiler/target`;
    const release = `${target}/release/elemix-compiler`;
    const debug = `${target}/debug/elemix-compiler`;
    const built = (path: string): number =>
        existsSync(path) ? statSync(path).mtimeMs : -1;
    const rt = built(release);
    const dt = built(debug);
    if (rt < 0 && dt < 0) return null;
    return rt >= dt ? release : debug;
};

const platformPackage = (): string | null => {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const pkg = `@neuralfog/elemix-compiler-${process.platform}-${process.arch}`;
    try {
        const pkgJson = require.resolve(`${pkg}/package.json`);
        return join(dirname(pkgJson), `elemix-compiler${ext}`);
    } catch {
        return null;
    }
};

export const resolveCompiler = (): string =>
    process.env.ELEMIX_COMPILER ??
    devBinary() ??
    platformPackage() ??
    `${import.meta.dir}/../../compiler/target/release/elemix-compiler`;
