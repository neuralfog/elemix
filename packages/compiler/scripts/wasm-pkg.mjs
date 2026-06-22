// Finalize the wasm-pack-generated pkg/package.json. The npm name must differ
// from the native launcher (`@neuralfog/elemix-compiler`), so the wasm build
// ships as `@neuralfog/elemix-compiler-wasm`. An optional version arg overrides
// the Cargo-derived version (the release stamps it from the tag, like the
// binary packages); description/license/repository flow from Cargo.toml.
//   usage: node scripts/wasm-pkg.mjs [version]
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];
const pkgPath = join(here, '..', 'pkg', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.name = '@neuralfog/elemix-compiler-wasm';
if (version) pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// wasm-pack copies the crate README (CLI docs) into pkg — wrong for a browser
// module. Override it with the wasm-specific one.
copyFileSync(join(here, '..', 'README.wasm.md'), join(here, '..', 'pkg', 'README.md'));

console.log(`pkg: ${pkg.name}@${pkg.version}`);
