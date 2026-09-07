import { browser, expect } from '@wdio/globals'
import { Key } from 'webdriverio'
import { describe, it } from 'mocha'
import {
  useCase,
  coveredBindings,
  documentedBindings,
} from './readme-coverage.mjs'
import {
  openEditor,
  press,
  chord,
  editorState,
  withClipboard,
} from './helpers.mjs'

const movementText = 'alpha beta\ngamma delta\nomega theta'
const movementCases = [
  ['C-p', { line: 0, ch: 6 }],
  ['C-n', { line: 2, ch: 6 }],
  ['C-b', { line: 1, ch: 5 }],
  ['C-f', { line: 1, ch: 7 }],
  ['M-b', { line: 1, ch: 0 }],
  ['M-f', { line: 1, ch: 11 }],
  ['C-a', { line: 1, ch: 0 }],
  ['C-e', { line: 1, ch: 11 }],
  ['S-M-,', { line: 0, ch: 0 }],
  ['S-M-.', { line: 2, ch: 11 }],
]

describe('README: Movement', () => {
  for (const [binding, cursor] of movementCases) {
    useCase(
      binding,
      `moves the cursor without selecting or changing text`,
      async () => {
        // Identical lines keep visual columns equal with proportional editor fonts.
        const text = ['C-p', 'C-n'].includes(binding)
          ? 'alpha beta\nalpha beta\nalpha beta'
          : movementText
        await openEditor(text, { line: 1, ch: 6 })
        await chord(binding)
        expect(await editorState()).toEqual({ text, cursor, selection: '' })
      }
    )
  }
})

describe('README: Selection', () => {
  const cases = [
    ['S-C-p', { line: 0, ch: 6 }, 'beta\nalpha '],
    ['S-C-n', { line: 2, ch: 6 }, 'beta\nalpha '],
    ['S-C-b', { line: 1, ch: 5 }, ' '],
    ['S-C-f', { line: 1, ch: 7 }, 'd'],
    ['S-M-b', { line: 1, ch: 0 }, 'gamma '],
    ['S-M-f', { line: 1, ch: 11 }, 'delta'],
    ['S-C-a', { line: 1, ch: 0 }, 'gamma '],
    ['S-C-e', { line: 1, ch: 11 }, 'delta'],
    ['S-C-Home', { line: 0, ch: 0 }, 'alpha beta\ngamma '],
    ['S-C-End', { line: 2, ch: 11 }, 'delta\nomega theta'],
  ]
  for (const [binding, cursor, selection] of cases) {
    useCase(
      binding,
      `extends selection to the requested position`,
      async () => {
        const text = ['S-C-p', 'S-C-n'].includes(binding)
          ? 'alpha beta\nalpha beta\nalpha beta'
          : movementText
        await openEditor(text, { line: 1, ch: 6 })
        await chord(binding)
        expect(await editorState()).toEqual({ text, cursor, selection })
      }
    )
  }
  for (const binding of ['C-x C-p', 'C-x h']) {
    useCase(binding, `selects the entire document`, async () => {
      await openEditor(movementText, { line: 1, ch: 6 })
      await chord(binding)
      expect((await editorState()).selection).toBe(movementText)
      expect((await editorState()).text).toBe(movementText)
    })
  }
})

describe('README: Scrolling and page selection', () => {
  const text = Array.from(
    { length: 200 },
    (_, i) => `line ${String(i).padStart(3, '0')} content`
  ).join('\n')
  for (const [binding, direction, selecting] of [
    ['C-v', 1, false],
    ['M-v', -1, false],
    ['S-C-v', 1, true],
    ['S-M-v', -1, true],
  ]) {
    useCase(
      binding,
      `moves a page ${direction > 0 ? 'down' : 'up'}${
        selecting ? ' while selecting' : ''
      }`,
      async () => {
        await openEditor(text, { line: 100, ch: 0 })
        const scrollTop = () =>
          browser.executeObsidian(({ app, obsidian }) => {
            const view = app.workspace.getActiveViewOfType(
              obsidian.MarkdownView
            )
            return view.containerEl.querySelector('.cm-scroller').scrollTop
          })
        const before = await scrollTop()
        await chord(binding)
        await browser.waitUntil(
          async () => direction * ((await scrollTop()) - before) > 0
        )
        const state = await editorState()
        expect(direction * (state.cursor.line - 100)).toBeGreaterThan(1)
        expect(state.text).toBe(text)
        if (selecting) {
          expect(state.selection.length).toBeGreaterThan(34)
          if (direction > 0)
            expect(state.selection.startsWith('line 100 content\n')).toBe(true)
          else expect(state.selection.endsWith('line 099 content\n')).toBe(true)
        } else expect(state.selection).toBe('')
      }
    )
  }
})

