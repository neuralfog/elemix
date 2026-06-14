import { existsSync, readFileSync } from 'node:fs';

// Same package set / order as changelog.mjs. Kept local so this script has no
// import side effects (it is piped straight into `gh release create`).
const PACKAGES = [
    { dir: 'packages/elemix', npm: '@neuralfog/elemix' },
    { dir: 'packages/storybook', npm: '@neuralfog/elemix-storybook' },
    { dir: 'packages/compiler', npm: '@neuralfog/elemix-compiler' },
    { dir: 'packages/vite', npm: '@neuralfog/elemix-vite' },
];

const version = process.argv[2];
if (!version) {
    console.error('usage: node scripts/release-notes.mjs <version>');
    process.exit(1);
}

// Pull the body under `## [version]`, up to the next `## ` heading.
const section = (text, v) => {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => l.startsWith(`## [${v}]`));
    if (start === -1) return null;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => l.startsWith('## '));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
};

const npmLink = (npm) => `https://www.npmjs.com/package/${npm}/v/${version}`;

const blocks = [];
for (const p of PACKAGES) {
    const file = `${p.dir}/CHANGELOG.md`;
    if (!existsSync(file)) continue;
    const body = section(readFileSync(file, 'utf8'), version);
    if (!body) {
        console.error(`note: ${p.npm} has no [${version}] section — skipping`);
        continue;
    }
    blocks.push(`## [\`${p.npm}\`](${npmLink(p.npm)})\n\n${body}`);
}

if (blocks.length === 0) {
    console.error(`no changelog entries found for ${version}`);
    process.exit(1);
}

// Published to npm — nothing to attach. The packages are the artifacts.
process.stdout.write(`${blocks.join('\n\n')}\n`);
