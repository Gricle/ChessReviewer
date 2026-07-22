import { useEffect, useState, type FormEvent } from 'react';
import { UserCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Auth } from '../supabase/useAuth';

interface Props {
  auth: Auth;
  onClose: () => void;
}

export function AuthModal({ auth, onClose }: Props) {
  const { t } = useTranslation('import');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSignOut() {
    await auth.signOut();
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const err = mode === 'signin'
      ? await auth.signIn(email, password)
      : await auth.signUp(email, password);
    setBusy(false);
    if (err) {
      setError(err);
    } else if (mode === 'signup') {
      setNotice(t('auth.confirmEmailNotice'));
      setError(null);
    } else {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#05040c]/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md glass-panel rounded-3xl p-6 border border-cyan-400/30 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t('auth.close')}
          className="absolute top-4 right-4 p-2 rounded-full bg-indigo-950/60 hover:bg-indigo-900/60 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 id="auth-modal-title" className="text-lg font-extrabold text-white font-display">
              {auth.user ? t('auth.titleAccount') : t('auth.titleSignIn')}
            </h3>
            <p className="text-xs font-mono text-slate-400">
              {auth.user ? t('auth.subtitleCloud') : t('auth.subtitleGuest')}
            </p>
          </div>
        </div>

        {auth.user ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 font-mono text-xs space-y-1">
              <p className="text-slate-400">{t('auth.signedInAs')}</p>
              <p className="text-slate-300">{auth.user.email}</p>
            </div>

            <button
              onClick={() => void handleSignOut()}
              className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold transition-all cursor-pointer"
            >
              {t('auth.signOut')}
            </button>
          </div>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold">{t('auth.emailLabel')}</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="w-full bg-[#0b0918] border border-indigo-500/30 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold">{t('auth.passwordLabel')}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="w-full bg-[#0b0918] border border-indigo-500/30 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#05040c] font-sans font-bold text-sm shadow-[0_0_15px_rgba(56,225,214,0.3)] transition-all cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? t('auth.submitBusy') : mode === 'signin' ? t('auth.submitSignIn') : t('auth.submitSignUp')}
              </button>
            </form>

            <button
              onClick={async () => {
                setNotice(null);
                setError(await auth.signInWithGoogle());
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 text-slate-200 font-mono text-xs font-bold transition-all cursor-pointer"
            >
              {t('auth.google')}
            </button>

            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null); }}
              className="w-full text-center text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              {mode === 'signin' ? t('auth.toggleToSignUp') : t('auth.toggleToSignIn')}
            </button>

            {error && <div className="text-rose-300">{error}</div>}
            {notice && <div className="text-cyan-300">{notice}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
