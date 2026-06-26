import { useState } from 'react';
import { api } from '../store/authStore';
import useStickyStore from '../store/stickyStore';
import useVoteStore from '../store/voteStore';

function StarRating({ value = 0, hover = 0, onRate, onHover, onLeave, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'text-base' : 'text-xl';
  return (
    <div
      className="flex gap-0.5"
      onMouseLeave={onLeave}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate && onRate(star)}
          onMouseEnter={() => onHover && onHover(star)}
          className={`${sizeClass} transition-colors leading-none ${
            star <= (hover || value) ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const TYPE_LABELS = {
  idea: '💡',
  problem: '⚠️',
  solution: '✅',
  action_item: '🎯',
};

export default function VotingPanel({ roomId }) {
  const { notes } = useStickyStore();
  const { myVotes, isOpen, setMyVote, setOpen } = useVoteStore();
  const [hoveredStars, setHoveredStars] = useState({}); // noteId → hover value
  const [casting, setCasting] = useState({}); // noteId → boolean

  const sortedNotes = [...notes].sort(
    (a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)
  );

  const handleVote = async (noteId, stars) => {
    if (casting[noteId]) return;
    setCasting((prev) => ({ ...prev, [noteId]: true }));
    try {
      await api.post(`/api/rooms/${roomId}/notes/${noteId}/vote`, { stars });
      setMyVote(noteId, stars);
    } catch {
      // vote failed
    } finally {
      setCasting((prev) => ({ ...prev, [noteId]: false }));
    }
  };

  if (notes.length === 0) return null;

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(!isOpen)}
        className="absolute bottom-5 left-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200
          shadow-lg rounded-full text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:border-indigo-300
          hover:text-indigo-700 transition"
      >
        <span>⭐</span>
        <span>Voting</span>
        {notes.some((n) => !myVotes[n.id]) && (
          <span className="w-2 h-2 bg-indigo-500 rounded-full" />
        )}
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">⭐ Voting Catatan</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {notes.length} catatan · Urutkan berdasarkan votepopuler
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400
                  hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Note list */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {sortedNotes.map((note) => {
                const myRating = myVotes[note.id] ?? 0;
                const hover = hoveredStars[note.id] ?? 0;
                const avg = parseFloat(note.averageStars ?? 0);
                const total = note.totalVotes ?? note.vote_count ?? 0;

                return (
                  <div
                    key={note.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">
                      {TYPE_LABELS[note.type] ?? '📝'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {note.title || '(tanpa judul)'}
                      </p>
                      {note.content && (
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                          {note.content}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5">
                        <StarRating
                          value={myRating}
                          hover={hover}
                          onRate={(s) => handleVote(note.id, s)}
                          onHover={(s) =>
                            setHoveredStars((p) => ({ ...p, [note.id]: s }))
                          }
                          onLeave={() =>
                            setHoveredStars((p) => ({ ...p, [note.id]: 0 }))
                          }
                          size="sm"
                        />

                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <span className="text-yellow-400">★</span>
                          <span className="font-medium text-gray-600">
                            {avg.toFixed(1)}
                          </span>
                          <span>({total} suara)</span>
                        </div>

                        {casting[note.id] && (
                          <svg className="animate-spin w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {myRating > 0 && (
                      <div className="flex-shrink-0 text-xs text-indigo-500 font-semibold">
                        {myRating}★
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 text-center">
                Klik bintang untuk memberikan suara — satu vote per catatan
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
