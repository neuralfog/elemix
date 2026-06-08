# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
`@neuralfog/elemix` and `@neuralfog/elemix-storybook` are a **fixed** group — they
always version and publish together under the same number.

Workflow:

- `pnpm changeset` — record a change (pick bump type + summary).
- `pnpm version` — apply pending changesets: bump both packages + update changelogs.
- `pnpm release` — build all packages and `changeset publish`.
