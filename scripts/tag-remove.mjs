import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!version) {
    console.error('no version found in package.json');
    process.exit(1);
}

// The release tag `tag.mjs` creates — removed locally and on the remote.
const tags = [`v${version}`];

const tryGit = (args, label) => {
    try {
        execFileSync('git', args, { stdio: 'ignore' });
        console.log(`  ${label}: removed`);
    } catch {
        console.log(`  ${label}: not found`);
    }
};

for (const tag of tags) {
    console.log(tag);
    tryGit(['tag', '-d', tag], 'local');
    tryGit(['push', 'origin', '--delete', tag], 'remote');
}
