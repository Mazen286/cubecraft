import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { UserMenu } from '../auth/UserMenu';

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
  return (
    <header className="sticky top-0 z-50 glass-card border-t-0 border-x-0 rounded-none">
      <div className="container mx-auto px-4 py-4 max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1700px]">
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/25 group-hover:shadow-gold-500/40 transition-shadow">
              <span className="text-xl font-bold text-yugi-darker">CC</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gold-gradient">
                CubeCraft
              </h1>
              <p className="text-xs text-gray-300">Draft. Build. Play.</p>
            </div>
          </a>

          <nav className="flex items-center gap-4">
            <a
              href="/"
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
            >
              Home
            </a>
            <a
              href="/about"
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
            >
              About
            </a>
            <div className="w-px h-5 bg-yugi-border" />
            <UserMenu />
          </nav>
        </div>
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
            CubeCraft
          </p>
          <p>
            A multi-game cube drafting platform for TCG enthusiasts.
          </p>
        </div>
      </div>
    </footer>
  );
}
