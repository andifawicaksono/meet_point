import { useEffect, useState } from 'react';
import { api } from '../store/authStore';
import socket from '../socket';
import useStickyStore from '../store/stickyStore';
import StickyNoteCard from './StickyNoteCard';

const TYPE_OPTIONS = [
  { type: 'idea',        label: 'Ide',      emoji: '💡', color: '#FCD34D' },
  { type: 'problem',     label: 'Masalah',   emoji: '⚠️', color: '#F87171' },
  { type: 'solution',    label: 'Solusi',    emoji: '✅', color: '#6EE7B7' },
  { type: 'action_item', label: 'Aksi',      emoji: '🎯', color: '#93C5FD' },
];

export default function StickyNoteBoard({ roomId, currentUser }) {
  const {
    notes,
    setNotes,
    addNote,
    updateNote,
    moveNote,
    removeNote,
    updateVoteStats,
  } = useStickyStore();

  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [creating, setCreating] = useState(false);

  // Load notes from REST on mount
  useEffect(() => {
    api
      .get(`/api/rooms/${roomId}/notes`)
      .then((res) => setNotes(res.data.notes ?? []))
      .catch(() => {});
  }, [roomId, setNotes]);

  // Socket listeners for realtime sync
  useEffect(() => {
    const onNoteCreated = ({ note }) => addNote(note);
    const onNoteUpdated = ({ note }) => updateNote(note);
    const onNoteMoved = ({ id, position_x, position_y }) => moveNote(id, position_x, position_y);
    const onNoteDeleted = ({ id }) => removeNote(id);
    const onVoteUpdated = ({ noteId, averageStars, totalVotes }) =>
      updateVoteStats(noteId, averageStars, totalVotes);

    socket.on('noteCreated',  onNoteCreated);
    socket.on('noteUpdated',  onNoteUpdated);
    socket.on('noteMoved',    onNoteMoved);
    socket.on('noteDeleted',  onNoteDeleted);
    socket.on('voteUpdated',  onVoteUpdated);

    return () => {
      socket.off('noteCreated',  onNoteCreated);
      socket.off('noteUpdated',  onNoteUpdated);
      socket.off('noteMoved',    onNoteMoved);
      socket.off('noteDeleted',  onNoteDeleted);
      socket.off('voteUpdated',  onVoteUpdated);
    };
  }, [addNote, updateNote, moveNote, removeNote, updateVoteStats]);

  const handleCreate = async (type) => {
    if (creating) return;
    setCreating(true);
    setShowTypeSelector(false);
    try {
      await api.post(`/api/rooms/${roomId}/notes`, {
        type,
        title: 'Catatan Baru',
        content: '',
        position_x: 80 + Math.floor(Math.random() * 280),
        position_y: 80 + Math.floor(Math.random() * 200),
      });
      // noteCreated socket event will add it to the store
    } catch {
      // creation failed
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {/* Render all sticky notes */}
      {notes.map((note) => (
        <div key={note.id} className="pointer-events-auto">
          <StickyNoteCard
            note={note}
            roomId={roomId}
            currentUser={currentUser}
          />
        </div>
      ))}

      {/* Create button — top-right of the whiteboard */}
      <div className="absolute top-3 right-3 pointer-events-auto">
        {showTypeSelector && (
          <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-44 z-50">
            {TYPE_OPTIONS.map(({ type, label, emoji }) => (
              <button
                key={type}
                onClick={() => handleCreate(type)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
              >
                <span className="text-base">{emoji}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowTypeSelector((v) => !v)}
          disabled={creating}
          title="Tambah catatan"
          className="w-9 h-9 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-full
            shadow-md flex items-center justify-center transition disabled:opacity-50"
        >
          {creating ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
