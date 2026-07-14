#!/usr/bin/env node
// Publish packages/nvim to the standalone github.com/neuralfog/elemix.nvim repo.
//
// Neovim plugin managers (lazy.nvim, packer, ...) install a WHOLE repo, never a
// monorepo subdirectory - so the plugin, which lives at packages/nvim, is
// mirrored to its own repo. `git subtree split` rebuilds that subtree's history
// as a standalone branch; we force-push it to the mirror's default branch and
// tag it to match the release, so `{ 'neuralfog/elemix.nvim' }` just works.
//
// Auth: set NVIM_MIRROR_TOKEN (a PAT / token with push access to the mirror) in
// CI. Run from the repo root, and with FULL history (CI: checkout fetch-depth 0).
//
//   node scripts/publish-nvim.mjs <version>

import { execFileSync } from 'node:child_process';

const PREFIX = 'packages/nvim';
const MIRROR = process.env.NVIM_MIRROR_REPO || 'neuralfog/elemix.nvim';
const BRANCH = process.env.NVIM_MIRROR_BRANCH || 'main';
const SPLIT = '__nvim_publish';

const version = process.argv[2] || process.env.VERSION;
if (!version) {
  console.error('usage: publish-nvim.mjs <version>');
  process.exit(1);
}

const git = (...args) =>
  execFileSync('git', args, { stdio: ['ignore', 'inherit', 'inherit'] });
const tryGit = (...args) => {
  try {
    git(...args);
  } catch {
    /* best effort */
  }
};

const token = process.env.NVIM_MIRROR_TOKEN;
const url = token
  ? `https://x-access-token:${token}@github.com/${MIRROR}.git`
  : `git@github.com:${MIRROR}.git`;

// Rebuild packages/nvim's history as a standalone branch (a fresh split each run;
// deterministic for the same history). Drop any leftover branch from a prior run.
tryGit('branch', '-D', SPLIT);
git('subtree', 'split', `--prefix=${PREFIX}`, '-b', SPLIT);
try {
  git('push', '--force', url, `${SPLIT}:${BRANCH}`);
  git('push', '--force', url, `${SPLIT}:refs/tags/v${version}`);
  console.log(`published ${PREFIX} -> ${MIRROR} (${BRANCH}, v${version})`);
} finally {
  tryGit('branch', '-D', SPLIT);
}
