import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProfileDialog({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  return (
    <dialog ref={dialogRef} onCancel={handleClose} style={{ minHeight: 0 }}>
      <header>
        <h2>Profile</h2>
        <p>Your account details</p>
      </header>

      <div>
        <div className="profile-avatar">{user?.name?.charAt(0)?.toUpperCase() ?? '?'}</div>
        <span className={`role-badge role-badge--${user?.role?.toLowerCase() || 'member'}`}>{user?.role || 'Member'}</span>

        <dl className="profile-list">
          <div className="profile-row">
            <dt>Name</dt>
            <dd>{user?.name}</dd>
          </div>
          <div className="profile-row">
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div className="profile-row">
            <dt>Role</dt>
            <dd>{user?.role || 'Member'}</dd>
          </div>
          <div className="profile-row">
            <dt>Member since</dt>
            <dd>{user?.created_at ? formatDate(user.created_at) : '-'}</dd>
          </div>
          <div className="profile-row">
            <dt>User ID</dt>
            <dd className="profile-id">{user?.id}</dd>
          </div>
        </dl>
      </div>

      <footer>
        <button type="button" data-variant="danger" className="outline" onClick={onLogout}>
          Logout
        </button>
        <button type="button" onClick={handleClose}>
          Close
        </button>
      </footer>
    </dialog>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  
  // Initialize theme from localStorage or default to dark
  const [isLight, setIsLight] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light';
  });

  useEffect(() => {
    const theme = isLight ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [isLight]);

  async function handleLogout() {
    setShowProfile(false);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          <Link to="/projects" className="navbar-brand">
            <svg className="navbar-logo" width="20" height="20" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--primary)"/>
              <path d="M9 10h14M16 10v14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Taskly
          </Link>

          <div className="navbar-end">
            <label className="theme-switch" title="Toggle Theme">
              <input 
                type="checkbox" 
                checked={isLight} 
                onChange={() => setIsLight(!isLight)} 
              />
              <span className="theme-slider">
                <div className="theme-slider-icons">
                  <span>🌙</span>
                  <span>☀️</span>
                </div>
              </span>
            </label>

            {user && (
              <button
                className="navbar-profile-btn"
                onClick={() => setShowProfile(true)}
                aria-label="Open profile settings"
                title={user.name}
              >
                <span className="navbar-avatar">{user.name?.charAt(0)?.toUpperCase() ?? '?'}</span>
                <span className="navbar-user">{user.name ?? user.email}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {showProfile && (
        <ProfileDialog
          onClose={() => setShowProfile(false)}
          onLogout={() => void handleLogout()}
        />
      )}
    </>
  );
}
