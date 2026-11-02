import { test, expect } from '@playwright/test'
import { inbox, extractLink } from 'emailblackhole'

const ebh = inbox() // reads EBH_URL, EBH_ID, EBH_SECRET from .env

test('forgot password: the reset email arrives and its link works', async ({ page }) => {
  // A recipient only this run uses, so runs that share an inbox never see each other's mail.
  const email = `reset-${Date.now()}@example.com`

  // 1. Note where the inbox is now, so older mail can never satisfy this run.
  const after = await ebh.mark()

  // 2. Do what a user does: open the page, type the address, submit.
  await page.goto('/forgot-password')
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  // 3. Wait for the message (no sleep, no polling loop) and take the link from it.
  const message = await ebh.waitForEmail({ after, to: email, subject: 'Reset your password' })
  const link = extractLink(message, '/reset-password')
  expect(link, 'the email should contain the reset link').toBeTruthy()

  // 4. Follow the link like the user would.
  await page.goto(link!)
  await page.getByLabel('New password').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()
})
