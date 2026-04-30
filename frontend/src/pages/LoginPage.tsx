import { useRef, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Mouse-following glow
  const glowRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!glowRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    glowRef.current.style.left = `${e.clientX - rect.left}px`;
    glowRef.current.style.top = `${e.clientY - rect.top}px`;
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const fields: Record<string, string> = {};
    if (!email.trim()) fields.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fields.email = 'Must be a valid email address.';
    if (!password) fields.password = 'Password is required.';
    if (Object.keys(fields).length > 0) {
      setFieldErrors(fields);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      setError('');
      setAuth(res.user, res.access_token, res.refresh_token);
      navigate('/projects', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password. Please try again.');
      } else if (err instanceof ApiError) {
        setError('Something went wrong. Please try again.');
      } else {
        setError('Unable to connect. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">

      {/* ── Left hero panel ── */}
      <div className="auth-hero" onMouseMove={handleMouseMove}>
        <div className="auth-glow" ref={glowRef} />
        <div className="auth-hero-inner">
          <span className="auth-hero-name">Taskly</span>

          <h2 className="auth-hero-headline">
            The workspace for modern teams.
          </h2>

          <p className="auth-hero-sub">
            Simplify your projects, manage your tasks, and achieve your
            goals with a minimal and focused interface.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-card">

          <div className="auth-form-header">
            <h1 className="auth-form-title">Welcome back</h1>
            <p className="auth-form-sub">Please sign in to your account</p>
          </div>

          {error && (
            <div role="alert" className="auth-alert" style={{ marginBottom: '1.5rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            <div data-field={fieldErrors.email ? 'error' : undefined}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setFieldErrors(f => ({ ...f, email: '' })); }}
                placeholder="you@example.com"
                required
                maxLength={254}
                autoComplete="email"
                autoFocus
              />
              {fieldErrors.email && <p className="error">{fieldErrors.email}</p>}
            </div>

            <div data-field={fieldErrors.password ? 'error' : undefined}>
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setFieldErrors(f => ({ ...f, password: '' })); }}
                  placeholder="••••••••"
                  required
                  maxLength={72}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && <p className="error">{fieldErrors.password}</p>}
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="auth-divider">
            <span>New here?</span>
          </div>

          <Link to="/register" className="auth-switch-btn">
            Create an account
          </Link>
        </div>
      </div>

    </div>
  );
}
