import { Editor, EditorPosition, MarkdownView, Plugin } from 'obsidian'
import {
  EditorView,
  ViewPlugin,
  PluginValue,
  ViewUpdate
} from '@codemirror/view'
import * as commands from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import { ChangeDesc, EditorSelection, MapMode } from '@codemirror/state'
import { startCompletion, completionStatus } from '@codemirror/autocomplete'

export default class EmacsBindingsPlugin extends Plugin {
  private mark: EditorPosition | null = null
  static handlerMap: Map<EditorView, EmacsHandler> = new Map<
    EditorView,
    EmacsHandler
  >()

  private isComposing(view: MarkdownView): boolean {
    // @ts-expect-error TS2339: Property 'cm' does not exist on type 'Editor'
    const editorView = view.editor.cm as EditorView
    return editorView.composing
  }

  async onload() {
    // WSL2 has a problem with C-a
    // delete CodeMirror.keyMap[keymap]["Cmd-L"];
    // console.log(commands.defaultKeymap);
    this.addCommand({
      id: 'emacs-reserve',
      name: 'Reserve hotkey for emacs',
      hotkeys: [{ modifiers: ['Ctrl'], key: 'a' }],
      editorCallback: (editor: Editor, view: MarkdownView) => {
        // @ts-expect-error TS2339: Property 'cm' does not exist on type 'Editor'
        commands.cursorLineStart(view.editor.cm as EditorView)
      },
    })
    //console.log(app)

    this.addCommand({
      id: 'emacs-reserve2',
      name: 'Reserve hotkey for emacs2',
      hotkeys: [{ modifiers: ['Ctrl'], key: 'y' }],
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const handler = EmacsBindingsPlugin.handlerMap.get(
          // @ts-expect-error TS2339: Property 'cm' does not exist on type 'Editor'
          view.editor.cm as EditorView
        )
        EmacsHandler.commands['yank'].exec(handler)
      },
    })

    // TODO: how to deal with macos keyes.... hmm
    // Prec.highest(
    //   keymap.of([
    //     { mac: "Ctrl-f", run: function(cm) { console.log('ok'); return true; } }
    //   ])
    // );

    this.registerEditorExtension(
      ViewPlugin.fromClass(
        class implements PluginValue {
          public em: EmacsHandler
          public view: EditorView
          constructor(view: EditorView) {
            this.em = new EmacsHandler(view)
            this.view = view
            // console.log('view at register:', view);
            EmacsBindingsPlugin.handlerMap.set(view, this.em)
          }

          update(update: ViewUpdate) {
            if (update.docChanged) {
              this.em.$emacsMark = null
              this.em.updateMarksOnChange(update.changes)
            }
          }
        },
        {
          eventHandlers: {
            keydown: function (e: KeyboardEvent, view: EditorView) {
              const result = this.em.handleKeyboard(e)
              return !!result
            },
            mousedown: function () {
              this.em.$emacsMark = null
            },
          },
        }
      )
    )
  }

  async onunload() {}
}

type EmacsMark = number[] | null | undefined

const specialKey: Record<string, string> = {
  Return: 'Return',
  Escape: 'Esc',
  Insert: 'Ins',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Enter: 'Return',
  Divide: '/',
  Slash: '/',
  Multiply: '*',
  Subtract: '-',
  Minus: '-',
  Equal: '=',
}
const ignoredKeys: Record<string, number> = {
  Shift: 1,
  Alt: 1,
  Command: 1,
  Control: 1,
  CapsLock: 1,
}

// TODO: provide proper types to delete following directive....
/* eslint-disable @typescript-eslint/no-explicit-any */
const commandKeyBinding: Record<string, any> = {}
export class EmacsHandler {
  static lastClipboardText = ''
  static bindKey(keyGroup: string, command: any) {
    keyGroup.split('|').forEach(function (binding) {
      let chain = ''
      const parts = binding.split(/\s+/)
      parts.forEach(function (keyGroup, index) {
        const modifiers = keyGroup.split(/-(?=.)/)
        const key = modifiers.pop()
        if (modifiers.length) {
          chain += modifiers.sort().join('-') + '-'
        }
        chain += key
        if (index === parts.length - 1) {
          commandKeyBinding[chain] = command
        } else {
          commandKeyBinding[chain] = 'null'
          chain += ' '
        }
      })
    })
  }
  static getKey(e: KeyboardEvent): string[] {
    let code = e.code
    const key = e.key
    if (ignoredKeys[key]) return ['', '', '']
    if (code.length > 1) {
      if (code[0] == 'N') code = code.replace(/^Numpad/, '')
      if (code[0] == 'K') code = code.replace(/^Key/, '')
    }
    code = specialKey[code] || code
    if (code.length == 1) code = code.toLowerCase()

    let modifier = ''
    if (e.ctrlKey) {
      modifier += 'C-'
    }
    if (e.metaKey) {
      modifier += 'M-'
    }
    if (e.altKey) {
      modifier += 'M-'
    }
    if (e.shiftKey) {
      modifier += 'S-'
    }

    return [code, modifier, key]
  }

