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
const AuctionDraft = lazy(() => import('./pages/AuctionDraft').then(m => ({ default: m.AuctionDraft })));
const Results = lazy(() => import('./pages/Results').then(m => ({ default: m.Results })));
const JoinRoom = lazy(() => import('./pages/JoinRoom').then(m => ({ default: m.JoinRoom })));
const About = lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const Rulebook = lazy(() => import('./pages/Rulebook').then(m => ({ default: m.Rulebook })));

// Auth-related pages
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const MyCubes = lazy(() => import('./pages/MyCubes').then(m => ({ default: m.MyCubes })));
const CubeBuilder = lazy(() => import('./pages/CubeBuilder').then(m => ({ default: m.CubeBuilder })));
const MyDecks = lazy(() => import('./pages/MyDecks').then(m => ({ default: m.MyDecks })));
const DeckBuilder = lazy(() => import('./pages/DeckBuilder').then(m => ({ default: m.DeckBuilder })));
const DraftHistory = lazy(() => import('./pages/DraftHistory').then(m => ({ default: m.DraftHistory })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const AuthCallback = lazy(() => import('./pages/AuthCallback').then(m => ({ default: m.AuthCallback })));

// Arkham Horror LCG pages
const ArkhamDeckBuilder = lazy(() => import('./pages/ArkhamDeckBuilder').then(m => ({ default: m.ArkhamDeckBuilder })));
const PublicArkhamDeck = lazy(() => import('./pages/PublicArkhamDeck').then(m => ({ default: m.PublicArkhamDeck })));
const ArkhamDBCallback = lazy(() => import('./pages/ArkhamDBCallback').then(m => ({ default: m.ArkhamDBCallback })));

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen bg-cc-dark flex items-center justify-center">
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
                <Route path="/auction/:sessionId" element={<AuctionDraft />} />
                <Route path="/results" element={<Results />} />
                <Route path="/results/:sessionId" element={<Results />} />
                <Route path="/about" element={<About />} />
                <Route path="/rules" element={<Rulebook />} />

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
                <Route path="/cube-builder" element={
                  <ProtectedRoute>
                    <CubeBuilder />
                  </ProtectedRoute>
                } />
                <Route path="/cube-builder/:cubeId" element={
                  <ProtectedRoute>
                    <CubeBuilder />
                  </ProtectedRoute>
                } />
                <Route path="/my-decks" element={
                  <ProtectedRoute>
                    <MyDecks />
                  </ProtectedRoute>
                } />
                <Route path="/deck-builder" element={
                  <ProtectedRoute>
                    <DeckBuilder />
                  </ProtectedRoute>
                } />
                <Route path="/deck-builder/:deckId" element={
                  <ProtectedRoute>
                    <DeckBuilder />
                  </ProtectedRoute>
                } />
                <Route path="/drafts" element={
                  <ProtectedRoute>
                    <DraftHistory />
                  </ProtectedRoute>
                } />

                {/* Admin route - requires admin role */}
                <Route path="/admin" element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                } />

                {/* Arkham Horror LCG routes */}
                <Route path="/arkham/deck/:deckId" element={<PublicArkhamDeck />} />
                <Route path="/arkham/deck-builder" element={
                  <ProtectedRoute>
                    <ArkhamDeckBuilder />
                  </ProtectedRoute>
                } />
                <Route path="/arkham/deck-builder/:deckId" element={
                  <ProtectedRoute>
                    <ArkhamDeckBuilder />
                  </ProtectedRoute>
                } />

                {/* ArkhamDB OAuth callback */}
                <Route path="/auth/arkhamdb/callback" element={
                  <ProtectedRoute>
                    <ArkhamDBCallback />
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
