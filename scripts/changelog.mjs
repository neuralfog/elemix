import { existsSync, readFileSync } from 'node:fs';

// Per-package changelogs, in the order they appear in release notes. Each maps a
// package directory (where CHANGELOG.md lives) to the npm package it ships as.
const PACKAGES = [
    { dir: 'packages/elemix', npm: '@neuralfog/elemix' },
    { dir: 'packages/storybook', npm: '@neuralfog/elemix-storybook' },
    { dir: 'packages/compiler', npm: '@neuralfog/elemix-compiler' },
    { dir: 'packages/vite', npm: '@neuralfog/elemix-vite' },
];

// Keep a Changelog: a version heading is `## [x.y.z] - YYYY-MM-DD` (prereleases
// allowed) or `## [Unreleased]`; section headings come from a fixed vocabulary.
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const SECTIONS = new Set([
    'Added',
    'Changed',
    'Deprecated',
    'Removed',
    'Fixed',
    'Security',
]);

const changelogPath = (dir) => `${dir}/CHANGELOG.md`;

// The newest released version in a changelog — the first numeric `## [x.y.z]`
// heading, skipping `## [Unreleased]`.
const topVersion = (text) => {
    for (const line of text.split('\n')) {
        const m = line.match(/^## \[([^\]]+)\]/);
        if (m && m[1] !== 'Unreleased') return m[1];
    }
    return null;
};

// Validate Keep a Changelog structure; returns an array of `file:line message`.
const lintFormat = (file, text) => {
    const errors = [];
    const lines = text.split('\n');

    const firstHeading = lines.find((l) => l.startsWith('# '));
    if (firstHeading !== '# Changelog') {
        errors.push(`${file}:1 must start with "# Changelog"`);
    }

    lines.forEach((line, i) => {
        const n = i + 1;
        if (line.startsWith('## ')) {
            const m = line.match(/^## \[([^\]]+)\](.*)$/);
            if (!m) {
                errors.push(`${file}:${n} malformed version heading: ${line}`);
            } else if (m[1] === 'Unreleased') {
                if (m[2].trim() !== '')
                    errors.push(`${file}:${n} "[Unreleased]" takes no date`);
            } else if (!VERSION.test(m[1])) {
                errors.push(`${file}:${n} invalid version "${m[1]}"`);
            } else if (!/^ - \d{4}-\d{2}-\d{2}$/.test(m[2])) {
                errors.push(`${file}:${n} version needs " - YYYY-MM-DD": ${line}`);
            }
        } else if (line.startsWith('### ')) {
            const section = line.slice(4).trim();
            if (!SECTIONS.has(section))
                errors.push(
                    `${file}:${n} unknown section "${section}" (expected ${[...SECTIONS].join(', ')})`,
                );
        }
    });

    return errors;
};

const readEach = () =>
    PACKAGES.map((p) => {
        const file = changelogPath(p.dir);
        if (!existsSync(file)) {
            console.error(`missing changelog: ${file}`);
            process.exit(1);
        }
        return { ...p, file, text: readFileSync(file, 'utf8') };
    });

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'lint') {
    const errors = readEach().flatMap((c) => lintFormat(c.file, c.text));
    if (errors.length) {
        console.error('changelog format errors:');
        for (const e of errors) console.error(`  ${e}`);
        process.exit(1);
    }
    console.log(`changelog format OK (${PACKAGES.length} packages)`);
} else if (cmd === 'check') {
    const expected = arg ?? JSON.parse(readFileSync('package.json', 'utf8')).version;
    const all = readEach();
    const errors = all.flatMap((c) => lintFormat(c.file, c.text));
    for (const c of all) {
        const top = topVersion(c.text);
        if (top !== expected)
            errors.push(
                `${c.file} top entry is [${top ?? 'none'}], expected [${expected}]`,
            );
    }
    if (errors.length) {
        console.error(`changelog check failed for ${expected}:`);
        for (const e of errors) console.error(`  ${e}`);
        process.exit(1);
    }
    console.log(`changelog versions match ${expected} (${PACKAGES.length} packages)`);
} else {
    console.error('usage: node scripts/changelog.mjs <lint | check [version]>');
    process.exit(1);
}
