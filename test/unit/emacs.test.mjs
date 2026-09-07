import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { history } from '@codemirror/commands'
import { EmacsHandler } from '../../src/emacs'

describe('Emacs editing', () => {
  let view
  let handler
  let clipboard

  beforeEach(() => {
    clipboard = ''
    // The system clipboard is the only external service replaced in these tests.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: async () => clipboard,
        writeText: async (text) => {
          clipboard = text
        },
      },
    })
    view = new EditorView({
      state: EditorState.create({ extensions: [history()] }),
      parent: document.body,
    })
    handler = new EmacsHandler(view)
  })

  afterEach(() => {
    view?.destroy()
    document.body.replaceChildren()
    delete navigator.clipboard
  })

  function press(key, code, modifiers = {}) {
    return handler.handleKeyboard(
      new KeyboardEvent('keydown', {
        key,
        code,
        ...modifiers,
      })
    )
  }

  function setText(doc, anchor = 0) {
    view.setState(
      EditorState.create({
        doc,
        selection: { anchor },
        extensions: [history()],
      })
    )
  }

  it('uses the active keyboard layout for Control bindings', () => {
    setText('abcd', 2)
    press('f', 'KeyB', { ctrlKey: true })

    expect(view.state.selection.main.head).toBe(3)
  })

  it('Shift-Control-f extends the selection with a remapped uppercase letter', () => {
    setText('abcd', 1)
    press('F', 'KeyB', { ctrlKey: true, shiftKey: true })

    expect(
      view.state.sliceDoc(
        view.state.selection.main.from,
        view.state.selection.main.to
      )
    ).toBe('b')
  })

  it('macOS Option-f still moves forward over a word when event.key is ƒ', () => {
    setText('hello world')
    press('ƒ', 'KeyF', { altKey: true })

    expect(view.state.selection.main.head).toBe(5)
  })

  it('C-u followed by a character inserts that character four times', () => {
    press('u', 'KeyU', { ctrlKey: true })
    press('a', 'KeyA')

    expect(view.state.doc.toString()).toBe('aaaa')
  })

  it('C-u accepts an explicit repeat count before a character', () => {
    press('u', 'KeyU', { ctrlKey: true })
    press('3', 'Digit3')
    press('a', 'KeyA')

    expect(view.state.doc.toString()).toBe('aaa')
  })

  it('C-k removes a final newline at the cursor', () => {
    setText('a\n', 1)
    press('k', 'KeyK', { ctrlKey: true })

    expect(view.state.doc.toString()).toBe('a')
    expect(clipboard).toBe('\n')
  })

  it('C-Space activates selection and C-g returns movement to cursor-only mode', () => {
    setText('abcd', 1)
    press(' ', 'Space', { ctrlKey: true })
    press('f', 'KeyF', { ctrlKey: true })
    press('f', 'KeyF', { ctrlKey: true })
    expect(view.state.selection.main.from).toBe(1)
    expect(view.state.selection.main.to).toBe(3)

    press('g', 'KeyG', { ctrlKey: true })
    press('b', 'KeyB', { ctrlKey: true })
    expect(view.state.selection.main.empty).toBe(true)
    expect(view.state.selection.main.head).toBe(2)
  })

  it('C-k followed by C-y restores the killed text', async () => {
    setText('hello world\nnext', 6)
    press('k', 'KeyK', { ctrlKey: true })
    expect(view.state.doc.toString()).toBe('hello \nnext')
    expect(clipboard).toBe('world')

    press('y', 'KeyY', { ctrlKey: true })
    await vi.waitFor(() => {
      expect(view.state.doc.toString()).toBe('hello world\nnext')
    })
  })

  it('C-d deletes a character and C-/ restores it with undo', () => {
    setText('abc', 1)
    press('d', 'KeyD', { ctrlKey: true })
    expect(view.state.doc.toString()).toBe('ac')

    press('/', 'Slash', { ctrlKey: true })
    expect(view.state.doc.toString()).toBe('abc')
  })

  it('C-m inserts a newline at the cursor', () => {
    setText('abcd', 2)
    press('m', 'KeyM', { ctrlKey: true })

    expect(view.state.doc.toString()).toBe('ab\ncd')
  })

  it('M-h includes the separator before the last paragraph without a trailing newline', () => {
    setText('alpha\nbeta\n\ngamma', 14)
    press('h', 'KeyH', { altKey: true })
    const range = view.state.selection.main
    expect(view.state.sliceDoc(range.from, range.to)).toBe('\ngamma')
    expect(range.head).toBe(11)
  })

  it('C-x h selects the whole document and C-w cuts the selected region', () => {
    setText('first\nsecond', 3)
    press('x', 'KeyX', { ctrlKey: true })
    press('h', 'KeyH')
    expect(view.state.selection.main.from).toBe(0)
    expect(view.state.selection.main.to).toBe(12)

    press('w', 'KeyW', { ctrlKey: true })
    expect(view.state.doc.toString()).toBe('')
    expect(clipboard).toBe('first\nsecond')
  })

  it('yanks external text without removing emoji joiners or zero-width characters', async () => {
    clipboard = '👩‍💻 a\u200Bb\u200Cc\uFEFF'
    press('y', 'KeyY', { ctrlKey: true })

    await vi.waitFor(() => {
      expect(view.state.doc.toString()).toBe('👩‍💻 a\u200Bb\u200Cc\uFEFF')
    })
    expect(clipboard).toBe('👩‍💻 a\u200Bb\u200Cc\uFEFF')
  })

  it('normalizes Windows and classic Mac line endings when yanking', async () => {
    clipboard = 'one\r\ntwo\rthree'
    press('y', 'KeyY', { ctrlKey: true })

    await vi.waitFor(() => {
      expect(view.state.doc.toString()).toBe('one\ntwo\nthree')
    })
  })
})
