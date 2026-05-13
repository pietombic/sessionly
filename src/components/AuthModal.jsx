import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const BASE = import.meta.env.DEV ? window.location.origin : window.location.origin;

function OAuthButton({ provider, label, icon, onClick, loading }) {
  return (
    <button
      type="button"
      className="auth-oauth-btn"
      onClick={onClick}
      disabled={loading}
    >
      <span className="auth-oauth-icon">{icon}</span>
      {label}
    </button>
  );
}

export function AuthModal({ onClose }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'github'
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const reset = () => { setError(null); setSuccess(null); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    reset();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    // on success, onAuthStateChange in App.jsx handles the rest
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Le password non corrispondono.'); return; }
    if (password.length < 6) { setError('La password deve essere di almeno 6 caratteri.'); return; }
    setLoading(true);
    reset();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: BASE },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSuccess('Controlla la tua email per confermare il account, poi accedi.');
  };

  const handleOAuth = async (provider) => {
    setOauthLoading(provider);
    reset();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: BASE },
    });
    if (error) { setError(error.message); setOauthLoading(null); }
    // on success, browser redirects — no need to reset loading
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <h2 style={{ fontFamily: 'var(--serif)' }}>
              Sessionly
            </h2>
            <div className="sub">Il tuo piano di studio universitario.</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className="modal-body" style={{ gap: 18 }}>
          {/* Tab switcher */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === 'login' ? 'on' : ''}`}
              onClick={() => { setTab('login'); reset(); }}
            >Accedi</button>
            <button
              className={`auth-tab ${tab === 'register' ? 'on' : ''}`}
              onClick={() => { setTab('register'); reset(); }}
            >Registrati</button>
          </div>

          {/* OAuth buttons */}
          <div className="auth-oauth-row">
            <OAuthButton
              provider="google"
              label="Continua con Google"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              }
              onClick={() => handleOAuth('google')}
              loading={oauthLoading === 'google'}
            />
            <OAuthButton
              provider="github"
              label="Continua con GitHub"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              }
              onClick={() => handleOAuth('github')}
              loading={oauthLoading === 'github'}
            />
          </div>

          <div className="auth-divider"><span>oppure con email</span></div>

          {/* Email/password form */}
          <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="col" style={{ gap: 12 }}>
            <div className="field">
              <label className="field-label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="nome@email.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            {tab === 'register' && (
              <div className="field">
                <label className="field-label">Conferma password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && (
              <div className="auth-msg auth-msg-error">
                <span>⚠</span> {error}
              </div>
            )}
            {success && (
              <div className="auth-msg auth-msg-success">
                <span>✓</span> {success}
              </div>
            )}

            <button type="submit" className="btn" disabled={loading} style={{ marginTop: 4 }}>
              {loading
                ? 'Attendere...'
                : tab === 'login' ? 'Accedi' : 'Crea account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>
            {tab === 'login' ? 'Non hai un account? ' : 'Hai già un account? '}
            <button
              type="button"
              className="btn-text"
              style={{ fontSize: 12 }}
              onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); reset(); }}
            >
              {tab === 'login' ? 'Registrati' : 'Accedi'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
