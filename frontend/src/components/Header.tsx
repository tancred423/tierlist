import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useI18n } from '../i18n';
import './Header.css';

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function Dropdown({ trigger, children, isOpen, onToggle, onClose }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="dropdown" ref={ref}>
      <button className="dropdown-trigger" onClick={onToggle}>
        {trigger}
      </button>
      {isOpen && <div className="dropdown-menu">{children}</div>}
    </div>
  );
}

export function Header() {
  const { user, login, logout } = useAuthStore();
  const { mode, setMode } = useThemeStore();
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const closeAll = () => {
    setLangOpen(false);
    setThemeOpen(false);
    setUserOpen(false);
  };

  const handleLogin = () => {
    const currentPath = location.pathname + location.search;
    localStorage.setItem('auth_redirect', currentPath);
    login();
  };

  const getAvatarUrl = () => {
    if (!user?.avatar || !user?.discordId) return null;
    return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`;
  };

  const getThemeIcon = () => {
    if (mode === 'light') return <SunIcon />;
    if (mode === 'dark') return <MoonIcon />;
    return <MonitorIcon />;
  };

  return (
    <header className="header">
      <div className="container header-content">
        <Link to="/" className="header-logo">
          <img src="/favicon.svg" alt="" className="logo-icon" />
          <span className="logo-text">Tierlist</span>
        </Link>

        <nav className="header-nav">
          <Dropdown
            trigger={
              <>
                <LanguageIcon />
                <span className="dropdown-label">{language.toUpperCase()}</span>
              </>
            }
            isOpen={langOpen}
            onToggle={() => {
              closeAll();
              setLangOpen(!langOpen);
            }}
            onClose={() => setLangOpen(false)}
          >
            <button
              className={`dropdown-item ${language === 'en' ? 'active' : ''}`}
              onClick={() => {
                setLanguage('en');
                setLangOpen(false);
              }}
            >
              {t('language.en')}
            </button>
            <button
              className={`dropdown-item ${language === 'de' ? 'active' : ''}`}
              onClick={() => {
                setLanguage('de');
                setLangOpen(false);
              }}
            >
              {t('language.de')}
            </button>
          </Dropdown>

          <Dropdown
            trigger={
              <>
                {getThemeIcon()}
                <span className="dropdown-label">{t(`theme.${mode}`)}</span>
              </>
            }
            isOpen={themeOpen}
            onToggle={() => {
              closeAll();
              setThemeOpen(!themeOpen);
            }}
            onClose={() => setThemeOpen(false)}
          >
            <button
              className={`dropdown-item ${mode === 'system' ? 'active' : ''}`}
              onClick={() => {
                setMode('system');
                setThemeOpen(false);
              }}
            >
              <MonitorIcon /> {t('theme.system')}
            </button>
            <button
              className={`dropdown-item ${mode === 'light' ? 'active' : ''}`}
              onClick={() => {
                setMode('light');
                setThemeOpen(false);
              }}
            >
              <SunIcon /> {t('theme.light')}
            </button>
            <button
              className={`dropdown-item ${mode === 'dark' ? 'active' : ''}`}
              onClick={() => {
                setMode('dark');
                setThemeOpen(false);
              }}
            >
              <MoonIcon /> {t('theme.dark')}
            </button>
          </Dropdown>

          {user ? (
            <Dropdown
              trigger={
                <>
                  {getAvatarUrl() ? (
                    <img src={getAvatarUrl()!} alt={user.username} className="avatar" />
                  ) : (
                    <div className="avatar avatar-placeholder">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  <span className="user-name">{user.username}</span>
                  <svg
                    className={`chevron ${userOpen ? 'open' : ''}`}
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                  >
                    <path
                      d="M2.5 4.5L6 8L9.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </>
              }
              isOpen={userOpen}
              onToggle={() => {
                closeAll();
                setUserOpen(!userOpen);
              }}
              onClose={() => setUserOpen(false)}
            >
              <Link to="/account" onClick={() => setUserOpen(false)} className="dropdown-item">
                {t('account.title')}
              </Link>
              <button
                onClick={() => {
                  logout();
                  setUserOpen(false);
                  navigate('/');
                }}
                className="dropdown-item"
              >
                {t('common.logout')}
              </button>
            </Dropdown>
          ) : (
            location.pathname !== '/login' && (
              <button onClick={handleLogin} className="btn btn-discord">
                <DiscordIcon />
                {t('auth.loginWithDiscord')}
              </button>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
