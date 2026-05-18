import { test as base, expect } from '@playwright/test'

export type ConsoleError   = { type: string; text: string; location: string }
export type NetworkFailure = { status: number; url: string; method: string }

type ProductionFixtures = {
  consoleErrors:   ConsoleError[]
  networkFailures: NetworkFailure[]
}

export const test = base.extend<ProductionFixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: ConsoleError[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push({ type: msg.type(), text: msg.text(), location: page.url() })
      }
    })
    await use(errors)
  },

  networkFailures: async ({ page }, use) => {
    const failures: NetworkFailure[] = []
    page.on('response', response => {
      if (response.status() >= 400) {
        failures.push({
          status: response.status(),
          url: response.url(),
          method: response.request().method(),
        })
      }
    })
    await use(failures)
  },
})

export { expect }