async function tabs() {
  return browser.executeObsidian(({ app }) => {
    const leaves = []
    app.workspace.iterateAllLeaves((leaf) => {
      const state = leaf.getViewState()
      if (state.type === 'markdown' || state.type === 'empty') {
        leaves.push({ type: state.type, file: state.state?.file })
      }
    })
    return leaves
  })
}

describe('README: Basic Editing', () => {
  for (const [binding, text, cursor] of [
    ['C-h', 'bc', { line: 0, ch: 0 }],
    ['C-d', 'ac', { line: 0, ch: 1 }],
    ['C-m', 'a\nbc', { line: 1, ch: 0 }],
  ]) {
    useCase(binding, `edits at the cursor`, async () => {
      await openEditor('abc', { line: 0, ch: 1 })
      await chord(binding)
      expect(await editorState()).toEqual({ text, cursor, selection: '' })
    })
  }

  for (const [binding, initial, ch, expected, copied] of [
    ['M-d', 'alpha beta', 0, ' beta', 'alpha'],
    ['C-k', 'alpha beta\nnext', 6, 'alpha \nnext', 'beta'],
    ['C-w', 'alpha beta', 0, ' beta', 'alpha'],
  ]) {
    useCase(
      binding,
      `kills the requested text and copies it to the clipboard`,
      async () => {
        await openEditor(initial, { line: 0, ch })
        if (binding === 'C-w') {
          await chord('C-Space')
          for (let i = 0; i < 5; i++) await chord('C-f')
          expect((await editorState()).selection).toBe('alpha')
        }
        await withClipboard(async () => {
          await browser.execute(() => navigator.clipboard.writeText('sentinel'))
          await chord(binding)
          expect((await editorState()).text).toBe(expected)
          expect((await editorState()).selection).toBe('')
          await browser.waitUntil(
            async () =>
              (await browser.execute(() => navigator.clipboard.readText())) ===
              copied
          )
        })
      }
    )
  }

  useCase('C-y', 'inserts external clipboard text at the cursor', async () => {
    await openEditor('alpha beta', { line: 0, ch: 6 })
    await withClipboard(async () => {
      await browser.execute(() => navigator.clipboard.writeText('outside'))
      await chord('C-y')
      await browser.waitUntil(
        async () => (await editorState()).text === 'alpha outsidebeta'
      )
      expect((await editorState()).cursor).toEqual({ line: 0, ch: 13 })
    })
  })

  useCase(
    'M-y',
    'replaces the last yank with the previous kill-ring entry',
    async () => {
      await openEditor('first\nsecond\n')
      await withClipboard(async () => {
        await chord('C-k')
        expect((await editorState()).text).toBe('\nsecond\n')
        await chord('C-n')
        await chord('C-k')
        expect((await editorState()).text).toBe('\n\n')
        await chord('C-y')
        await browser.waitUntil(
          async () => (await editorState()).text === '\nsecond\n'
        )
        await chord('M-y')
        expect((await editorState()).text).toBe('\nfirst\n')
        await chord('M-y')
        expect((await editorState()).text).toBe('\nsecond\n')
      })
    }
  )

  useCase(
    'C-Space',
    'activates and then deactivates mark-based selection',
    async () => {
      await openEditor('alpha beta')
      await chord('C-Space')
      await chord('C-f')
      expect((await editorState()).selection).toBe('a')
      await chord('C-Space')
      await chord('C-f')
      expect(await editorState()).toEqual({
        text: 'alpha beta',
        cursor: { line: 0, ch: 2 },
        selection: '',
      })
    }
  )

  useCase(
    'C-g',
    'clears the region and returns movement to cursor-only mode',
    async () => {
      await openEditor('alpha beta')
      await chord('C-Space')
      await chord('C-f')
      expect((await editorState()).selection).toBe('a')
      await chord('C-g')
      expect((await editorState()).selection).toBe('')
      await chord('C-f')
      expect(await editorState()).toEqual({
        text: 'alpha beta',
        cursor: { line: 0, ch: 2 },
        selection: '',
      })
    }
  )

  useCase(
    'C-x C-x',
    'exchanges point and mark while preserving the region',
    async () => {
      await openEditor('alpha beta')
      await chord('C-Space')
      await chord('C-f')
      await chord('C-f')
      expect((await editorState()).cursor.ch).toBe(2)
      await chord('C-x C-x')
      expect((await editorState()).selection).toBe('al')
      expect((await editorState()).cursor.ch).toBe(0)
      await chord('C-x C-x')
      expect((await editorState()).selection).toBe('al')
      expect((await editorState()).cursor.ch).toBe(2)
    }
  )

  for (const binding of ['C-/', 'S-C-/']) {
    useCase(
      binding,
      `${binding === 'C-/' ? 'undoes' : 'redoes'} an edit`,
      async () => {
        await openEditor('abc', { line: 0, ch: 1 })
        await chord('C-d')
        expect((await editorState()).text).toBe('ac')
        if (binding === 'S-C-/') {
          await chord('C-/')
          expect((await editorState()).text).toBe('abc')
        }
        await chord(binding)
        expect((await editorState()).text).toBe(
          binding === 'C-/' ? 'abc' : 'ac'
        )
      }
    )
  }

  useCase(
    'M-h',
    'selects the complete paragraph at the start of the document',
    async () => {
      await openEditor('alpha\nbeta\n\ngamma', { line: 0, ch: 2 })
      await chord('M-h')
      expect((await editorState()).selection).toBe('alpha\nbeta\n')
      expect((await editorState()).text).toBe('alpha\nbeta\n\ngamma')
    }
  )

  useCase(
    'M-@',
    'marks the next word and keeps point at the original position',
    async () => {
      await openEditor('alpha beta')
      await chord('M-@')
      expect(await editorState()).toEqual({
        text: 'alpha beta',
        cursor: { line: 0, ch: 0 },
        selection: 'alpha',
      })
    }
  )

  useCase(
    'M-w',
    'copies the region without changing the document or opening/closing a tab',
    async () => {
      await openEditor('alpha beta')
      await press(Key.Control, Key.Space)
      for (let i = 0; i < 5; i++) await press(Key.Control, 'f')
      expect((await editorState()).selection).toBe('alpha')
      const before = await tabs()

      await withClipboard(async () => {
        await browser.execute(() => navigator.clipboard.writeText('sentinel'))
        await press(Key.Alt, 'w')
        expect(await tabs()).toEqual(before)
        expect((await editorState()).text).toBe('alpha beta')
        await browser.waitUntil(
          async () =>
            (await browser.execute(() => navigator.clipboard.readText())) ===
            'alpha'
        )
      })
    }
  )
})

