// Finalize the wasm-pack-generated pkg/package.json. The npm name must differ
// from the native launcher (`@neuralfog/elemix-compiler`), so the wasm build
// ships as `@neuralfog/elemix-compiler-wasm`. Everything else (version,
// description, license, repository) flows from Cargo.toml via wasm-pack.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'pkg',
    'package.json',
);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.name = '@neuralfog/elemix-compiler-wasm';
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`pkg: ${pkg.name}@${pkg.version}`);
