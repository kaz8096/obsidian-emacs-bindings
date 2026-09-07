import { browser } from '@wdio/globals'
import { Key } from 'webdriverio'

export async function chord(binding) {
  const modifiers = { C: Key.Control, M: Key.Alt, S: Key.Shift }
  const named = { Space: Key.Space, Home: Key.Home, End: Key.End }
  for (const stroke of binding.split(' ')) {
    const parts = stroke.split('-')
    const key = parts.pop()
    const keys = parts.map((part) => modifiers[part])
    // The README's M-@ is Option/Alt + Shift + the US-layout 2 key.
    if (key === '@') keys.push(Key.Shift, '2')
    else keys.push(named[key] || key)
    await press(...keys)
  }
}

export async function openEditor(text, cursor = { line: 0, ch: 0 }) {
  // A fresh process and vault copy isolate marks, kill ring, history and settings.
  await browser.reloadObsidian({ vault: './test/fixtures/vault' })
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
      view.editor.scrollIntoView({ from: cursor, to: cursor }, true)
      view.editor.focus()
    },
    text,
    cursor
  )
  // CodeMirror measures and scrolls on animation frames; page commands need layout.
  await browser.executeAsync((done) => {
    requestAnimationFrame(() => requestAnimationFrame(() => done()))
  })
}

export async function press(...keys) {
  try {
    await browser.keys(keys)
  } finally {
    await browser.releaseActions()
  }
}

export async function editorState() {
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

export async function withClipboard(test) {
  // Keep the snapshot inside the renderer, out of WebDriver logs/artifacts.
  await browser.execute(async () => {
    const items = await navigator.clipboard.read()
    globalThis.e2eSavedClipboard = await Promise.all(
      items
        .filter((item) => item.types.length > 0)
        .map(async (item) => {
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
