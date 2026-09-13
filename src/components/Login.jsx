import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, signUp, resetPasswordForEmail } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)

    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
    } else if (mode === 'reset') {
      const { error } = await resetPasswordForEmail(email)
      if (error) setError(error.message)
      else setInfo('If that email has an account, a reset link is on its way.')
    } else {
      if (!displayName.trim()) {
        setError('Please enter a display name.')
        setBusy(false)
        return
      }
      const { error } = await signUp(email, password, displayName.trim())
      if (error) {
        setError(error.message)
      } else {
        setInfo('Account created! If email confirmation is enabled, check your inbox — otherwise you are now signed in.')
      }
    }
    setBusy(false)
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">🍰 Bake Off Fantasy</h1>
        <p className="auth-subtitle">
          {mode === 'signin' && 'Sign in to make your picks.'}
          {mode === 'signup' && 'Create an account to join the pool.'}
          {mode === 'reset' && "Enter your email and we'll send a reset link."}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <label>
              Display name
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Adam"
                required
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          {mode !== 'reset' && (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : mode === 'reset' ? 'Send reset link' : 'Create Account'}
          </button>
        </form>

        {mode === 'signin' && (
          <>
            <button type="button" className="auth-toggle" onClick={() => switchMode('reset')}>
              Forgot password?
            </button>
            <button type="button" className="auth-toggle" onClick={() => switchMode('signup')}>
              Don't have an account? Sign up
            </button>
          </>
        )}
        {mode === 'signup' && (
          <button type="button" className="auth-toggle" onClick={() => switchMode('signin')}>
            Already have an account? Sign in
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="auth-toggle" onClick={() => switchMode('signin')}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
