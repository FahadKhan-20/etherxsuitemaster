// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimationProvider } from './context/AnimationContext';
import { MeetingProvider } from './context/MeetingContext';
import { UserProvider } from './context/UserContext';
import { UIProvider } from './context/UIContext';
import { WalletProvider } from './context/WalletContext';
import VideoBackground from './components/effects/VideoBackground';
import { lazy, Suspense, useCallback, useState } from 'react';
import SplashScreen from './components/effects/SplashScreen';
import CommandPalette from './components/layout/CommandPalette';
import ToastSystem from './components/layout/ToastSystem';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ROUTES } from './utils/constants';

// Each page loads on first visit, so the meeting room's media code and the charts are not in the first download.
const Landing = lazy(() => import('./pages/Landing'));
const Join = lazy(() => import('./pages/Join'));
const Room = lazy(() => import('./pages/Room'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Recordings = lazy(() => import('./pages/Recordings'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

const PageLoading = () => <div role="status" aria-label="Loading" style={{ minHeight: '100dvh', background: 'var(--c-000000)' }} />;

/** Inner component so useLocation can be called inside BrowserRouter. */
function AppRoutes() {
  const location = useLocation();
  return (
    <>

      <CommandPalette />
      <ToastSystem />

      <Suspense fallback={<PageLoading />}>
      <Routes location={location}>
        <Route path={ROUTES.LOGIN}           element={<AuthPage mode="signin" />} />
        <Route path={ROUTES.REGISTER}        element={<AuthPage mode="signup" />} />
        <Route path={ROUTES.TERMS}           element={<LegalPage page="terms" />} />
        <Route path={ROUTES.PRIVACY}         element={<LegalPage page="privacy" />} />
        <Route path={ROUTES.AUTH_CALLBACK}   element={<AuthCallback />} />
        <Route path={ROUTES.RESET_PASSWORD}  element={<ResetPassword />} />
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.HOME}        element={<Landing />} />
          <Route path={ROUTES.JOIN}        element={<Join />} />
          <Route path={ROUTES.ROOM}        element={<Room />} />
          <Route path={ROUTES.DASHBOARD}   element={<Dashboard />} />
          <Route path={ROUTES.RECORDINGS}  element={<Recordings />} />
          <Route path={ROUTES.ANALYTICS}   element={<Analytics />} />
          <Route path={ROUTES.SETTINGS}    element={<Settings />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}

// The intro plays once per browser session, never in front of a meeting link, an auth redirect or a policy page.
const SPLASH_KEY = 'etherx_seen_splash';
function shouldShowSplash() {
  try { if (sessionStorage.getItem(SPLASH_KEY)) return false; } catch { /* storage blocked: still show once */ }
  return !/^\/(auth\/callback|reset-password|room\/|join|terms|privacy)/.test(window.location.pathname);
}

function App() {
  const [splash, setSplash] = useState(shouldShowSplash);
  const finishSplash = useCallback(() => {
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* ignore */ }
    setSplash(false);
  }, []);
  return (
    <>
    {splash && <SplashScreen onDone={finishSplash} />}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <VideoBackground />
      <WalletProvider>
        <AnimationProvider>
          <UserProvider>
            <UIProvider>
              <MeetingProvider>
                <AppRoutes />
              </MeetingProvider>
            </UIProvider>
          </UserProvider>
        </AnimationProvider>
      </WalletProvider>
    </BrowserRouter>
    </>
  );
}

export default App;