  static commands: Record<string, any> = {}
  static addCommands(commands: any) {
    Object.keys(commands).forEach(function (name) {
      const command = commands[name]
      // if (typeof command == 'function') {
      //   command = { exec: command }
      //   console.error('wrong command!')
      // }
      EmacsHandler.commands[name] = command
    })
  }
  static execCommand(
    command: any,
    handler: EmacsHandler,
    args: any,
    count = 1
  ) {
    let commandResult = undefined
    if (count < 0) count = -count
    if (typeof command === 'function') {
      for (let i = 0; i < count; i++) command(handler.view)
    } else if (command === 'null') {
      // waith for next key in the chain
    } else if (command.exec) {
      if (count > 1 && command.handlesCount) {
        if (!args) args = {}
        if (typeof args === 'object') args.count = count
        count = 1
      }
      for (let i = 0; i < count; i++)
        commandResult = command.exec(handler, args || {})
    } else {
      throw new Error('missformed command')
    }
    return commandResult
  }

  handleKeyboard(e: KeyboardEvent) {
    // console.log('handleKeyboard', e);
    const keyData = EmacsHandler.getKey(e)
    const result = this.findCommand(keyData)

    // console.log('  keyData=', keyData, ' result=', result);

    if (/Up|Down/.test(keyData?.[0]) && completionStatus(this.view.state))
      return

    if (result && result.command) {
      const commandResult = EmacsHandler.execCommand(
        result.command,
        this,
        result.args,
        result.count
      )
      if (commandResult === false) return
    }
    return result
  }

  constructor(readonly view: EditorView) {}

  // commands
  $data: {
    count?: number | null
    keyChain: string
    lastCommand: string | null
  } = {
    count: 0,
    keyChain: '',
    lastCommand: '',
  }
  findCommand = ([key, modifier, text]: string[]) => {
    // if keyCode == -1 a non-printable key was pressed, such as just
    // control. Handling those is currently not supported in this handler
    if (!key) return undefined

    const data = this.$data
    // this._signal("changeStatus");
    // insertstring data.count times
    if (!modifier && key.length == 1) {
      this.pushEmacsMark()
      if (data.count) {
        const str = new Array(data.count + 1).join(text)
        data.count = null
        return { command: 'insertstring', args: str }
      }
    }

    // CTRL + number / universalArgument for setting data.count
    if (modifier == 'C-' || data.count) {
      const count = parseInt(key[key.length - 1])
      if (typeof count === 'number' && !isNaN(count)) {
        data.count = Math.max(data.count || 0, 0)
        data.count = 10 * data.count + count
        return { command: 'null' }
      }
    }

    // this.commandKeyBinding maps key specs like "c-p" (for CTRL + P) to
    // command objects, for lookup key needs to include the modifier
    if (modifier) key = modifier + key

    // Key combos like CTRL+X H build up the data.keyChain
    if (data.keyChain) key = data.keyChain += ' ' + key

    // Key combo prefixes get stored as "null" (String!) in this
    // this.commandKeyBinding. When encountered no command is invoked but we
    // buld up data.keyChain
    let command = commandKeyBinding[key]
    data.keyChain = command == 'null' ? key : ''

    // there really is no command
    if (!command) return undefined

    // we pass b/c of key combo or universalArgument
    if (command === 'null') return { command: 'null' }

    if (command === 'universalArgument') {
      // if no number pressed emacs repeats action 4 times.
      // minus sign is needed to allow next keypress to replace it
      data.count = -4
      return { command: 'null' }
    }

    // lookup command
    // TODO extract special handling of markmode
    // TODO special case command.command is really unnecessary, remove
    let args
    if (typeof command !== 'string') {
      args = command.args
      if (command.command) command = command.command
    }

    if (
      command === 'insertstring' ||
      command === commands.splitLine ||
      command === commands.toggleComment
    ) {
      this.pushEmacsMark()
    }
    if (typeof command === 'string') {
      command = EmacsHandler.commands[command]
      if (!command) return undefined
    }

    if (!command.readOnly && !command.keepLastCommand) {
      data.lastCommand = null
    }

    const count = data.count || 1
    if (data.count) data.count = 0

    return { command, args, count }
  }

