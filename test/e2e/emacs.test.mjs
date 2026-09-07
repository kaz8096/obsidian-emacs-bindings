import { browser, expect } from '@wdio/globals'
import { Key } from 'webdriverio'
import { describe, it } from 'mocha'

import {
  openEditor,
  press,
  chord,
  editorState,
  withClipboard,
} from './helpers.mjs'

describe('Emacs keybindings in Obsidian', () => {
  it('search-panel shortcuts find next/previous and C-g returns focus to editing', async () => {
    await openEditor('target one target two target')
    await chord('C-s')
    const field = await browser.$('.cm-search input[name="search"]')
    await field.waitForDisplayed()
    await field.setValue('target')
    await press(Key.Enter)
    expect((await editorState()).cursor.ch).toBe(6)
    await chord('M-C-s')
    expect((await editorState()).cursor.ch).toBe(17)
    await chord('M-C-r')
    expect((await editorState()).cursor.ch).toBe(6)
    await chord('C-g')
    await field.waitForDisplayed({ reverse: true })
    await chord('C-e')
    expect((await editorState()).cursor.ch).toBe(28)
    expect((await editorState()).text).toBe('target one target two target')
  })
  it('Mod-w handles the region without replacing the note with an empty tab', async () => {
    await openEditor('alpha beta')
    await chord('C-Space')
    for (let i = 0; i < 5; i++) await chord('C-f')
    expect((await editorState()).selection).toBe('alpha')
    const tabs = () =>
      browser.executeObsidian(({ app }) => {
        const leaves = []
        app.workspace.iterateAllLeaves((leaf) => {
          const state = leaf.getViewState()
          if (state.type === 'markdown' || state.type === 'empty') {
            leaves.push({ type: state.type, file: state.state?.file })
          }
        })
        return leaves
      })
    const before = await tabs()
    await withClipboard(async () => {
      await browser.execute(() => navigator.clipboard.writeText('sentinel'))
      const mac = process.platform === 'darwin'
      await press(mac ? Key.Command : Key.Control, 'w')
      expect(await tabs()).toEqual(before)
      expect((await editorState()).text).toBe(mac ? 'alpha beta' : ' beta')
      await browser.waitUntil(
        async () =>
          (await browser.execute(() => navigator.clipboard.readText())) ===
          'alpha'
      )
    })
  })
  it('M-v extends an active mark upward when paging backward', async () => {
    const text = Array.from(
      { length: 200 },
      (_, i) => `line ${String(i).padStart(3, '0')} content`
    ).join('\n')
    await openEditor(text, { line: 100, ch: 0 })
    await chord('C-Space M-v')
    const state = await editorState()
    expect(state.cursor.line).toBeLessThan(99)
    expect(state.selection.endsWith('line 099 content\n')).toBe(true)
    expect(state.text).toBe(text)
  })

  it('M-y does not replace text after an intervening edit', async () => {
    await openEditor('')
    await withClipboard(async () => {
      await browser.execute(() => navigator.clipboard.writeText('first'))
      await chord('C-y')
      await browser.waitUntil(
        async () => (await editorState()).text === 'first'
      )
      await press('!')
      await chord('M-y')
      expect((await editorState()).text).toBe('first!')
    })
  })
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

  it('C-u repeats typed characters with default and explicit counts', async () => {
    await openEditor('')
    await press(Key.Control, 'u')
    await press('a')

    expect((await editorState()).text).toBe('aaaa')
    await chord('C-u')
    await press('3')
    await press('a')
    expect((await editorState()).text).toBe('aaaaaaa')
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
