@AGENTS.md

# This checkout is a personal fork

Everything AGENTS.md says is upstream's and still holds. This part covers the fork's own workflow.
It lives on the `local` branch only.

## Remotes and branches

- `upstream` is devswha/ovis, the real project. `origin` is miguelsalameh/ovis, the fork. Push to
  `origin` only, over HTTPS (the repo's `gh auth git-credential` helper; SSH has no key). Commit as
  `miguelsalameh@gmail.com`.
- `local` is the version that runs: an upstream release tag (now v0.4.18) with each feature branch
  merged in. The herdr plugin is linked to this checkout and serves `dist/` on `127.0.0.1:7317`.
  The plugin's updater only moves a checkout on `main`, so `local` never updates itself.
- Each change gets its own branch (`feat/…`, `fix/…`), cut from the tag `local` is on, so it stays
  one change of its own. Never commit a feature straight onto `local`; only fork-only files
  like this one go there.

## Making a change

1. Work in a worktree, never in this checkout:
   `git worktree add ~/Projects/ovis-wt/<branch with / as -> -b <branch> v0.4.18`
   (leave out `-b` and the tag for an existing branch), then
   `ln -s ~/Projects/ovis/node_modules node_modules` inside it.
2. Check it there: `bun run typecheck`, and component tests one file at a time with
   `bun test --timeout 60000 ./path/to/file.test.ts`. The tests start a throwaway herdr session
   `ovis-test`; stop it afterwards with
   `env -u HERDR_SOCKET_PATH -u HERDR_CLIENT_SOCKET_PATH -u HERDR_WORKSPACE_ID -u HERDR_TAB_ID -u HERDR_PANE_ID HERDR_SESSION=ovis-test herdr server stop`
   and `herdr session delete ovis-test`.
3. Commit as `type(scope): summary`, in English. A change users notice also gets a
   `changelog.d/<name>.md` fragment ([format](changelog.d/README.md)).
4. Run it: in `~/Projects/ovis`, `git merge --no-edit <branch>` into `local`, then
   `bun run build`, then reload the window with
   `osascript -e 'tell application "Ovis" to activate' -e 'delay 0.4' -e 'tell application "System Events" to keystroke "r" using command down'`.
   A change under `server/` or `shared/` needs the server restarted instead (see below).
5. Push both: `git push origin local <branch>`.

Uncommitted changes in `~/Projects/ovis` that you did not make belong to another agent. Leave
them alone. Build from a clean detached worktree of `local` and swap its `dist/` in through
`dist.next` and `dist.prev`.

Restart the server with `herdr plugin action invoke devswha.ovis.stop`, wait until it has
stopped, then `herdr plugin action invoke devswha.ovis.start`. Starting before the stop finishes
hits the supervisor lock. Check that `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:7317/`
prints 200.

## Upstream

- Never open a PR on devswha/ovis, or on herdr's own repository. The user's call: changes stay on
  this fork. Do not offer one or prepare one.
- Keep each branch standing alone on its tag anyway: a branch that holds only its own change is
  easy to merge into `local` again after an upstream update.

## Updating from upstream

1. `git fetch upstream --tags`, then take the newest release tag:
   `git tag --sort=-v:refname | head -1`. Use a tag, not `upstream/main`: tags are what upstream
   ships and tests.
2. In `~/Projects/ovis`, check you are on `local` and `git status` is clean.
3. `git merge vX.Y.Z`. In a conflict keep both sides' intent. A generated file
   (`shared/herdr-api.generated.ts`, `src/lib/themes.generated.ts`) takes upstream's copy, then
   `bun run generate:types` or `bun run generate:themes`.
4. `bun install` (the lockfile may have moved), `bun run typecheck`, `bun run build`.
5. Restart the server (above), check the 200, and reload the window.
6. Replace every `v0.4.18` in this file with the new tag, commit, and `git push origin local`.
7. A feature branch upstream has merged can go: `git branch -D` it and delete it on `origin`.
   The others keep their old base.

If the merge goes wrong, `git merge --abort`. The last good `local` is also on `origin`. A new
Ovis release may need a newer herdr: its CHANGELOG.md entry says so.
