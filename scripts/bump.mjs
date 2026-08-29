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

// The VS Code extension can't carry a `-dev.N` prerelease suffix: the Marketplace
// only accepts a clean `major.minor.patch`. So it always gets the base version
// (0.9.0-dev.22 -> 0.9.0); the release workflow publishes it to the pre-release
// channel when the root version is a dev build.
const base = next.split('-')[0];

// Text replace so only the version line changes — no reformatting churn.
// NB: cross-package pins (e.g. the vite plugin's `@neuralfog/elemix-compiler`
// dependency) are deliberately NOT bumped here. They must stay at a published,
// lockfile-resolvable version so `pnpm install` works locally and in CI; the
// release workflow stamps them to the release version at publish time.
for (const file of files) {
    const stamp = file === 'packages/vscode/package.json' ? base : next;
    const text = readFileSync(file, 'utf8').replace(
        /("version":\s*")[^"]+(")/,
        `$1${stamp}$2`,
    );
    writeFileSync(file, text);
    console.log(`${file} -> ${stamp}`);
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

// Keep Cargo.lock in lockstep with Cargo.toml. Without this the lockfile's
// `elemix-compiler` entry stays on the old version, and the next `cargo`
// invocation (CI, release, clippy) rewrites it — leaving a dangling,
// uncommitted Cargo.lock change after the bump. Scoped to the workspace
// crate's own block (the only package named `elemix-compiler`).
const cargoLock = 'packages/compiler/Cargo.lock';
if (existsSync(cargoLock)) {
    const text = readFileSync(cargoLock, 'utf8').replace(
        /(name = "elemix-compiler"\nversion = ")[^"]+(")/,
        `$1${next}$2`,
    );
    writeFileSync(cargoLock, text);
    console.log(`${cargoLock} -> ${next}`);
}

// The analyzer is its own crate + npm package set + Cargo.lock — bump it exactly
// like the compiler so the whole toolchain releases at one version.
const analyzerStamp = 'packages/analyzer/npm/version.mjs';
if (existsSync(analyzerStamp)) {
    execFileSync('node', [analyzerStamp, next], { stdio: 'inherit' });
}

const analyzerCargo = 'packages/analyzer/Cargo.toml';
if (existsSync(analyzerCargo)) {
    const text = readFileSync(analyzerCargo, 'utf8').replace(
        /^version = "[^"]+"/m,
        `version = "${next}"`,
    );
    writeFileSync(analyzerCargo, text);
    console.log(`${analyzerCargo} -> ${next}`);
}

// The analyzer's lockfile carries TWO workspace entries: its own and the
// `elemix-compiler` path dependency (pinned to the compiler's version). Bump
// both, or the next `cargo` run rewrites them and leaves a dangling change.
const analyzerLock = 'packages/analyzer/Cargo.lock';
if (existsSync(analyzerLock)) {
    const text = readFileSync(analyzerLock, 'utf8')
        .replace(/(name = "elemix-analyzer"\nversion = ")[^"]+(")/, `$1${next}$2`)
        .replace(/(name = "elemix-compiler"\nversion = ")[^"]+(")/, `$1${next}$2`);
    writeFileSync(analyzerLock, text);
    console.log(`${analyzerLock} -> ${next}`);
}

// The formatter is its own standalone crate + npm package set + Cargo.lock. Bump
// it like the analyzer, but it is INDEPENDENT by design (no `elemix-compiler`
// dependency), so its lockfile carries only its own workspace entry.
const formatterStamp = 'packages/formatter/npm/version.mjs';
if (existsSync(formatterStamp)) {
    execFileSync('node', [formatterStamp, next], { stdio: 'inherit' });
}

const formatterCargo = 'packages/formatter/Cargo.toml';
if (existsSync(formatterCargo)) {
    const text = readFileSync(formatterCargo, 'utf8').replace(
        /^version = "[^"]+"/m,
        `version = "${next}"`,
    );
    writeFileSync(formatterCargo, text);
    console.log(`${formatterCargo} -> ${next}`);
}

const formatterLock = 'packages/formatter/Cargo.lock';
if (existsSync(formatterLock)) {
    const text = readFileSync(formatterLock, 'utf8').replace(
        /(name = "elemix-template-formatter"\nversion = ")[^"]+(")/,
        `$1${next}$2`,
    );
    writeFileSync(formatterLock, text);
    console.log(`${formatterLock} -> ${next}`);
}
