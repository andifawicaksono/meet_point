import { useState, useRef } from 'react';
import { api } from '../store/authStore';
import socket from '../socket';
import useStickyStore from '../store/stickyStore';

const TYPE_CONFIG = {
  idea: {
    label: 'Ide',
    bg: '#FEFCE8',
    border: '#FCD34D',
    badge: '#F59E0B',
    badgeText: '#fff',
  },
  problem: {
    label: 'Masalah',
    bg: '#FFF1F2',
    border: '#F87171',
    badge: '#EF4444',
    badgeText: '#fff',
  },
  solution: {
    label: 'Solusi',
    bg: '#F0FDF4',
    border: '#6EE7B7',
    badge: '#10B981',
    badgeText: '#fff',
  },
  action_item: {
    label: 'Aksi',
    bg: '#EFF6FF',
    border: '#93C5FD',
    badge: '#3B82F6',
    badgeText: '#fff',
  },
};

export default function StickyNoteCard({ note, roomId, currentUser }) {
  const { updateNote, moveNote, removeNote } = useStickyStore();

  const [localPos, setLocalPos] = useState(null); // non-null while dragging
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title ?? '');
  const [editContent, setEditContent] = useState(note.content ?? '');
  const [isHovered, setIsHovered] = useState(false);

  const cfg = TYPE_CONFIG[note.type] ?? TYPE_CONFIG.idea;
  const posX = localPos?.x ?? note.position_x;
  const posY = localPos?.y ?? note.position_y;
  const isAuthor = currentUser?.id === (note.authorId ?? note.author?.id);

  // ── Dragging ──────────────────────────────────────────────────────────────

  const handleMouseDown = (e) => {
    if (isEditing || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = posX;
    const startPosY = posY;

    const onMove = (ev) => {
      setLocalPos({
        x: startPosX + ev.clientX - startMouseX,
        y: startPosY + ev.clientY - startMouseY,
      });
    };

    const onUp = (ev) => {
      const newX = startPosX + ev.clientX - startMouseX;
      const newY = startPosY + ev.clientY - startMouseY;

      setLocalPos(null);
      moveNote(note.id, newX, newY); // optimistic local update

      socket.emit('moveNote', {
        roomId,
        id: note.id,
        position_x: newX,
        position_y: newY,
      });

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Editing ───────────────────────────────────────────────────────────────

  const handleDoubleClick = () => {
    if (!isAuthor) return;
    setEditTitle(note.title ?? '');
    setEditContent(note.content ?? '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const { data } = await api.patch(`/api/rooms/${roomId}/notes/${note.id}`, {
        title: editTitle,
        content: editContent,
      });
      updateNote(data.note);
    } catch {
      // server validation failed — revert
      setEditTitle(note.title ?? '');
      setEditContent(note.content ?? '');
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(note.title ?? '');
    setEditContent(note.content ?? '');
  };

  // ── Deleting ──────────────────────────────────────────────────────────────

  const handleDelete = async (e) => {
    e.stopPropagation();
    removeNote(note.id); // optimistic — noteDeleted socket event confirms
    try {
      await api.delete(`/api/rooms/${roomId}/notes/${note.id}`);
    } catch {
      // nothing — server will broadcast the state
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="absolute select-none"
      style={{
        left: posX,
        top: posY,
        width: 220,
        zIndex: isEditing ? 100 : isHovered ? 20 : 10,
        cursor: isEditing ? 'default' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="rounded-xl shadow-md overflow-hidden"
        style={{ backgroundColor: cfg.bg, border: `2px solid ${cfg.border}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.badge, color: cfg.badgeText }}
          >
            {cfg.label}
          </span>

          {isHovered && isAuthor && !isEditing && (
            <button
              onClick={handleDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-3 pb-3">
          {isEditing ? (
            <>
              <input
                className="w-full bg-transparent border-b border-gray-300 text-sm font-semibold text-gray-800 mb-2
                  focus:outline-none focus:border-indigo-400"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                autoFocus
                placeholder="Judul..."
              />
              <textarea
                className="w-full bg-transparent text-xs text-gray-700 resize-none focus:outline-none leading-relaxed"
                rows={3}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Isi catatan..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSave}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-xs px-2 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded transition"
                >
                  Simpan
                </button>
                <button
                  onClick={handleCancelEdit}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-xs px-2 py-0.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded transition"
                >
                  Batal
                </button>
              </div>
            </>
          ) : (
            <>
              {note.title && (
                <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2 mb-1">
                  {note.title}
                </p>
              )}
              {note.content && (
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">
                  {note.content}
                </p>
              )}
              {isAuthor && !note.title && !note.content && (
                <p className="text-xs text-gray-400 italic">Klik dua kali untuk edit…</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isEditing && (
          <div
            className="flex items-center justify-between px-3 pb-2 pt-1"
            style={{ borderTop: `1px solid ${cfg.border}80` }}
          >
            <span className="text-xs text-gray-400 truncate max-w-[110px]">
              {note.author?.name ?? '—'}
            </span>
            <div className="flex items-center gap-1 text-xs text-amber-500 flex-shrink-0">
              <span>⭐</span>
              <span>{parseFloat(note.averageStars ?? 0).toFixed(1)}</span>
              <span className="text-gray-300 ml-0.5">
                ({note.totalVotes ?? note.vote_count ?? 0})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
