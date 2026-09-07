import { readFileSync } from 'node:fs'
import { it } from 'mocha'

const covered = new Set()

function normalize(binding) {
  return binding
    .split(' ')
    .map((stroke) => {
      const parts = stroke.split('-')
      const key = parts.pop()
      return [...parts.map((part) => part.toUpperCase()).sort(), key].join('-')
    })
    .join(' ')
}

export function useCase(binding, description, test) {
  const key = normalize(binding)
  if (covered.has(key)) throw new Error(`Duplicate README test: ${binding}`)
  covered.add(key)
  it(`${binding} ${description}`, test)
}

export function coveredBindings() {
  return [...covered].sort()
}

export function documentedBindings() {
  const readme = readFileSync(
    new URL('../../README.md', import.meta.url),
    'utf8'
  )
  const usage = readme.split('## Usage')[1].split('## Note')[0]
  const tableBindings = (section) =>
    section
      .split('\n')
      .filter((line) => /^\|\s*`/.test(line))
      .flatMap((line) =>
        [...line.split('|')[1].matchAll(/`([^`]+)`/g)].map((match) => match[1])
      )
  const movement = usage.split('### Movement')[1].split('### Selection')[0]
  const selection = usage
    .split('### Selection')[1]
    .split('### Basic Editing')[0]
  // The Selection prose promises Shift + every movement except the two
  // already-shifted document movements, plus Ctrl-Shift-Home/End instead.
  const shifted = tableBindings(movement)
    .filter((binding) => !binding.startsWith('S-'))
    .map((binding) => `S-${binding}`)
  const documentSelection = [
    ...selection.matchAll(/`(S-C-(?:Home|End))`/g),
  ].map((match) => match[1])
  return [
    ...new Set(
      [...tableBindings(usage), ...shifted, ...documentSelection].map(normalize)
    ),
  ].sort()
}
