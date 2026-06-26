import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useRoomStore from '../store/roomStore';

// ── Role badge ────────────────────────────────────────────────────────────
const ROLE_LABEL = {
  super_admin: { label: 'Super Admin', cls: 'bg-red-100 text-red-700' },
  room_owner:  { label: 'Room Owner',  cls: 'bg-purple-100 text-purple-700' },
  member:      { label: 'Member',      cls: 'bg-indigo-100 text-indigo-700' },
  guest:       { label: 'Tamu',        cls: 'bg-gray-100 text-gray-600' },
};

function RoleBadge({ role }) {
  const { label, cls } = ROLE_LABEL[role] ?? ROLE_LABEL.member;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return status === 'active' ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Aktif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Ditutup
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────
function Avatar({ user, size = 'md' }) {
  const sizeMap = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-14 h-14 text-xl' };
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} className={`${sizeMap[size]} rounded-full object-cover`} />;
  }
  const initials = (user?.name ?? '?').slice(0, 2).toUpperCase();
  return (
    <div className={`${sizeMap[size]} rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Room card ─────────────────────────────────────────────────────────────
function RoomCard({ room, onEnter }) {
  const created = new Date(room.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
          {room.name}
        </h3>
        <StatusBadge status={room.status} />
      </div>

      {room.description && (
        <p className="text-sm text-gray-500 line-clamp-2">{room.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5M12 12a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
          {room.participantCount} peserta
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {created}
        </span>
        {room.isLocked && (
          <span className="flex items-center gap-1 text-amber-500">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2a5 5 0 00-5 5v2H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-2V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v2H9V7a3 3 0 013-3zm0 9a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
            </svg>
            Terkunci
          </span>
        )}
      </div>

      <button
        onClick={() => onEnter(room)}
        disabled={room.status === 'closed'}
        className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40
          text-white text-sm font-semibold transition-colors"
      >
        Masuk
      </button>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────
function Spinner({ className = '' }) {
  return (
    <svg className={`animate-spin h-5 w-5 ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { rooms, isLoading, error, fetchMyRooms, createRoom, joinByCode, clearError } = useRoomStore();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Create-room form state
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [createErrors, setCreateErrors] = useState({});
  const [createLoading, setCreateLoading] = useState(false);

  // Join-room form state
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    fetchMyRooms();
  }, []);

  // ── Create room ─────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    const errors = {};
    if (!createForm.name.trim()) errors.name = 'Nama room wajib diisi';
    if (createForm.name.trim().length > 100) errors.name = 'Nama maksimal 100 karakter';
    if (Object.keys(errors).length) { setCreateErrors(errors); return; }

    setCreateLoading(true);
    try {
      const room = await createRoom(createForm.name, createForm.description);
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
      navigate(`/room/${room.id}`);
    } catch (err) {
      setCreateErrors({ server: err.response?.data?.error || 'Gagal membuat room' });
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Join by code ────────────────────────────────────────────────────────
  async function handleJoin(e) {
    e.preventDefault();
    if (!joinCode.trim()) { setJoinError('Kode undangan wajib diisi'); return; }

    setJoinLoading(true);
    try {
      const room = await joinByCode(joinCode.trim());
      setShowJoin(false);
      setJoinCode('');
      navigate(`/room/${room.id}`);
    } catch (err) {
      setJoinError(err.response?.data?.error || 'Kode tidak valid atau room terkunci');
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm select-none">M</span>
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">MeetPoint</span>
        </div>

        {/* User info */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Avatar user={user} size="md" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="mt-2.5">
            <RoleBadge role={user?.role} />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-medium text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </button>
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Keluar
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Header row */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Selamat datang, {user?.name?.split(' ')[0]} 👋
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">Kelola dan bergabung ke room kolaborasi</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => { clearError(); setShowJoin(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300
                  text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.101 1.102" />
                </svg>
                Gabung Room
              </button>

              <button
                onClick={() => { clearError(); setCreateForm({ name: '', description: '' }); setCreateErrors({}); setShowCreate(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700
                  text-white transition text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Buat Room
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
              {error}
              <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-4">✕</button>
            </div>
          )}

          {/* Room grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Spinner className="text-indigo-500 w-8 h-8" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">Belum ada room</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Buat room baru atau gunakan kode undangan untuk bergabung bersama tim kamu.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition"
              >
                Buat Room Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onEnter={(r) => navigate(`/room/${r.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Create Room Modal ── */}
      {showCreate && (
        <Modal title="Buat Room Baru" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {createErrors.server && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createErrors.server}</p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Room <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Sprint Planning Q4"
                value={createForm.name}
                onChange={(e) => { setCreateForm((p) => ({ ...p, name: e.target.value })); setCreateErrors((p) => ({ ...p, name: '' })); }}
                className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                  ${createErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {createErrors.name && <p className="mt-1 text-xs text-red-600">{createErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
              <textarea
                rows={3}
                placeholder="Opsional — jelaskan tujuan room ini"
                value={createForm.description}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm resize-none
                  focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
                Batal
              </button>
              <button type="submit" disabled={createLoading}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium transition flex items-center justify-center gap-2">
                {createLoading ? <><Spinner className="text-white" /> Membuat…</> : 'Buat Room'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Join Room Modal ── */}
      {showJoin && (
        <Modal title="Gabung Room" onClose={() => { setShowJoin(false); setJoinCode(''); setJoinError(''); }}>
          <form onSubmit={handleJoin} className="space-y-4">
            <p className="text-sm text-gray-500">Masukkan kode undangan 8 karakter yang diberikan oleh pemilik room.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kode Undangan</label>
              <input
                type="text"
                maxLength={8}
                placeholder="Contoh: ABC12345"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                className={`w-full px-4 py-2.5 rounded-lg border text-sm font-mono tracking-widest uppercase
                  focus:outline-none focus:ring-2 focus:ring-indigo-500
                  ${joinError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {joinError && <p className="mt-1 text-xs text-red-600">{joinError}</p>}
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError(''); }}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
                Batal
              </button>
              <button type="submit" disabled={joinLoading}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium transition flex items-center justify-center gap-2">
                {joinLoading ? <><Spinner className="text-white" /> Bergabung…</> : 'Gabung'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
