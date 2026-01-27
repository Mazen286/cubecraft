import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { UserMenu } from '../auth/UserMenu';
import { Box, Play, Menu, X } from 'lucide-react';
import { draftService } from '../../services/draftService';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <div className={cn('min-h-screen flex flex-col', className)}>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1700px]">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const location = useLocation();
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    roomCode: string;
    status: 'waiting' | 'in_progress';
    mode: string;
  } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check for active session on mount and route changes
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const session = await draftService.getActiveSession();
        setActiveSession(session);
      } catch {
        setActiveSession(null);
      }
    };

    checkActiveSession();
  }, [location.pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Determine if we're already on the draft page
  const isOnDraftPage =
    location.pathname.startsWith('/draft/') ||
    location.pathname.startsWith('/lobby/') ||
    location.pathname.startsWith('/auction/');

  // Build the rejoin URL based on session status and mode
  const getRejoinUrl = () => {
    if (!activeSession) return '/';
    if (activeSession.status === 'waiting') {
      return `/lobby/${activeSession.roomCode}`;
    }
    // in_progress
    if (activeSession.mode === 'auction') {
      return `/auction/${activeSession.roomCode}`;
    }
    return `/draft/${activeSession.roomCode}`;
  };

  const showRejoinButton = activeSession && !isOnDraftPage;

  return (
    <header className="sticky top-0 z-50 glass-card border-t-0 border-x-0 rounded-none">
      <div className="container mx-auto px-4 py-4 max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1700px]">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/25 group-hover:shadow-gold-500/40 transition-shadow">
              <Box className="w-6 h-6 text-yugi-darker" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gold-gradient">
                CubeCraft
              </h1>
              <p className="text-xs text-gray-300">Draft. Build. Play.</p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            {showRejoinButton && (
              <>
                <Link
                  to={getRejoinUrl()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500/20 border border-gold-500/40 text-gold-400 hover:bg-gold-500/30 hover:text-gold-300 transition-all text-sm font-medium"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Rejoin Draft</span>
                </Link>
                <div className="w-px h-5 bg-yugi-border hidden sm:block" />
              </>
            )}
            {/* Desktop nav links */}
            <Link
              to="/"
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors hidden sm:block"
            >
              Home
            </Link>
            <Link
              to="/rules"
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors hidden sm:block"
            >
              Rules
            </Link>
            <Link
              to="/about"
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors hidden sm:block"
            >
              About
            </Link>
            <div className="w-px h-5 bg-yugi-border hidden sm:block" />
            <UserMenu />
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 text-gray-300 hover:text-gold-400 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </nav>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <nav className="sm:hidden mt-4 pt-4 border-t border-yugi-border flex flex-col gap-3">
            <Link
              to="/"
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors py-1"
            >
              Home
            </Link>
            <Link
              to="/rules"
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors py-1"
            >
              Rules
            </Link>
            <Link
              to="/about"
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors py-1"
            >
              About
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-yugi-border mt-auto">
      <div className="container mx-auto px-4 py-6 max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1700px]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-300">
          <p>
            CubeCraft — Built by{' '}
            <a
              href="https://figmentanalytics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-400 hover:text-gold-300 transition-colors"
            >
              Figment Analytics
            </a>
          </p>
          <p>
            A multi-game cube drafting platform for TCG enthusiasts.
          </p>
        </div>
      </div>
    </footer>
  );
}
