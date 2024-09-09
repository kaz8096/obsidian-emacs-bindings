# Obsidian Emacs Bindings

This is Emacs Key Bindings plugin for Obsidian (https://obsidian.md)

## Usage

Simple emacs keys are supported, including selection and yank.  
These key mappings don't appear in Obsidian `HotKeys`.  

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
| `c-e` | `end-of-line` |
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
| `S-M-5` | `query-replace` |

## Note

This plugin doesn't use `HotKeys` of Obsidian. Therefore some keys might conflict with the hotkey configurations.  
If you want to enable emacs keybindings binding, you must delete your hot key assignment for the key combination on `HotKeys`.  

Heads-up : `C-a` and `C-y` are forcibly overwritten in this plugin.

## How to install

Run:

```
export OBSIDIAN_PLUGINS_DIR=/path/to/obsidian/vault/.obsidian/plugins
make install
```

Or manually:

```shell
yarn install
yarn build
```
and then copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-emacs-bindings/`.

## How to uninstall

```
export OBSIDIAN_PLUGINS_DIR=/path/to/obsidian/vault/.obsidian/plugins
make uninstall
```

## Development

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
