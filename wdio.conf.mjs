import { mkdir, rm } from 'node:fs/promises'
import { browser } from '@wdio/globals'

export const config = {
  runner: 'local',
  framework: 'mocha',
  specs: ['./test/e2e/**/*.test.mjs'],
  maxInstances: 1,
  services: ['obsidian'],
  reporters: ['spec'],
  cacheDir: './.obsidian-cache',
  outputDir: './artifacts/e2e',
  logLevel: 'warn',
  capabilities: [
    {
      browserName: 'obsidian',
      'wdio:obsidianOptions': {
        appVersion: process.env.OBSIDIAN_APP_VERSION || '1.13.7',
        installerVersion: process.env.OBSIDIAN_INSTALLER_VERSION || '1.13.7',
        plugins: ['.'],
        vault: './test/fixtures/vault',
        copy: true,
      },
    },
  ],
  mochaOpts: { timeout: 60_000 },
  waitforTimeout: 10_000,
  injectGlobals: false,
  async onPrepare() {
    await rm('./artifacts/e2e', { recursive: true, force: true })
  },
  async afterTest(test, context, { passed }) {
    if (!passed) {
      try {
        await mkdir('./artifacts/e2e', { recursive: true })
        const name = test.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 100)
        await browser.saveScreenshot(`./artifacts/e2e/${name}.png`)
      } catch (error) {
        console.warn('Could not capture failure screenshot:', error.message)
      }
    }
  },
}
