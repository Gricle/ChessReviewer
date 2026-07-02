import { useState, type FormEvent } from 'react';
import type { Auth } from '../supabase/useAuth';

interface Props {
  auth: Auth;
}

export function AuthBar({ auth }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!auth.enabled) return null;

  if (auth.user) {
    return (
      <div className="authbar">
        <span className="auth-email" title={auth.user.email}>{auth.user.email}</span>
        <button onClick={() => void auth.signOut()}>Sign out</button>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = mode === 'signin'
      ? await auth.signIn(email, password)
      : await auth.signUp(email, password);
    setBusy(false);
    if (err) {
      setError(err);
    } else if (mode === 'signup') {
      setError('Check your email to confirm your account.');
    } else {
      setOpen(false);
    }
  }

  return (
    <div className="authbar">
      <button className="primary" onClick={() => { setOpen(true); setError(null); }}>
        Sign in
      </button>

      {open && (
        <div className="auth-overlay" onClick={() => setOpen(false)}>
          <div className="card auth-modal" onClick={(e) => e.stopPropagation()}>
            <h4>{mode === 'signin' ? 'Sign in' : 'Create account'}</h4>
            <form onSubmit={submit}>
              <input
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button className="primary" type="submit" disabled={busy}>
                {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <button className="auth-google" onClick={() => void auth.signInWithGoogle()}>
              Continue with Google
            </button>
            <button
              className="auth-switch"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
            >
              {mode === 'signin' ? 'No account? Create one' : 'Have an account? Sign in'}
            </button>
            {error && <div className="err">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
