import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <div className={cn('min-h-screen flex flex-col', className)}>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 glass-card border-t-0 border-x-0 rounded-none">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/25 group-hover:shadow-gold-500/40 transition-shadow">
              <span className="text-xl font-bold text-yugi-darker">YC</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gold-gradient">
                Yu-Gi-Oh! Cube Draft
              </h1>
              <p className="text-xs text-gray-400">Draft. Build. Duel.</p>
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
          </nav>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-yugi-border mt-auto">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <p>
            Yu-Gi-Oh! Cube Draft Simulator
          </p>
          <p>
            Not affiliated with Konami. Yu-Gi-Oh! is a trademark of Konami.
          </p>
        </div>
      </div>
    </footer>
  );
}
