import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { cubeService } from './services/cubeService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameProvider } from './context/GameContext';
import { AuthProvider } from './context/AuthContext';
import { MigrationPrompt } from './components/auth/MigrationPrompt';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Lazy load all pages for better initial load performance
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const DraftSetup = lazy(() => import('./pages/DraftSetup').then(m => ({ default: m.DraftSetup })));
const Lobby = lazy(() => import('./pages/Lobby').then(m => ({ default: m.Lobby })));
const Draft = lazy(() => import('./pages/Draft').then(m => ({ default: m.Draft })));
const Results = lazy(() => import('./pages/Results').then(m => ({ default: m.Results })));
const JoinRoom = lazy(() => import('./pages/JoinRoom').then(m => ({ default: m.JoinRoom })));
const About = lazy(() => import('./pages/About').then(m => ({ default: m.About })));

// Auth-related pages
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const MyCubes = lazy(() => import('./pages/MyCubes').then(m => ({ default: m.MyCubes })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const AuthCallback = lazy(() => import('./pages/AuthCallback').then(m => ({ default: m.AuthCallback })));

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen bg-yugi-dark flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-300">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  // Preload default cube data on app start for faster draft setup
  useEffect(() => {
    cubeService.preloadCube('the-library').catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <GameProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Home />} />
                <Route path="/setup" element={<DraftSetup />} />
                <Route path="/join" element={<JoinRoom />} />
                <Route path="/lobby/:sessionId" element={<Lobby />} />
                <Route path="/draft/:sessionId" element={<Draft />} />
                <Route path="/draft" element={<Draft />} />
                <Route path="/results" element={<Results />} />
                <Route path="/results/:sessionId" element={<Results />} />
                <Route path="/about" element={<About />} />

                {/* Auth callback */}
                <Route path="/auth/callback" element={<AuthCallback />} />

                {/* Protected routes - require authentication */}
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/my-cubes" element={
                  <ProtectedRoute>
                    <MyCubes />
                  </ProtectedRoute>
                } />

                {/* Admin route - requires admin role */}
                <Route path="/admin" element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                } />
              </Routes>
            </Suspense>

            {/* Global components */}
            <MigrationPrompt />
          </BrowserRouter>
        </AuthProvider>
      </GameProvider>
    </ErrorBoundary>
  );
}

export default App;