  showCommandLine(text: string) {
    console.error('TODO')
  }

  // mark
  $emacsMarkRing = [] as EmacsMark[]
  $emacsMark?: EmacsMark = null

  updateMarksOnChange(change: ChangeDesc) {
    if (this.$emacsMark) {
      this.$emacsMark = this.updateMark(this.$emacsMark, change)
    }
    this.$emacsMarkRing = this.$emacsMarkRing
      .map((x) => {
        return this.updateMark(x, change)
      })
      .filter(Boolean)
  }

  updateMark(mark: EmacsMark, change: ChangeDesc) {
    if (!mark) return
    const updated = mark
      .map(function (x) {
        return change.mapPos(x, 1, MapMode.TrackDel)
      })
      .filter((x) => x != null)
    return updated.length == 0 ? null : (updated as number[])
  }

  emacsMark() {
    return this.$emacsMark
  }

  setEmacsMark(p?: EmacsMark) {
    // to deactivate pass in a falsy value
    this.$emacsMark = p
  }

  pushEmacsMark(p?: EmacsMark, activate?: boolean) {
    const prevMark = this.$emacsMark
    if (prevMark) pushUnique(this.$emacsMarkRing, prevMark)
    if (!p || activate) this.setEmacsMark(p)
    else pushUnique(this.$emacsMarkRing, p)
  }

  popEmacsMark() {
    const mark = this.emacsMark()
    if (mark) {
      this.setEmacsMark(null)
      return mark
    }
    return this.$emacsMarkRing.pop()
  }

  getLastEmacsMark() {
    return this.$emacsMark || this.$emacsMarkRing.slice(-1)[0]
  }

  getCopyText() {
    const state = this.view.state
    return state.selection.ranges
      .map((r) => state.sliceDoc(r.from, r.to))
      .join('\n')
  }

  clearSelection() {
    const view = this.view
    const selection = view.state.selection
    const isEmpty = !selection.ranges.some((r) => r.from != r.to)
    if (isEmpty) return false
    const newRanges = selection.ranges.map((x) => {
      return EditorSelection.range(x.head, x.head)
    })
    view.dispatch({
      selection: EditorSelection.create(newRanges, selection.mainIndex),
    })
    return true
  }
  onPaste(text: string) {
    // console.log('onPaste', text);
    // console.log('view at onPaste: ', this.view);
    const view = this.view
    // console.log(view);
    const selection = view.state.selection
    let linesToInsert: string[]
    if (selection.ranges.length > 1) {
      const lines = text.split('\n')
      if (lines.length == selection.ranges.length) {
        linesToInsert = lines
      }
    }
    // console.log(view, selection, linesToInsert);

    let i = 0
    const specs = view.state.changeByRange((range) => {
      const toInsert = linesToInsert ? linesToInsert[i] : text
      i++

      // console.log('from:', range.from, 'to:', range.to, 'insert:', toInsert)
      return {
        changes: { from: range.from, to: range.to, insert: toInsert },
        range: EditorSelection.cursor(range.from + toInsert.length),
      }
    })
    // console.log('specs', specs)

    view.dispatch(specs)
  }
  selectionToEmacsMark() {
    const selection = this.view.state.selection
    return selection.ranges.map((x) => x.head)
  }
}

function pushUnique<T>(array: T[], item: T) {
  if (array.length && array[array.length - 1] + '' == item + '') return
  array.push(item)
}

type EmacsKeyBindings = Record<string, any>;

