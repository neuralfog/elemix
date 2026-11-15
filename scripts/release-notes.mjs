import { existsSync, readFileSync } from 'node:fs';

const CHANGELOG = 'CHANGELOG.md';
const PACKAGES = [
    '@neuralfog/elemix',
    '@neuralfog/elemix-ssr',
    '@neuralfog/elemix-testing-library',
    '@neuralfog/elemix-compiler',
    '@neuralfog/elemix-compiler-wasm',
    '@neuralfog/elemix-analyzer',
    '@neuralfog/elemix-template-formatter',
    '@neuralfog/elemix-vite',
    'create-elemix-app',
];
const NUGET_PACKAGES = [
    'Hydris',
    'Hydris.QuickJs',
    'Hydris.Generators',
    'Hydris.Build',
    'Hydris.Cli',
];

const version = process.argv[2];
if (!version) {
    console.error('usage: node scripts/release-notes.mjs <version>');
    process.exit(1);
}

const section = (text, v) => {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => l.startsWith(`## [${v}]`));
    if (start === -1) return null;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => l.startsWith('## '));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
};

const npmLink = (npm) => `https://www.npmjs.com/package/${npm}/v/${version}`;
const nugetLink = (id) => `https://www.nuget.org/packages/${id}/${version}`;

if (!existsSync(CHANGELOG)) {
    console.error(`missing changelog: ${CHANGELOG}`);
    process.exit(1);
}

const isPrerelease = version.includes('-');
let body = section(readFileSync(CHANGELOG, 'utf8'), version);
if (!body) {
    if (!isPrerelease) {
        console.error(`no changelog entry found for ${version}`);
        process.exit(1);
    }
    body = `Pre-release build \`${version}\`.`;
}

const links = PACKAGES.map((npm) => `- [\`${npm}\`](${npmLink(npm)})`).join('\n');
const nuget = NUGET_PACKAGES.map((id) => `- [\`${id}\`](${nugetLink(id)})`).join('\n');

const MARKETPLACE =
    'https://marketplace.visualstudio.com/items?itemName=neuralfog.elemix-vscode';
const NVIM = 'https://github.com/neuralfog/elemix.nvim';
const editors = [
    `- [elemix for VS Code](${MARKETPLACE}) (\`.vsix\` attached below)`,
    `- [elemix for Neovim](${NVIM})`,
].join('\n');

const downloads = 'All binaries are attached as assets below.';

process.stdout.write(
    `${body}\n\n### Packages\n\n${links}\n\n### NuGet (C#)\n\n${nuget}\n\n### Editors\n\n${editors}\n\n### Downloads\n\n${downloads}\n`,
);
