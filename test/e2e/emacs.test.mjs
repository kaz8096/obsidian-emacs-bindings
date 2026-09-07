import { browser, expect } from '@wdio/globals'
import { Key } from 'webdriverio'
import { describe, it } from 'mocha'

async function openEditor(text, cursor = { line: 0, ch: 0 }) {
  // A fresh process and vault copy isolate marks, kill ring, history and settings.
  await browser.reloadObsidian({ vault: './test/vault' })
  await browser.executeObsidian(
    async ({ app, obsidian }, text, cursor) => {
      const file = app.vault.getAbstractFileByPath('input.md')
      if (!(file instanceof obsidian.TFile))
        throw new Error('Missing test note')
      await app.workspace.getLeaf().openFile(file, {
        state: { mode: 'source', source: true },
      })
      const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView)
      if (!view) throw new Error('Markdown editor is not open')
      view.editor.setValue(text)
      view.editor.setCursor(cursor)
      view.editor.focus()
    },
    text,
    cursor
  )
}

async function press(...keys) {
  try {
    await browser.keys(keys)
  } finally {
    await browser.releaseActions()
  }
}

async function editorState() {
  return browser.executeObsidian(({ app, obsidian }) => {
    const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView)
    if (!view) throw new Error('Markdown editor is not open')
    return {
      text: view.editor.getValue(),
      cursor: view.editor.getCursor(),
      selection: view.editor.getSelection(),
    }
  })
}

async function withClipboard(test) {
  // Keep the snapshot inside the renderer, out of WebDriver logs/artifacts.
  await browser.execute(async () => {
    const items = await navigator.clipboard.read()
    globalThis.e2eSavedClipboard = await Promise.all(
      items.map(async (item) => {
        const entries = await Promise.all(
          item.types.map(async (type) => [type, await item.getType(type)])
        )
        return new window.ClipboardItem(Object.fromEntries(entries))
      })
    )
  })
  try {
    await test()
  } finally {
    await browser.execute(async () => {
      const items = globalThis.e2eSavedClipboard
      delete globalThis.e2eSavedClipboard
      if (items.length) await navigator.clipboard.write(items)
      else await navigator.clipboard.writeText('')
    })
  }
}

describe('Emacs keybindings in Obsidian', () => {
  it('C-a moves to the start of the current line without selecting text', async () => {
    await openEditor('abc\ndef', { line: 1, ch: 2 })
    await press(Key.Control, 'a')

    await browser.waitUntil(async () => (await editorState()).cursor.ch === 0)
    expect(await editorState()).toEqual({
      text: 'abc\ndef',
      cursor: { line: 1, ch: 0 },
      selection: '',
    })
  })

  it('C-a keeps the active mark when extending a selection to the line start', async () => {
    await openEditor('abcd', { line: 0, ch: 2 })
    await press(Key.Control, Key.Space)
    await press(Key.Control, 'f')
    await press(Key.Control, 'a')

    await browser.waitUntil(
      async () => (await editorState()).selection === 'ab'
    )
    expect((await editorState()).cursor).toEqual({ line: 0, ch: 0 })
  })

  it('plain Enter retains Obsidian list continuation', async () => {
    await openEditor('- first', { line: 0, ch: 7 })
    await press(Key.Enter)

    expect((await editorState()).text).toBe('- first\n- ')
  })

  it('C-k and C-y round-trip text through the system clipboard', async () => {
    await openEditor('hello world\nnext', { line: 0, ch: 6 })
    await withClipboard(async () => {
      await press(Key.Control, 'k')
      expect((await editorState()).text).toBe('hello \nnext')
      await browser.waitUntil(
        async () =>
          (await browser.execute(() => navigator.clipboard.readText())) ===
          'world'
      )

      await press(Key.Control, 'y')
      await browser.waitUntil(
        async () => (await editorState()).text === 'hello world\nnext'
      )
    })
  })

  it('C-y preserves emoji joiners and zero-width characters from external text', async () => {
    await openEditor('')
    await withClipboard(async () => {
      await browser.execute(() =>
        navigator.clipboard.writeText('👩‍💻 a\u200Bb\u200Cc\uFEFF')
      )
      await press(Key.Control, 'y')

      await browser.waitUntil(
        async () => (await editorState()).text === '👩‍💻 a\u200Bb\u200Cc\uFEFF'
      )
      expect(await browser.execute(() => navigator.clipboard.readText())).toBe(
        '👩‍💻 a\u200Bb\u200Cc\uFEFF'
      )
    })
  })

  it('C-u repeats typed characters without throwing an exception', async () => {
    await openEditor('')
    await press(Key.Control, 'u')
    await press('a')

    expect((await editorState()).text).toBe('aaaa')
  })

  it('C-d deletes a character and C-/ restores it through Obsidian history', async () => {
    await openEditor('abc', { line: 0, ch: 1 })
    await press(Key.Control, 'd')
    expect((await editorState()).text).toBe('ac')

    await press(Key.Control, '/')
    await browser.waitUntil(async () => (await editorState()).text === 'abc')
  })

  it('plain Backspace behaves the same with the plugin enabled or disabled', async () => {
    await openEditor('- ', { line: 0, ch: 2 })
    await press(Key.Backspace)
    const withPlugin = await editorState()

    await openEditor('- ', { line: 0, ch: 2 })
    const page = await browser.getObsidianPage()
    await page.disablePlugin('obsidian-emacs-bindings')
    await press(Key.Backspace)

    expect(withPlugin).toEqual(await editorState())
  })
})
