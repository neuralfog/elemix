// Stamp one version across the launcher and every platform package, and pin the
// launcher's optionalDependencies to it so a published set is internally locked.
// usage: node version.mjs <version>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version) {
    console.error('usage: node version.mjs <version>');
    process.exit(1);
}

const root = dirname(fileURLToPath(import.meta.url));

const edit = (file, mutate) => {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    mutate(json);
    writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`${file} -> ${version}`);
};

const dirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

for (const dir of dirs) {
    edit(join(root, dir, 'package.json'), (json) => {
        json.version = version;
        for (const dep of Object.keys(json.optionalDependencies ?? {})) {
            json.optionalDependencies[dep] = version;
        }
    });
}
