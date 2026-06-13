// Finalize the wasm-pack-generated pkg/package.json. The npm name must differ
// from the native launcher (`@neuralfog/elemix-compiler`), so the wasm build
// ships as `@neuralfog/elemix-compiler-wasm`. An optional version arg overrides
// the Cargo-derived version (the release stamps it from the tag, like the
// binary packages); description/license/repository flow from Cargo.toml.
//   usage: node scripts/wasm-pkg.mjs [version]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
const pkgPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'pkg',
    'package.json',
);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.name = '@neuralfog/elemix-compiler-wasm';
if (version) pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`pkg: ${pkg.name}@${pkg.version}`);
