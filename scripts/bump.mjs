import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const arg = process.argv[2];
if (!arg) {
    console.error('usage: pnpm bump <version | major | minor | patch>');
    process.exit(1);
}

const files = [
    ...readdirSync('packages').map((dir) => `packages/${dir}/package.json`),
    'package.json',
].filter(existsSync);

// Canonical current version is the root manifest — not packages[0], which may
// be a private 0.0.0 package.
const current = readFileSync('package.json', 'utf8').match(
    /"version":\s*"([^"]+)"/,
)?.[1];

const next = (() => {
    if (/^\d+\.\d+\.\d+/.test(arg)) return arg;
    const [major, minor, patch] = (current ?? '0.0.0').split('.').map(Number);
    if (arg === 'major') return `${major + 1}.0.0`;
    if (arg === 'minor') return `${major}.${minor + 1}.0`;
    if (arg === 'patch') return `${major}.${minor}.${patch + 1}`;
    console.error(`invalid version or bump type: ${arg}`);
    process.exit(1);
})();

// Text replace so only the version line changes — no reformatting churn.
for (const file of files) {
    const text = readFileSync(file, 'utf8')
        .replace(/("version":\s*")[^"]+(")/, `$1${next}$2`)
        // Lockstep any pinned @neuralfog/elemix-compiler[-wasm] cross-dependency
        // (e.g. the vite plugin's pin on the native compiler it drives).
        // `workspace:*` specs are left alone.
        .replace(
            /("@neuralfog\/elemix-compiler(?:-wasm)?":\s*")(?!workspace:)[^"]+(")/g,
            `$1${next}$2`,
        );
    writeFileSync(file, text);
    console.log(`${file} -> ${next}`);
}

// Sync the compiler's published npm packages (launcher + per-platform binaries,
// cross-deps pinned) to the same version — reusing the stamper the release
// workflow runs.
const compilerStamp = 'packages/compiler/npm/version.mjs';
if (existsSync(compilerStamp)) {
    execFileSync('node', [compilerStamp, next], { stdio: 'inherit' });
}

// And the Rust crate's own version, so the binary metadata matches the release.
const cargo = 'packages/compiler/Cargo.toml';
if (existsSync(cargo)) {
    const text = readFileSync(cargo, 'utf8').replace(
        /^version = "[^"]+"/m,
        `version = "${next}"`,
    );
    writeFileSync(cargo, text);
    console.log(`${cargo} -> ${next}`);
}
