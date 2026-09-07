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
modifiers, repeat counts, mark/cancel, paragraph boundaries, cut/yank,
deletion/undo and Unicode text. There are 14 unit tests.
They do not simulate browser layout or OS-level keyboard input.

## End-to-end tests

```sh
yarn build
yarn test:e2e
```

WebdriverIO and `wdio-obsidian-service` download and launch Obsidian **1.13.7**
(app and installer), install the built plugin and copy `test/fixtures/vault` into a
temporary directory. They do not use your regular vault. A fresh Obsidian
instance is used for each scenario. Initial editor contents are prepared via the
Obsidian API; the operation being tested is always sent as a WebDriver key press.

Clipboard scenarios use the system clipboard and restore its browser-accessible
formats in a `finally` block. The saved contents stay inside the test renderer and
are never included in logs. Use a disposable desktop/session when preservation
of native application-specific clipboard formats is required; GitHub's Xvfb
session already provides one.

### Coverage

`test/e2e/readme.test.mjs` exercises all **47 documented key combinations**.
Aliases and the Shift-selection prose count as separate combinations.

| Group           | Combinations | What is asserted                                                                              |
| --------------- | -----------: | --------------------------------------------------------------------------------------------- |
| Movement        |           12 | Cursor position, page direction and scrolling, unchanged text                                 |
| Selection       |           14 | Selected text and cursor, including page/document selection and both whole-buffer aliases     |
| Basic editing   |           16 | Text changes, mark state, clipboard, yank rotation, undo/redo, unchanged tabs for copy        |
| Find and search |            5 | Visible search/replace controls, selected matches, forward/backward navigation, replaced text |

One additional test compares the registered cases with the README tables and
selection prose, so adding a documented binding without a test fails CI.
This detects missing scenarios; each scenario's behavior is checked independently
against explicit expected results.

`test/e2e/emacs.test.mjs` adds **12 regression tests**, for **60 E2E tests** in total.
They include Command+w on macOS (Control+w on Linux), active-mark paging,
search-panel keyboard navigation, safe yank rotation after typing, repeat counts,
Unicode clipboard data, and native Markdown Enter/Backspace behavior.

### Hotkeys and keyboard environment

The fixture uses **Source mode** and removes conflicting Obsidian shortcuts in
`test/fixtures/vault/.obsidian/hotkeys.json`, as required by the plugin's usage
notes. These settings are part of the tested configuration, not changes that the
plugin applies automatically:

| Obsidian command            | Default shortcut cleared |
| --------------------------- | ------------------------ |
| Insert link                 | Mod-k                    |
| Search in current file      | Mod-f                    |
| Delete paragraph            | Mod-d                    |
| Toggle comment              | Mod-/                    |
| Close current tab           | Mod-w                    |
| Toggle reading view         | Mod-e                    |
| Create new note             | Mod-n                    |
| Create new note in new pane | Mod-Shift-n              |
| Toggle bold                 | Mod-b                    |
| Open command palette        | Mod-p                    |
| Save current file           | Mod-s                    |

`Mod` is Command on macOS and Control on Linux. In particular, unmodified default
settings can let Command+w close the last note and show an empty tab before the
plugin receives it. The copy regression verifies `C-Space → C-f × 5 → Command+w`
copies `alpha`, keeps the document intact and leaves the tab list unchanged after
clearing this conflict. The README's `M-w` is also tested separately with Alt/Option.

E2E sends logical Control, Alt/Option and Shift keys with US-layout punctuation.
It does not press a physical keyboard through Karabiner. If modifiers are swapped,
use the physical key that sends the desired logical modifier to Obsidian.
The tests also check that ordinary Markdown editing still works with the plugin
enabled. They are not a guarantee of compatibility with arbitrary hotkey settings,
Live Preview, other plugins, IMEs, mobile devices or OS keyboard layouts. Letter-layout mapping
is covered by synthetic events in the unit tests; OS/IME behavior needs separate
manual verification.

### Manual testing

The local `test/vault/` directory is ignored by Git and is separate from the
automated fixture. You can use it for notes and personal settings. The downloaded
Obsidian application does not install or enable this plugin merely by being opened;
the WDIO runner performs those steps only for its temporary vaults.

To prepare a new manual vault with the same hotkey configuration:

```sh
yarn build
mkdir -p test/vault/.obsidian/plugins/obsidian-emacs-bindings
cp test/fixtures/vault/input.md test/vault/input.md
cp test/fixtures/vault/.obsidian/{app,hotkeys}.json test/vault/.obsidian/
cp main.js manifest.json styles.css test/vault/.obsidian/plugins/obsidian-emacs-bindings/
```

The first two `cp` commands overwrite the corresponding note/settings; skip them
for an existing vault whose contents you want to keep. Open this vault in Obsidian,
enable **Emacs Bindings** under **Settings → Community plugins**, and use Source
mode. After rebuilding and copying the plugin again, disable/re-enable it or
restart Obsidian to load the updated code. Hotkey-file changes also require a reload.

Each E2E test name describes a manual scenario. For example, with `alpha beta` at
the start of the line, press `C-Space`, `C-f` five times, then `M-w`: the clipboard
must contain `alpha`, the note must stay unchanged, and the tab must stay open.

### Versions and Linux setup

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
2. **Obsidian E2E** downloads that exact build and runs all 60 scenarios on each
   of **Ubuntu 24.04** (Xvfb) and **macOS 15** (Arm64). Logs and failure screenshots
   are uploaded separately for each OS even when tests fail.

Stable Obsidian downloads require no account credentials or repository secrets,
so fork PRs can run these workflows. CI does not publish a release. All jobs must
succeed before a change should be merged; configure them as required checks in
GitHub branch protection if desired.

The fixed Obsidian version gives a reproducible baseline. Update it deliberately
in `wdio.conf.mjs` and rerun the suite. Passing this baseline does not establish
compatibility with the old `minAppVersion` in the plugin manifest.

References: [WDIO Obsidian Service](https://github.com/jesse-r-s-hines/wdio-obsidian-service)
and its [CI example](https://github.com/jesse-r-s-hines/wdio-obsidian-service-sample-plugin).