export const emacsKeys: EmacsKeyBindings = {
  // movement
  'Up|C-p': {
    command: 'goOrSelect',
    args: [commands.cursorLineUp, commands.selectLineUp],
  },
  'Down|C-n': {
    command: 'goOrSelect',
    args: [commands.cursorLineDown, commands.selectLineDown],
  },
  'Left|C-b': {
    command: 'goOrSelect',
    args: [commands.cursorCharBackward, commands.selectCharBackward],
  },
  'Right|C-f': {
    command: 'goOrSelect',
    args: [commands.cursorCharForward, commands.selectCharForward],
  },
  'C-Left|M-b': {
    command: 'goOrSelect',
    args: [commands.cursorGroupLeft, commands.selectGroupLeft],
  },
  'C-Right|M-f': {
    command: 'goOrSelect',
    args: [commands.cursorGroupRight, commands.selectGroupRight],
  },
  'Home|C-a': {
    command: 'goOrSelect',
    args: [commands.cursorLineStart, commands.selectLineStart],
  },
  'End|C-e': {
    command: 'goOrSelect',
    args: [commands.cursorLineEnd, commands.selectLineEnd],
  },
  'C-Home|S-M-,': {
    command: 'goOrSelect',
    args: [commands.cursorDocStart, commands.selectDocStart],
  },
  'C-End|S-M-.': {
    command: 'goOrSelect',
    args: [commands.cursorDocEnd, commands.selectDocEnd],
  },

  // selection
  'S-Up|S-C-p': commands.selectLineUp,
  'S-Down|S-C-n': commands.selectLineDown,
  'S-Left|S-C-b': commands.selectCharBackward,
  'S-Right|S-C-f': commands.selectCharForward,
  'S-C-Left|S-M-b': commands.selectGroupBackward,
  'S-C-Right|S-M-f': commands.selectGroupForward,
  'S-Home|S-C-a': commands.selectLineStart,
  'S-End|S-C-e': commands.selectLineEnd,
  'S-C-Home': commands.selectDocStart,
  'S-C-End': commands.selectDocEnd,

  //  "C-l": "recenterTopBottom",
  //  "M-s": "centerSelection",
  //  "M-g": "gotoline",
  'C-x C-p|C-x h': commands.selectAll,

  'PageDown|C-v|C-Down': {
    command: 'goOrSelect',
    args: [commands.cursorPageDown, commands.selectPageDown],
  },
  'PageUp|M-v|C-Up': {
    command: 'goOrSelect',
    args: [commands.cursorPageUp, commands.selectPageDown],
  },
  'S-C-Down': commands.selectPageDown,
  'S-C-Up': commands.selectPageUp,

  'C-s': openSearchPanel, // "iSearch",
  'C-r': openSearchPanel, // "iSearchBackwards",

  'M-C-s': 'findnext',
  'M-C-r': 'findprevious',
  'S-M-5': 'replace',

  // basic editing
  'Backspace|C-h': commands.deleteCharBackward,
  'Delete|C-d': commands.deleteCharForward,
  'Return|C-m': { command: 'insertstring', args: '\n' }, // "newline"
  //  "C-o": commands.splitLine,

  'M-d|C-Delete': { command: 'killWord', args: 'right' },
  'C-Backspace|M-Backspace|M-Delete': { command: 'killWord', args: 'left' },
  'C-k': 'killLine',

  'M-h': 'selectParagraph',
  'M-@|M-S-2': 'markWord',

  'C-y|S-Delete': 'yank',
  'M-y': 'yankRotate',
  'C-g': 'keyboardQuit',

  'C-w|C-S-w': 'killRegion',
  'M-w': 'killRingSave',
  'C-Space': 'setMark',
  'C-x C-x': 'exchangePointAndMark',

  //  "C-t": commands.transposeChars,
  'M-u': { command: 'changeCase', args: { dir: 1 } },
  'M-l': { command: 'changeCase', args: { dir: -1 } },
  'C-x C-u': { command: 'changeCase', args: { dir: 1, region: true } },
  'C-x C-l': { command: 'changeCase', args: { dir: 1, region: true } },
  'M-/': startCompletion,
  'C-u': 'universalArgument',

  'M-;': commands.toggleComment,

  'C-/|C-x u|S-C--|C-z': commands.undo,
  'S-C-/|S-C-x u|C--|S-C-z': commands.redo, // infinite undo?
  // vertical editing
  'C-x r': 'selectRectangularRegion',
  'M-x': { command: 'focusCommandLine', args: 'M-x ' },
  // todo
  // "C-x C-t" "M-t" "M-c" "F11" "C-M- "M-q"

  'C-c b': 'navigateBackward',
  'C-c f': 'navigateForward',

  Esc: 'unsetTransientMark',
}

