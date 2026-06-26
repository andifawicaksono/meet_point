import { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useRoomStore from '../store/roomStore';
import useBoardStore from '../store/boardStore';
import socket, { connect, disconnect } from '../socket';
import Whiteboard from '../components/Whiteboard';
import CursorOverlay from '../components/CursorOverlay';
import StickyNoteBoard from '../components/StickyNoteBoard';
import ChatPanel from '../components/ChatPanel';
import VotingPanel from '../components/VotingPanel';

// ── Helpers ───────────────────────────────────────────────────────────────

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy'); // NOSONAR — intentional fallback
  el.remove();
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Avatar({ participant, size = 'sm' }) {
  const sizeMap = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm' };
  const inits = (participant.name ?? '?').slice(0, 2).toUpperCase();
  if (participant.avatarUrl) {
    return (
      <img
        src={participant.avatarUrl}
        alt={participant.name}
        className={`${sizeMap[size]} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sizeMap[size]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
      style={{ backgroundColor: participant.cursorColor || '#6366f1' }}
    >
      {inits}
    </div>
  );
}

function ParticipantRow({ participant }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-gray-50 transition">
      <div className="relative">
        <Avatar participant={participant} size="sm" />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
            participant.isOnline ? 'bg-green-500' : 'bg-gray-300'
          }`}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-800 font-medium truncate">{participant.name}</p>
        <p className="text-xs text-gray-400 capitalize">{participant.role}</p>
      </div>
    </div>
  );
}

function CopyButton({ text, label }) {
  return (
    <button
      onClick={() => copyToClipboard(text)}
      title="Salin ke clipboard"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-indigo-50
        hover:text-indigo-700 text-gray-600 text-xs font-mono tracking-widest transition"
    >
      {label}
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function RoomLobby() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const { user, accessToken } = useAuthStore();
  const {
    currentRoom,
    participants,
    isLoading,
    fetchRoom,
    leaveRoom,
    setCurrentRoom,
    updateParticipants,
    addParticipant,
    removeParticipantFromState,
  } = useRoomStore();

  const { setSnapshot } = useBoardStore();

  const hasJoined = useRef(false);

  // ── Stable socket handlers ─────────────────────────────────────────────

  const onParticipantJoined = useCallback(
    ({ user: joinedUser, participants: updatedList }) => {
      if (updatedList) {
        updateParticipants(updatedList);
      } else if (joinedUser) {
        addParticipant(joinedUser);
      }
    },
    [addParticipant, updateParticipants],
  );

  const onParticipantLeft = useCallback(
    ({ userId, participants: updatedList }) => {
      if (updatedList) {
        updateParticipants(updatedList);
      } else {
        removeParticipantFromState(userId);
      }
    },
    [removeParticipantFromState, updateParticipants],
  );

  const onParticipantRemoved = useCallback(
    ({ userId: removedId }) => {
      if (removedId === user?.id) {
        navigate('/dashboard', { replace: true });
      } else {
        removeParticipantFromState(removedId);
      }
    },
    [user?.id, navigate, removeParticipantFromState],
  );

  const onRoomData = useCallback(
    ({ room, participants: parts, boardSnapshot, boardVersion }) => {
      if (room) setCurrentRoom(room);
      if (parts) updateParticipants(parts);
      if (boardSnapshot != null) setSnapshot(boardSnapshot, boardVersion ?? 0);
    },
    [setCurrentRoom, updateParticipants, setSnapshot],
  );

  const onRoomClosed = useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  // ── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) return;

    fetchRoom(roomId).catch(() => navigate('/dashboard', { replace: true }));

    connect(accessToken);

    const handleConnect = () => {
      if (hasJoined.current) return;
      hasJoined.current = true;
      socket.emit('joinRoom', { roomId });
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.once('connect', handleConnect);
    }

    socket.on('participantJoined',  onParticipantJoined);
    socket.on('participantLeft',    onParticipantLeft);
    socket.on('participantRemoved', onParticipantRemoved);
    socket.on('roomData',           onRoomData);
    socket.on('roomClosed',         onRoomClosed);

    return () => {
      socket.emit('leaveRoom', { roomId });
      socket.off('connect',           handleConnect);
      socket.off('participantJoined', onParticipantJoined);
      socket.off('participantLeft',   onParticipantLeft);
      socket.off('participantRemoved',onParticipantRemoved);
      socket.off('roomData',          onRoomData);
      socket.off('roomClosed',        onRoomClosed);
      hasJoined.current = false;
      disconnect();
      leaveRoom(roomId);
    };
  }, [roomId, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ──────────────────────────────────────────────────────

  const myParticipant = participants.find((p) => p.id === user?.id);
  const onlineParticipants = participants.filter((p) => p.isOnline);
  const offlineParticipants = participants.filter((p) => !p.isOnline);
  const isClosed = currentRoom?.status === 'closed';

  // ── Render ─────────────────────────────────────────────────────────────

  if (isLoading && !currentRoom) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-400">Memuat room…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* ══ LEFT SIDEBAR — Room info + participants ══ */}
      <aside className="w-[280px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

        {/* Room header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-gray-600 transition"
              title="Kembali ke dashboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {isClosed && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  Ditutup
                </span>
              )}
              {currentRoom?.isLocked && (
                <span className="text-xs text-amber-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2a5 5 0 00-5 5v2H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-2V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v2H9V7a3 3 0 013-3z" />
                  </svg>
                  Terkunci
                </span>
              )}
            </div>
          </div>

          <h2 className="text-base font-bold text-gray-900 leading-tight line-clamp-2 mt-1">
            {currentRoom?.name ?? '—'}
          </h2>

          {currentRoom?.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{currentRoom.description}</p>
          )}

          {currentRoom?.inviteCode && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-1">Kode Undangan</p>
              <CopyButton text={currentRoom.inviteCode} label={currentRoom.inviteCode} />
            </div>
          )}
        </div>

        {/* Participants list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Peserta Online
              </h3>
              <span className="text-xs bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded-full">
                {onlineParticipants.length}
              </span>
            </div>

            {onlineParticipants.length === 0 ? (
              <p className="text-xs text-gray-400 pl-1">Belum ada peserta online</p>
            ) : (
              <div className="space-y-0.5">
                {onlineParticipants.map((p) => (
                  <ParticipantRow key={p.id} participant={p} />
                ))}
              </div>
            )}
          </div>

          {offlineParticipants.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Offline
                </h3>
                <span className="text-xs bg-gray-100 text-gray-500 font-medium px-1.5 py-0.5 rounded-full">
                  {offlineParticipants.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {offlineParticipants.map((p) => (
                  <ParticipantRow key={p.id} participant={p} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            {participants.length} / {currentRoom?.maxParticipants ?? '—'} peserta
          </p>
        </div>
      </aside>

      {/* ══ CENTER — Whiteboard + overlays ══ */}
      <div
        id="whiteboard-area"
        className="relative flex-1 overflow-hidden bg-white"
      >
        {/* tldraw canvas (base layer) */}
        <Whiteboard
          roomId={roomId}
          currentUser={myParticipant}
          readOnly={isClosed}
        />

        {/* Sticky notes (z-40, above canvas, below cursors) */}
        {!isClosed && (
          <StickyNoteBoard roomId={roomId} currentUser={myParticipant} />
        )}

        {/* Remote cursor overlay (z-50, topmost) */}
        <CursorOverlay roomId={roomId} />

        {/* Voting floating panel (z-[60] handled internally) */}
        <VotingPanel roomId={roomId} />
      </div>

      {/* ══ RIGHT — Chat panel ══ */}
      <ChatPanel roomId={roomId} currentUser={myParticipant} />

    </div>
  );
}
