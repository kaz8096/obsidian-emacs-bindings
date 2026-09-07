# Obsidian Emacs Bindings

This is Emacs Key Bindings plugin for Obsidian (https://obsidian.md)

## Usage

Simple emacs keys are supported, including selection and yank.  
These key mappings don't appear in Obsidian `HotKeys`.  

`C-` means Control, `M-` means Alt (Option on macOS), and `S-` means Shift.
These refer to the modifiers received by Obsidian after any Karabiner or other
keyboard remapping. This plugin also recognizes Command as Meta on macOS,
provided the corresponding Obsidian shortcut has been cleared (see below).

Here's some informative table for the key bindings (not fully listed)

### Movement
| key | function |
|---- | -------- |
| `C-p` | `previous-line` |
| `C-n` | `next-line` |
| `C-b` | `backward-char` |
| `C-f` | `forward-char` |
| `M-b` | `backward-word` |
| `M-f` | `forward-word` |
| `C-a` | `beginning-of-line` |
| `C-e` | `end-of-line` |
| `S-M-,` | `beginning-of-buffer` |
| `S-M-.` | `end-of-buffer` |
| `C-v` | `scroll-up-command` |
| `M-v` | `scroll-down-command` |

### Selection

`Shift` + movement except `S-M-,` and `S-M-.` (instead you may use `S-C-Home` and `S-C-End` for the selection)

| key | function |
|---- | -------- |
| `C-x C-p`/`C-x h` | `mark-whole-buffer` |

### Basic Editing

| key | function |
|---- | -------- |
| `C-h` | `delete-backward-char` |
| `C-d` | `delete-char` |
| `C-m` | `enter-key` |
| `M-d` | `kill-word` |
| `C-k` | `kill-line` |
| `M-h` | `mark-paragraph` |
| `M-@` | `mark-word` |
| `C-y` | `yank` |
| `M-y` | `yank-pop` |
| `C-g` | `keyboard-quit` |
| `C-w` | `kill-region` |
| `M-w` | `kill-ring-save` |
| `C-Space` | `set-mark-command` |
| `C-x C-x` | `exchange-point-and-mark` |
| `C-/` | `undo` |
| `S-C-/` | `undo-redo` |

### Find and Search

| key | function |
|---- | -------- |
| `C-s` | open search panel (not `isearch-forward`) |
| `C-r` | open search panel (not `isearch-backward`) |
| `M-C-s` | find next |
| `M-C-r` | find previous |
| `S-M-5` | `query-replace` via the search/replace panel |

## Note

This plugin doesn't use `HotKeys` of Obsidian. Therefore some keys might conflict with the hotkey configurations.  
If you want to enable emacs keybindings binding, you must delete your hot key assignment for the key combination on `HotKeys`.  

Heads-up : `C-a` and `C-y` are forcibly overwritten in this plugin.

For example, `C-Space`, movement, then `M-w` copies the selected region.
If Command+w reaches Obsidian, its default **Close current tab** shortcut takes
precedence and can replace the last open note with an empty tab. Clear that
assignment in **Settings → Hotkeys** to use Command+w for `kill-ring-save`, or
use the key that sends Option+w. Karabiner can make the physical key labels differ
from these logical modifiers. The E2E fixture clears these conflicts explicitly;
see [TESTING.md](./TESTING.md).

## How to use

```shell
yarn install
yarn build
```
and then copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-emacs-bindings/`.

## Development

Automated checks and tests require Node.js 24 and Yarn 1.22.22:

```shell
yarn install --frozen-lockfile
yarn check
yarn build
yarn test:e2e
```

GitHub Actions runs static checks, unit tests, and real Obsidian operation tests
on macOS and Linux. Every Usage binding above, including aliases and Shift
selection, has an E2E scenario; a coverage check detects missing scenarios when
the tables change. See [TESTING.md](./TESTING.md) for the test environment,
coverage, local setup, and failure artifacts.

### Dev Server

```shell
yarn run dev
```

### Format

```shell
yarn format:check
yarn format:fix
```

### Lint

```shell
yarn lint
yarn lint:fix
```

## License

This software is distributed under the MIT License. For more details, please see the [LICENSE](./LICENSE) file.

### Third-Party Component License Information

This software includes the following components, each subject to its respective license terms:

- **[codemirror-emacs]**: For detailed licensing information and usage conditions of this component, please refer to the original source [here](https://github.com/replit/codemirror-emacs).