for (const i in emacsKeys) {
  EmacsHandler.bindKey(i, emacsKeys[i])
}

EmacsHandler.addCommands({
  unsetTransientMark: {
    exec: function (handler: EmacsHandler) {
    handler.setEmacsMark(null)
      return false
    }
  },
  markWord: {
    exec: function (handler: EmacsHandler, args: any) {}
  },
  selectParagraph: {
    exec: function (handler: EmacsHandler, args: any) {
    const view = handler.view
    const head = view.state.selection.ranges[0].head
    const doc = view.state.doc
    const startLine = doc.lineAt(head)
    let start = -1
    let end = -1

    let line = startLine
    while (/\S/.test(line.text) && line.from > 0) {
      start = line.from
      line = view.state.doc.lineAt(line.from - 1)
    }
    if (start == -1) {
      while (!/\S/.test(line.text) && line.to < doc.length) {
        start = line.from
        line = view.state.doc.lineAt(line.to + 1)
      }
    } else {
      line = startLine
    }
    while (/\S/.test(line.text) && line.to < doc.length) {
      end = line.to
      line = view.state.doc.lineAt(line.to + 1)
    }
    if (end == -1) {
      end = startLine.to
    }
    const newRanges = [EditorSelection.range(start, end)]
    view.dispatch({
      selection: EditorSelection.create(newRanges),
    })
    }
  },
  goOrSelect: {
    exec: function (handler: EmacsHandler, args: any) {
      // console.log('goOrSelect');
      const command = handler.emacsMark() ? args[1] : args[0]
      command(handler.view)
    },
  },
  changeCase: {
    exec: function (handler: EmacsHandler, args: any) {
    const view = handler.view
    if (!args.region) {
      handler.clearSelection()
      commands.selectGroupForward(view)
    }

    const specs = view.state.changeByRange((range) => {
      let toInsert = view.state.sliceDoc(range.from, range.to)
      toInsert = args.dir == 1 ? toInsert.toUpperCase() : toInsert.toLowerCase()
      return {
        changes: { from: range.from, to: range.to, insert: toInsert },
        range: EditorSelection.cursor(range.from + toInsert.length),
      }
    })
    view.dispatch(specs)
    }
  },
  centerSelection: {
    exec: function (handler: EmacsHandler) {
    handler.view.dispatch({ scrollIntoView: true })
    }
  },
  recenterTopBottom: {
    exec: function (handler: EmacsHandler) {
    const view = handler.view
    let scrollTop = view.scrollDOM.scrollTop
    view.dispatch({ scrollIntoView: true })
    try {
      // force synchronous measurment
      (view as any).measure(true)
    } catch (e) {
      console.error(e);
      // intentionally ignore errors here.
    }

    if (scrollTop != view.scrollDOM.scrollTop) return

    const base = view.scrollDOM.getBoundingClientRect()
    const cursor = view.coordsAtPos(view.state.selection.main.head)
    if (!cursor) return

    const lineHeight = cursor.bottom - cursor.top
    const screenHeight = base.height
    const cursorTop = cursor.top - base.top

    if (Math.abs(cursorTop) < lineHeight / 4) {
      scrollTop += cursorTop + lineHeight - screenHeight + 2
    } else if (Math.abs(cursorTop - screenHeight * 0.5) < lineHeight / 4) {
      scrollTop += cursorTop - 2
    } else {
      scrollTop += cursorTop - screenHeight * 0.5
    }
    view.scrollDOM.scrollTop = scrollTop
    }
  },
  selectRectangularRegion: {
    exec: function (handler: EmacsHandler) {
    const view = handler.view
    const ranges = view.state.selection.ranges
    const newRanges = []
    if (ranges.length > 1) {
      newRanges.push(
        EditorSelection.range(ranges[0].from, ranges[ranges.length - 1].to)
      )
    } else {
      const doc = view.state.doc
      let startLine = doc.lineAt(ranges[0].from)
      const endLine = doc.lineAt(ranges[0].to)
      const startCollumn = ranges[0].from - startLine.from
      const endCollumn = ranges[0].to - endLine.from

      while (startLine.from < endLine.to) {
        newRanges.push(
          EditorSelection.range(
            startLine.from + startCollumn,
            startLine.from + endCollumn
          )
        )
        if (startLine.to + 1 >= doc.length) break
        startLine = doc.lineAt(startLine.to + 1)
      }
    }

    view.dispatch({
      selection: EditorSelection.create(newRanges),
    })
    }
  },
  setMark: {
    exec: function (handler: EmacsHandler, args: any) {
      // console.log('setMark');
      const view = handler.view
      const ranges = view.state.selection.ranges
      // Sets mark-mode and clears current selection.
      // When mark is set, keyboard cursor movement commands become
      // selection modification commands. That is,
      // "goto" commands become "select" commands.
      // Any insertion or mouse click resets mark-mode.
      // setMark twice in a row at the same place resets markmode.
      // in multi select mode, ea selection is handled individually
      if (args && args.count) {
        const newMark = handler.selectionToEmacsMark()
        const mark = handler.popEmacsMark()
        if (mark) {
          const newRanges = mark.map((p: number) => {
            return EditorSelection.cursor(p, p)
          })
          view.dispatch({
            selection: EditorSelection.create(newRanges),
          })
          handler.$emacsMarkRing.unshift(newMark)
        }
        return
      }

      const mark = handler.emacsMark()
      const rangePositions = ranges.map(function (r) {
        return r.head
      })
      const transientMarkModeActive = true
      const hasNoSelection = ranges.every(function (range) {
        return range.from == range.to
      })
      // if transientMarkModeActive then mark behavior is a little
      // different. Deactivate the mark when setMark is run with active
      // mark
      if (transientMarkModeActive && (mark || !hasNoSelection)) {
        handler.clearSelection()
        if (mark) handler.pushEmacsMark(null)
        return
      }

      if (!mark) {
        handler.pushEmacsMark(rangePositions)
        handler.setEmacsMark(rangePositions)
        return
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    },
    readOnly: true,
    handlesCount: true,
  },
  exchangePointAndMark: {
    exec: function (handler: EmacsHandler, args: any) {
      const view = handler.view
      const selection = view.state.selection
      const isEmpty = !selection.ranges.some((r) => r.from != r.to)
      if (!args.count && !isEmpty) {
        // just invert selection
        const newRanges = selection.ranges.map((x) => {
          return EditorSelection.range(x.head, x.anchor)
        })
        view.dispatch({
          selection: EditorSelection.create(newRanges, selection.mainIndex),
        })
        return
      }

      const markRing = handler.$emacsMarkRing
      const lastMark = markRing[markRing.length - 1]
      if (!lastMark) return

      if (args.count) {
        // replace mark and point
        markRing[markRing.length - 1] = handler.selectionToEmacsMark()

        handler.clearSelection()

        const newRanges = lastMark.map((x) => {
          return EditorSelection.range(x, x)
        })
        view.dispatch({
          selection: EditorSelection.create(newRanges, selection.mainIndex),
        })
      } else {
        // create selection to last mark
        const n = Math.min(lastMark.length, selection.ranges.length)
        const newRanges = []
        for (let i = 0; i < n; i++) {
          newRanges.push(
            EditorSelection.range(selection.ranges[i].head, lastMark[i])
          )
        }
      }
    },
    readOnly: true,
    handlesCount: true,
  },
  killWord: {
    exec: function (handler: EmacsHandler, dir: any) {
      const view = handler.view
      let selection = view.state.selection
      const newRanges = selection.ranges.map((x) => {
        return EditorSelection.range(x.head, x.head)
      })
      view.dispatch({
        selection: EditorSelection.create(newRanges, selection.mainIndex),
      })
      if (dir == 'left') commands.selectGroupBackward(view)
      else commands.selectGroupForward(view)
      selection = view.state.selection

      selection.ranges.forEach((r) => {
        const text = view.state.sliceDoc(r.from, r.to)
        killRing.add(text)
      })

      view.dispatch(view.state.replaceSelection(''))
    },
  },
  killLine: {
    exec: function (handler: EmacsHandler) {
      handler.pushEmacsMark(null)
      // don't delete the selection if it's before the cursor
      handler.clearSelection()
      const view = handler.view
      const state = view.state

      const text: string[] = []
      const changes = state.selection.ranges.map(function (range) {
        const from = range.head
        const lineObject = state.doc.lineAt(from)

        let to = lineObject.to
        const line = state.sliceDoc(from, to)

        // remove EOL if only whitespace remains after the cursor
        if (/^\s*$/.test(line) && to < state.doc.length - 1) {
          to += 1
          text.push(line + '\n')
        } else {
          text.push(line)
        }
        return { from, to, insert: '' }
      })
      if (handler.$data.lastCommand == 'killLine') {
        killRing.append(text.join('\n'))
      } else {
        killRing.add(text.join('\n'))
      }
      handler.$data.lastCommand = 'killLine'
      view.dispatch({ changes })
    },
    keepLastCommand: true,
  },
  yank: {
    exec: async function (handler: EmacsHandler) {
      // console.log(handler);
      // check clipboard : if it differs from the last check, add it to the kill ring
      let clipboardText = await navigator.clipboard.readText()
      clipboardText = clipboardText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      clipboardText = clipboardText.replace(/[\u200B-\u200D\uFEFF]/g, '');
      if (clipboardText !== EmacsHandler.lastClipboardText) {
        EmacsHandler.lastClipboardText = clipboardText
        killRing.add(clipboardText)
      }
      handler.onPaste(killRing.get())
      handler.$data.lastCommand = 'yank'
    },
    keepLastCommand: true,
  },
  yankRotate: {
    exec: function (handler: EmacsHandler) {
      if (handler.$data.lastCommand != 'yank') return
      commands.undo(handler.view)
      handler.$emacsMarkRing.pop() // also undo recording mark
      handler.onPaste(killRing.rotate())
      handler.$data.lastCommand = 'yank'
    },
    keepLastCommand: true,
  },
  killRegion: {
    exec: function (handler: EmacsHandler) {
      killRing.add(handler.getCopyText())
      const view = handler.view
      view.dispatch(view.state.replaceSelection(''))
      handler.setEmacsMark(null)
    },
  },
  killRingSave: {
    exec: function (handler: EmacsHandler) {
      const text = handler.getCopyText()
      // console.log('killRingSave', text);
      killRing.add(text)
      handler.clearSelection()
    },
    readOnly: true,
  },
  keyboardQuit: {
    exec: function (handler: EmacsHandler) {
    const view = handler.view
    const selection = view.state.selection
    const isEmpty = !selection.ranges.some((r) => r.from != r.to)

    if (selection.ranges.length > 1 && !isEmpty) {
      const newRanges = selection.ranges.map((x) => {
        return EditorSelection.range(x.head, x.head)
      })
      view.dispatch({
        selection: EditorSelection.create(newRanges, selection.mainIndex),
      })
    } else {
      commands.simplifySelection(handler.view)
    }

    handler.setEmacsMark(null)
    handler.$data.count = null
    }
  },
  focusCommandLine: {
    exec: function (handler: EmacsHandler, arg: string) {
      handler.showCommandLine(arg)
    }
  },
  navigateBackward: {
    exec: function (handler: EmacsHandler, arg: string) {
      const app = (window as any).app;
      if (app) {
        app.commands.executeCommandById("app:go-back")
      } else {
        console.warn("App object is not available in the global scope.");
      }
    }
  },
  navigateForward: {
    exec: function (handler: EmacsHandler, args: string) {
      const app = (window as any).app;
      if (app) {
        app.commands.executeCommandById("app:go-forward")
      } else {
        console.warn("App object is not available in the global scope.");
      }
    }
  }
})

const killRing = {
  $data: [] as string[],
  add: function (str: string) {
    if (str) {
      this.$data.push(str)
      // update system clipboard
      navigator.clipboard.writeText(str)
    }
    if (this.$data.length > 30) this.$data.shift()
  },
  append: function (str: string) {
    const idx = this.$data.length - 1
    let text = this.$data[idx] || ''
    if (str) text += str
    if (text) {
      this.$data[idx] = text
      // update system clipboard
      navigator.clipboard.writeText(text)
    }
  },
  get: function (n?: number) {
    n = n || 1
    return this.$data
      .slice(this.$data.length - n, this.$data.length)
      .reverse()
      .join('\n')
  },
  pop: function () {
    if (this.$data.length > 1) this.$data.pop()
    return this.get()
  },
  rotate: function () {
    const last = this.$data.pop()
    if (last) this.$data.unshift(last)
    return this.get()
  },
}
