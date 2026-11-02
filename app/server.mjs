// A tiny stand-in for "your app": a forgot-password page that emails a reset link.
// It only knows plain SMTP settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS), exactly like a real app would.
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import nodemailer from 'nodemailer'

const PORT = Number(process.env.PORT || 3000)
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`
const tokens = new Map() // reset token -> email (memory only, this is a demo)

const transport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 2525),
    secure: false, // STARTTLS, not implicit SSL
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Only for a local Email Blackhole stack with a self-signed certificate.
    tls: { rejectUnauthorized: process.env.SMTP_INSECURE_TLS !== '1' },
  })

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{font:16px system-ui,sans-serif;background:#f4f4f5;margin:0;display:grid;place-items:center;min-height:100vh}
  main{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 12px #0002;width:min(380px,92vw)}
  h1{font-size:1.4rem;margin:0 0 1rem} label{display:block;margin:.8rem 0 .3rem;font-size:.9rem}
  input{width:100%;box-sizing:border-box;padding:.6rem;border:1px solid #ccc;border-radius:6px;font:inherit}
  button{margin-top:1rem;width:100%;padding:.7rem;border:0;border-radius:6px;background:#2563eb;color:#fff;font:inherit;cursor:pointer}
  .ok{color:#166534}.err{color:#b91c1c}
</style></head><body><main>${body}</main></body></html>`

const forgotForm = (note = '') => page('Forgot password', `
  <h1>Forgot your password?</h1>
  ${note}
  <form method="post" action="/forgot-password">
    <label for="email">Email address</label>
    <input id="email" name="email" type="email" autocomplete="email" required>
    <button type="submit">Send reset link</button>
  </form>`)

async function readForm(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 10_000) throw new Error('body too large')
  }
  return new URLSearchParams(raw)
}

const send = (res, status, html) => {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
  res.end(html)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, APP_URL)
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(302, { location: '/forgot-password' }).end()
    } else if (req.method === 'GET' && url.pathname === '/forgot-password') {
      send(res, 200, forgotForm())
    } else if (req.method === 'POST' && url.pathname === '/forgot-password') {
      const email = (await readForm(req)).get('email')?.trim()
      if (!email) return send(res, 400, forgotForm('<p class="err">Please enter your email address.</p>'))
      const token = randomBytes(16).toString('hex')
      tokens.set(token, email)
      const link = `${APP_URL}/reset-password?token=${token}`
      await transport().sendMail({
        from: 'Demo App <noreply@demo-app.test>',
        to: email,
        subject: 'Reset your password',
        text: `Hi,\n\nSomeone asked to reset your password. Open this link to choose a new one:\n\n${link}\n\nIf this was not you, ignore this email.`,
        html: `<p>Hi,</p><p>Someone asked to reset your password. <a href="${link}">Choose a new password</a>.</p><p>If this was not you, ignore this email.</p>`,
      })
      send(res, 200, page('Check your email', `<h1>Check your email</h1><p class="ok">If ${esc(email)} has an account, a reset link is on its way.</p>`))
    } else if (url.pathname === '/reset-password') {
      const token = url.searchParams.get('token') || ''
      if (!tokens.has(token)) return send(res, 404, page('Link expired', '<h1>This link is not valid</h1><p class="err">Ask for a new reset link.</p>'))
      if (req.method === 'POST') {
        const password = (await readForm(req)).get('password') || ''
        if (password.length < 8) return send(res, 400, page('Reset password', '<h1>Choose a new password</h1><p class="err">Use at least 8 characters.</p>'))
        tokens.delete(token)
        return send(res, 200, page('Password updated', '<h1>Password updated</h1><p class="ok">You can now sign in with your new password.</p>'))
      }
      send(res, 200, page('Reset password', `
        <h1>Choose a new password</h1>
        <form method="post" action="/reset-password?token=${esc(token)}">
          <label for="password">New password</label>
          <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
          <button type="submit">Update password</button>
        </form>`))
    } else {
      send(res, 404, page('Not found', '<h1>Not found</h1>'))
    }
  } catch (err) {
    console.error('request failed:', err.message)
    send(res, 500, page('Error', `<h1>Something went wrong</h1><p class="err">${esc(err.message)}</p>`))
  }
})

server.listen(PORT, () => console.log(`Demo app on ${APP_URL}`))
