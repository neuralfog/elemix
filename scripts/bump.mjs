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

const current = readFileSync(files[0], 'utf8').match(
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
    const text = readFileSync(file, 'utf8').replace(
        /("version":\s*")[^"]+(")/,
        `$1${next}$2`,
    );
    writeFileSync(file, text);
    console.log(`${file} -> ${next}`);
}
