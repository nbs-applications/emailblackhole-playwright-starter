import 'dotenv/config' // loads .env: the SMTP_* values for the app and the EBH_* values for the test
import { defineConfig } from '@playwright/test'

const PORT = 3000

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  // The app under test is started with the Email Blackhole SMTP settings, like your real app's .env.
  webServer: {
    command: 'node app/server.mjs',
    url: `http://localhost:${PORT}/forgot-password`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      SMTP_HOST: process.env.SMTP_HOST ?? '',
      SMTP_PORT: process.env.SMTP_PORT ?? '2525',
      SMTP_USER: process.env.SMTP_USER ?? '',
      SMTP_PASS: process.env.SMTP_PASS ?? '',
      SMTP_INSECURE_TLS: process.env.SMTP_TLS_INSECURE === 'true' ? '1' : '', // only for a local stack
    },
  },
})
