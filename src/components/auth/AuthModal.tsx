import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        onClose();
      } else {
        await signUpWithEmail(email, password, displayName || email.split('@')[0]);
        setShowSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Redirect happens automatically - keep loading state since we're redirecting
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      setIsGoogleLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
    setShowSuccess(false);
  };

  const switchMode = (newMode: 'login' | 'signup') => {
    resetForm();
    setMode(newMode);
  };

  if (showSuccess) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-yugi-dark border border-yugi-border rounded-lg p-6 w-full max-w-md my-auto">
          <div className="text-center">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="text-xl font-bold text-white mb-2">Check Your Email</h2>
            <p className="text-gray-400 mb-4">
              We've sent a confirmation link to <span className="text-gold-400">{email}</span>.
              Please click the link to verify your account.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-yugi-dark border border-yugi-border rounded-lg p-6 w-full max-w-md my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold text-gold-400 mb-6">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-medium rounded-lg px-4 py-3 hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-wait transition-colors mb-4"
        >
          {isGoogleLoading ? (
            <>
              <span className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
              Redirecting to Google...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-yugi-border" />
          <span className="text-sm text-gray-500">or</span>
          <div className="flex-1 h-px bg-yugi-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-yugi-darker border border-yugi-border rounded-lg px-4 py-3 text-white focus:border-gold-500 focus:outline-none"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-yugi-darker border border-yugi-border rounded-lg px-4 py-3 text-white focus:border-gold-500 focus:outline-none"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-yugi-darker border border-yugi-border rounded-lg px-4 py-3 text-white focus:border-gold-500 focus:outline-none"
              placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'}
              required
              minLength={mode === 'signup' ? 6 : undefined}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-3 bg-gold-600 hover:bg-gold-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-medium rounded-lg transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-4">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => switchMode('signup')}
                className="text-gold-400 hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => switchMode('login')}
                className="text-gold-400 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>,
    document.body
  );
}

export default AuthModal;
