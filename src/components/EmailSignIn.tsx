import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Props {
  // Fired right before the email is sent — use to persist plan selection and
  // record signup-intent analytics, mirroring the Google button.
  onBeforeSend?: () => void;
}

// Passwordless email sign-in. Enter email → receive a link + 6-digit code.
// User can either click the link (lands on /callback) or type the code here.
// Verifying the code establishes the session, then routes through /callback so
// post-login routing (checkout / return-to-property) is reused.
export default function EmailSignIn({ onBeforeSend }: Props) {
  const { loginWithEmail, verifyEmailOtp } = useAuthStore();
  const navigate = useNavigate();

  const [email, setEmail]   = useState('');
  const [code, setCode]     = useState('');
  const [step, setStep]     = useState<'email' | 'code'>('email');
  const [busy, setBusy]     = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setErrorMsg('');
    try {
      onBeforeSend?.();
      await loginWithEmail(trimmed);
      setStep('code');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send the email. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) { setErrorMsg('Enter the 6-digit code from your email.'); return; }
    setBusy(true);
    setErrorMsg('');
    try {
      await verifyEmailOtp(email.trim(), token);
      navigate('/callback');   // reuse centralized post-login routing
    } catch {
      setErrorMsg('That code is invalid or expired. Check the email or request a new one.');
      setBusy(false);
    }
  };

  // ── Code entry step ──────────────────────────────────────────────────────────
  if (step === 'code') {
    return (
      <form onSubmit={verifyCode} className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3">
          <Mail className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
          <p className="text-xs text-teal-800 leading-relaxed">
            We emailed a sign-in link and code to <span className="font-medium">{email}</span>. Click the link, or enter the code below.
          </p>
        </div>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="6-digit code"
          className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-center text-lg font-semibold tracking-[0.3em] text-slate-900 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal placeholder-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Verifying…' : <>Verify &amp; sign in <ArrowRight className="w-4 h-4" /></>}
        </button>
        {errorMsg && <p className="text-xs text-red-600 text-center">{errorMsg}</p>}
        <button
          type="button"
          onClick={() => { setStep('email'); setCode(''); setErrorMsg(''); }}
          className="w-full text-xs text-slate-500 hover:text-slate-700 font-medium"
        >
          Use a different email
        </button>
      </form>
    );
  }

  // ── Email entry step ─────────────────────────────────────────────────────────
  return (
    <form onSubmit={sendLink} className="space-y-2.5">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        autoComplete="email"
        className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Sending…' : <>Continue with email <ArrowRight className="w-4 h-4" /></>}
      </button>
      {errorMsg && <p className="text-xs text-red-600 text-center">{errorMsg}</p>}
    </form>
  );
}
