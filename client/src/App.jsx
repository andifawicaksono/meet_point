import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import useAuthStore, { api } from './store/authStore';
import Layout from './components/Layout';

// ── Code-split pages (loaded only when the route is first visited) ─────────
const Login     = lazy(() => import('./pages/Login'));
const Register  = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const RoomLobby = lazy(() => import('./pages/RoomLobby'));

// ── Shared loading fallback ────────────────────────────────────────────────
function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-9 h-9 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}

// ── 404 ───────────────────────────────────────────────────────────────────
function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-8xl font-black text-indigo-100">404</p>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">Halaman Tidak Ditemukan</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Halaman yang kamu cari tidak ada atau telah dipindahkan.
        </p>
      </div>
      <button
        onClick={() => navigate('/dashboard')}
        className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium
          rounded-xl transition"
      >
        Kembali ke Dashboard
      </button>
    </div>
  );
}

// ── Root redirect (/ → /dashboard if auth, else /login) ──────────────────
function RootRedirect() {
  const { isAuthenticated } = useAuthStore();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

// ── PrivateRoute — protects authenticated pages ────────────────────────────
function PrivateRoute() {
  const { isAuthenticated, refreshToken } = useAuthStore();
  const location = useLocation();

  // Silently try to restore session from HttpOnly refresh-token cookie on mount.
  // Fires once; errors are swallowed (user will be redirected to /login if needed).
  useEffect(() => {
    if (!isAuthenticated) {
      refreshToken().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

// ── PublicRoute — redirects authenticated users away from login/register ──
function PublicRoute() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

// ── JoinByCode — resolves invite code then navigates to the room ──────────
function JoinByCode() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) {
      navigate('/dashboard', { replace: true });
      return;
    }
    api
      .get(`/api/rooms/join/${code}`)
      .then(({ data }) => navigate(`/room/${data.room.id}`, { replace: true }))
      .catch(() => navigate('/dashboard', { replace: true }));
  }, [code, navigate]);

  return <PageSpinner />;
}

// ── App ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public — redirect to /dashboard when already authenticated */}
          <Route element={<PublicRoute />}>
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Protected — must be authenticated */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard"      element={<Dashboard />} />
              <Route path="/room/:roomId"   element={<RoomLobby />} />
              <Route path="/join/:code"     element={<JoinByCode />} />
            </Route>
          </Route>

          {/* 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
