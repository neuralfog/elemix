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

copyFileSync(join(here, '..', 'README.wasm.md'), join(here, '..', 'pkg', 'README.md'));

console.log(`pkg: ${pkg.name}@${pkg.version}`);
