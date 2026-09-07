# Testing

Use Node.js 24 (`nvm use`) and Yarn Classic 1.22.22. Dependencies are pinned in
`yarn.lock`; use `yarn install --frozen-lockfile` after cloning.

## Static checks and unit tests

```sh
yarn install --frozen-lockfile
yarn check
```

`yarn check` runs ESLint, Prettier, the TypeScript check, the production build,
and Vitest. Individual commands are also available:

```sh
yarn lint
yarn format:check
yarn typecheck
yarn build
yarn test:unit
```

Unit tests run the exported `EmacsHandler` with real CodeMirror state, view and
history in jsdom. Only the system clipboard is replaced. Assertions check text,
cursor positions, selections and clipboard contents rather than private fields
or mocked editing commands. They cover remapped letters, Shift and macOS Option
modifiers, repeat counts, mark/cancel, cut/yank, deletion/undo and Unicode text.
They do not simulate browser layout or OS-level keyboard input.

## End-to-end tests

```sh
yarn build
yarn test:e2e
```

WebdriverIO and `wdio-obsidian-service` download and launch Obsidian **1.13.7**
(app and installer), install the built plugin and copy `test/vault` into a
temporary directory. They do not use your regular vault. A fresh Obsidian
instance is used for each scenario. Initial editor contents are prepared via the
Obsidian API; the operation being tested is always sent as a WebDriver key press.

Clipboard scenarios use the system clipboard and restore its browser-accessible
formats in a `finally` block. The saved contents stay inside the test renderer and
are never included in logs. Use a disposable desktop/session when preservation
of native application-specific clipboard formats is required; GitHub's Xvfb
session already provides one.

The fixture uses Source mode and removes conflicting Obsidian shortcuts in
`test/vault/.obsidian/hotkeys.json`, as described in the plugin's usage notes.
These are insert link (`Mod-k`), search (`Mod-f`), and delete paragraph (`Mod-d`);
on Linux, `Mod` is Control and those shortcuts would intercept the Emacs keys.
The tests also check that ordinary Markdown editing still works with the plugin
enabled. They are not a guarantee of compatibility with arbitrary hotkey settings,
other plugins, IMEs, mobile devices or OS keyboard layouts. Letter-layout mapping
is covered by synthetic events in the unit tests; OS/IME behavior needs separate
manual verification.

To test another app/installer pair without changing the defaults:

```sh
OBSIDIAN_APP_VERSION=latest OBSIDIAN_INSTALLER_VERSION=latest yarn test:e2e
```

On a Linux machine without a graphical desktop, install `xvfb`, `xauth`,
`herbstluftwm` and `x11-xserver-utils`, then run:

```sh
xvfb-run -a --server-args="-screen 0 1280x1024x24" \
  sh -c 'herbstluftwm & yarn test:e2e'
```

The downloads are cached in `.obsidian-cache/`. WDIO logs and failure screenshots
are saved under `artifacts/e2e/`. Both directories are ignored by Git, ESLint and
Prettier.

## GitHub Actions

`.github/workflows/ci.yml` runs on pull requests, pushes to `master` or `codex/**`,
and manual **Actions → CI → Run workflow** requests. The manual option becomes
available after the workflow is on the default branch.

1. **Static checks and unit tests** installs the locked dependencies, checks
   formatting and types, builds the plugin, and runs the unit tests. It uploads
   a JUnit report and the plugin build.
2. **Obsidian E2E (Linux)** downloads that exact build and tests it under Xvfb on
   Ubuntu 24.04. Logs and failure screenshots are uploaded even when tests fail.

Stable Obsidian downloads require no account credentials or repository secrets,
so fork PRs can run these workflows. CI does not publish a release. Both jobs must
succeed before a change should be merged; configure them as required checks in
GitHub branch protection if desired.

The fixed Obsidian version gives a reproducible baseline. Update it deliberately
in `wdio.conf.mjs` and rerun the suite. Passing this baseline does not establish
compatibility with the old `minAppVersion` in the plugin manifest.

References: [WDIO Obsidian Service](https://github.com/jesse-r-s-hines/wdio-obsidian-service)
and its [CI example](https://github.com/jesse-r-s-hines/wdio-obsidian-service-sample-plugin).
