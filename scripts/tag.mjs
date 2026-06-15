import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!version) {
    console.error('no version found in package.json');
    process.exit(1);
}

// One release tag — release.yml fires on `v*` and gates the whole pipeline.
const tags = [`v${version}`];

const git = (args) => execFileSync('git', args, { stdio: 'inherit' });
const tagExists = (tag) => {
    try {
        execFileSync(
            'git',
            ['rev-parse', '-q', '--verify', `refs/tags/${tag}`],
            { stdio: 'ignore' },
        );
        return true;
    } catch {
        return false;
    }
};

for (const tag of tags) {
    if (tagExists(tag)) {
        console.log(`skip ${tag} (already exists)`);
    } else {
        git(['tag', '-a', tag, '-m', `Release ${tag}`]);
        console.log(`created ${tag}`);
    }
}

git(['push', 'origin', ...tags]);
console.log(`pushed: ${tags.join(', ')}`);