describe('README: Find and Search', () => {
  useCase(
    'S-M-5',
    'opens replacement controls and replaces a chosen match',
    async () => {
      await openEditor('target one target two')
      await chord('S-M-5')
      const search = await browser.$('.cm-search input[name="search"]')
      const replacement = await browser.$('.cm-search input[name="replace"]')
      await search.waitForDisplayed()
      await replacement.waitForDisplayed()
      await search.setValue('target')
      await press(Key.Enter)
      await browser.waitUntil(
        async () => (await editorState()).selection === 'target'
      )
      await replacement.setValue('match')
      await browser.$('.cm-search button[name="replace"]').click()
      await browser.waitUntil(
        async () => (await editorState()).text === 'match one target two'
      )
    }
  )
  for (const binding of ['C-s', 'C-r']) {
    useCase(
      binding,
      `opens the search panel and finds entered text`,
      async () => {
        await openEditor('zero target one target two')
        await chord(binding)
        const field = await browser.$('.cm-search input[name="search"]')
        await field.waitForDisplayed()
        await field.setValue('target')
        await press(Key.Enter)
        await browser.waitUntil(
          async () => (await editorState()).selection === 'target'
        )
        expect((await editorState()).cursor).toEqual({ line: 0, ch: 11 })
      }
    )
  }
  for (const [binding, ch] of [
    ['M-C-s', 17],
    ['M-C-r', 28],
  ]) {
    useCase(
      binding,
      `navigates to the ${binding.endsWith('s') ? 'next' : 'previous'} match`,
      async () => {
        await openEditor('target one target two target')
        await chord('C-s')
        const field = await browser.$('.cm-search input[name="search"]')
        await field.waitForDisplayed()
        await field.setValue('target')
        await press(Key.Enter)
        await browser.waitUntil(
          async () => (await editorState()).selection === 'target'
        )
        expect((await editorState()).cursor.ch).toBe(6)
        await press(Key.Escape)
        await chord(binding)
        expect((await editorState()).selection).toBe('target')
        expect((await editorState()).cursor).toEqual({ line: 0, ch })
        expect((await editorState()).text).toBe('target one target two target')
      }
    )
  }
})

describe('README coverage', () => {
  it('has an E2E scenario for every documented binding and Shift variant', () => {
    expect(coveredBindings()).toEqual(documentedBindings())
  })
})
