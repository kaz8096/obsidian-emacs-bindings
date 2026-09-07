import { Editor, EditorPosition, MarkdownView, Plugin } from 'obsidian'
import {
  EditorView,
  ViewPlugin,
  PluginValue,
  ViewUpdate,
} from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { EmacsHandler } from './emacs'

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
        const handler = EmacsBindingsPlugin.handlerMap.get(
          // @ts-expect-error TS2339: Property 'cm' does not exist on type 'Editor'
          view.editor.cm as EditorView
        )
        handler?.handleKeyboard(
          new KeyboardEvent('keydown', {
            key: 'a',
            code: 'KeyA',
            ctrlKey: true,
          })
        )
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
      Prec.highest(
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
    )
  }

  async onunload() {}
}
