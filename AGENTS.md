# Agent instructions

## Git workflow

`main` changes only through pull requests that the repository owner merges on GitHub. Treat `main` as read-only.

- Do every change on a new branch cut from an up-to-date `main`. Create and name it with the `conventional-branch` skill ([`.agents/skills/conventional-branch/SKILL.md`](.agents/skills/conventional-branch/SKILL.md)), which holds the [Conventional Branch](https://conventionalbranch.org/) naming rules and the steps.
- Commit and push only to that branch. To deliver the work, push the branch and open a pull request against `main`. Leave the merge to the owner.
- If you are on `main` with uncommitted changes, create the branch before committing. The changes carry over to the new branch.
- The hooks in `.githooks/` enforce these rules: `pre-commit` and `pre-merge-commit` reject commits on `main` and check the branch name with commit-check (rules in `commit-check.toml`); `pre-push` checks every pushed branch against the specification's regular expression. When a hook blocks you, fix the cause: switch to a branch, or rename the current one with `git branch -m <new-name>`. Keep the hooks active: no `--no-verify`, and `core.hooksPath` stays set to `.githooks`.
- Hard rule: never commit, merge, rebase, reset, cherry-pick or push on `main`, locally or on `origin`, and never merge a pull request into it.
