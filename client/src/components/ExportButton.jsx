import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useRoomStore from '../store/roomStore';
import { exportToPNG, exportToJPG, exportToPDF } from '../utils/exportUtils';

const WHITEBOARD_ID = 'whiteboard-area';

const EXPORT_OPTIONS = [
  { type: 'png', icon: '🖼️', label: 'Unduh PNG',  description: 'Gambar transparan, kualitas tinggi' },
  { type: 'jpg', icon: '📷', label: 'Unduh JPG',  description: 'Gambar terkompresi, lebih kecil' },
  { type: 'pdf', icon: '📄', label: 'Unduh PDF',  description: 'Dokumen A4 landscape dengan header' },
];

export default function ExportButton() {
  const { roomId } = useParams();
  const { currentRoom } = useRoomStore();

  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(null); // 'png' | 'jpg' | 'pdf' | null

  const menuRef = useRef(null);
  const roomName = currentRoom?.name ?? 'MeetPoint';

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Not on a room page — render nothing
  if (!roomId) return null;

  const handleExport = async (type) => {
    if (exporting) return;
    setExporting(type);
    setIsOpen(false);

    try {
      switch (type) {
        case 'png': await exportToPNG(WHITEBOARD_ID, roomName); break;
        case 'jpg': await exportToJPG(WHITEBOARD_ID, roomName); break;
        case 'pdf': await exportToPDF(WHITEBOARD_ID, roomName); break;
      }
    } finally {
      setExporting(null);
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-2"
    >
      {/* Options dropdown */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-56">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Ekspor Whiteboard
            </p>
          </div>

          {EXPORT_OPTIONS.map(({ type, icon, label, description }) => (
            <button
              key={type}
              onClick={() => handleExport(type)}
              className="flex items-start gap-3 w-full px-4 py-3 hover:bg-gray-50 transition text-left"
            >
              <span className="text-xl mt-0.5 flex-shrink-0">{icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 leading-tight mt-0.5">{description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        disabled={!!exporting}
        title={exporting ? 'Sedang mengekspor…' : 'Ekspor whiteboard'}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full
          shadow-lg text-sm font-medium text-gray-700 hover:shadow-xl hover:border-indigo-300
          hover:text-indigo-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait"
      >
        {exporting ? (
          <>
            <svg className="animate-spin w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Mengekspor…</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Ekspor</span>
          </>
        )}
      </button>
    </div>
  );
}
