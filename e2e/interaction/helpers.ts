import { expect, type Locator, type Page } from '@playwright/test'

export * from '../helpers/family-mode-helpers'

/** Returns a function that, when called, yields elapsed milliseconds. */
export function startTimer(): () => number {
  const t0 = Date.now()
  return () => Date.now() - t0
}

/**
 * Waits until at least `count` shared-memory cards are visible in the feed.
 * Defaults to a 15-second timeout to account for feed poll cycles.
 */
export async function waitForFeedCount(page: Page, count: number, timeout = 15_000) {
  await expect(page.locator('.shared-memory-card')).toHaveCount(count, { timeout })
}

/**
 * Asserts that a locator's bounding box is at least minPx × minPx.
 * Used to verify mobile tap targets meet the 44 px guideline (WCAG 2.5.8 / Apple HIG).
 */
export async function assertTapTarget(locator: Locator, minPx = 44) {
  const box = await locator.boundingBox()
  expect(box, 'element has no bounding box').not.toBeNull()
  expect(box!.width, `tap target width ${box!.width}px < ${minPx}px`).toBeGreaterThanOrEqual(minPx)
  expect(box!.height, `tap target height ${box!.height}px < ${minPx}px`).toBeGreaterThanOrEqual(minPx)
}

/**
 * Clicks "send", then asserts the success indicator does NOT appear within
 * `timeout` ms. Returns true if the button stayed absent (fault was effective).
 */
export async function clickAndExpectNoSuccess(
  sendButton: Locator,
  successButton: Locator,
  timeout = 8_000,
): Promise<boolean> {
  await sendButton.click()
  const appeared = await successButton
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false)
  return !appeared
}
