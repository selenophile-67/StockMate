import React, { useState } from 'react';
import { X, Lock, Mail, User, KeyRound, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export function AuthModal() {
  const { authModalOpen, setAuthModalOpen, login, loginDemo, register, notify } = useApp();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [generatedTokenHint, setGeneratedTokenHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        setAuthModalOpen(false);
      } else if (mode === 'register') {
        await register(name, email, password);
        setAuthModalOpen(false);
      } else if (mode === 'forgot') {
        const res = await apiRequest<{ message: string; demoResetToken?: string }>(
          '/api/auth/forgot-password',
          { method: 'POST', body: JSON.stringify({ email }) }
        );
        setGeneratedTokenHint(res.demoResetToken || null);
        notify('info', res.message);
        setMode('reset');
      } else if (mode === 'reset') {
        await apiRequest('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, token: resetToken, newPassword: password }),
        });
        notify('success', 'Password updated. Please sign in with your new password.');
        setMode('login');
        setPassword('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Account authentication"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {mode === 'login' && 'Sign in to StockMate'}
              {mode === 'register' && 'Create StockMate Account'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'reset' && 'Enter Reset Token'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Private portfolios, watchlists, alerts & calculation history
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {generatedTokenHint && mode === 'reset' && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3.5 py-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                Sandbox reset token generated:{' '}
                <span className="font-mono font-semibold select-all">{generatedTokenHint}</span>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Mehta"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investor@domain.in"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {mode === 'reset' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Reset Token
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="12-character reset code"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {mode === 'reset' ? 'New Password' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {busy
              ? 'Processing...'
              : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                  ? 'Create Account'
                  : mode === 'forgot'
                    ? 'Generate Reset Token'
                    : 'Reset Password'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await loginDemo();
                  setAuthModalOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
            >
              Load Sample Demo Investor Workspace (demo@stockmate.in)
            </button>
          )}

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
            {mode === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('register');
                  }}
                  className="hover:text-blue-500 font-medium"
                >
                  Create an account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('forgot');
                  }}
                  className="hover:text-blue-500"
                >
                  Forgot password?
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('login');
                }}
                className="hover:text-blue-500 font-medium"
              >
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
