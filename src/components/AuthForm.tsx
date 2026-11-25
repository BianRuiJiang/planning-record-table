import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <main className="shell">
      <section className="card auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title">规划记录表</h1>
        <p className="section-hint">使用个人时间追踪的同一个账号登录。</p>
        <form onSubmit={submit} className="auth-form">
          <label>
            <span>邮箱</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? '登录中...' : '登录'}
          </button>
        </form>
      </section>
    </main>
  )
}
