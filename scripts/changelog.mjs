import { existsSync, readFileSync } from 'node:fs';

// One changelog for the whole toolchain. Every package shares a version and
// releases together, so they share this single root CHANGELOG.md — a copy is
// staged into each package at publish time (release.yml) so npm ships it.
const CHANGELOG = 'CHANGELOG.md';

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

const read = () => {
    if (!existsSync(CHANGELOG)) {
        console.error(`missing changelog: ${CHANGELOG}`);
        process.exit(1);
    }
    return readFileSync(CHANGELOG, 'utf8');
};

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'lint') {
    const errors = lintFormat(CHANGELOG, read());
    if (errors.length) {
        console.error('changelog format errors:');
        for (const e of errors) console.error(`  ${e}`);
        process.exit(1);
    }
    console.log('changelog format OK');
} else if (cmd === 'check') {
    const expected = arg ?? JSON.parse(readFileSync('package.json', 'utf8')).version;
    const text = read();
    const errors = lintFormat(CHANGELOG, text);
    const top = topVersion(text);
    if (top !== expected)
        errors.push(
            `${CHANGELOG} top entry is [${top ?? 'none'}], expected [${expected}]`,
        );
    if (errors.length) {
        console.error(`changelog check failed for ${expected}:`);
        for (const e of errors) console.error(`  ${e}`);
        process.exit(1);
    }
    console.log(`changelog top entry matches ${expected}`);
} else {
    console.error('usage: node scripts/changelog.mjs <lint | check [version]>');
    process.exit(1);
}
