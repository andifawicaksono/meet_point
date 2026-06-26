import { useEffect, useRef, useState } from 'react';
import socket from '../socket';

const CURSOR_REMOVE_DELAY = 3000; // ms of inactivity before removing a remote cursor

function CursorIcon({ color }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-sm"
    >
      <path
        d="M0 0L6 14L8.5 8.5L14 6L0 0Z"
        fill={color}
        stroke="white"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CursorOverlay({ roomId }) {
  const [cursors, setCursors] = useState({});
  const timeoutsRef = useRef({});
  const lastEmitRef = useRef(0);

  // Schedule cursor removal after 3 s of inactivity.
  function scheduleCursorRemoval(userId) {
    if (timeoutsRef.current[userId]) clearTimeout(timeoutsRef.current[userId]);
    timeoutsRef.current[userId] = setTimeout(() => {
      setCursors((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      delete timeoutsRef.current[userId];
    }, CURSOR_REMOVE_DELAY);
  }

  // Listen for remote cursor moves.
  useEffect(() => {
    function onCursorMoved({ userId, name, color, x, y }) {
      setCursors((prev) => ({
        ...prev,
        [userId]: { name, color, x, y },
      }));
      scheduleCursorRemoval(userId);
    }

    socket.on('cursorMoved', onCursorMoved);

    return () => {
      socket.off('cursorMoved', onCursorMoved);
      // Clear all pending removal timers on unmount.
      Object.values(timeoutsRef.current).forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track local mouse and emit to server (client-side throttle: 30 ms).
  useEffect(() => {
    const container = document.getElementById('whiteboard-area');
    if (!container) return;

    function onMouseMove(e) {
      const now = Date.now();
      if (now - lastEmitRef.current < 30) return;
      lastEmitRef.current = now;

      const rect = container.getBoundingClientRect();
      socket.emit('cursorMove', {
        roomId,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    container.addEventListener('mousemove', onMouseMove);
    return () => container.removeEventListener('mousemove', onMouseMove);
  }, [roomId]);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {Object.entries(cursors).map(([userId, { name, color, x, y }]) => (
        <div
          key={userId}
          className="absolute"
          style={{
            transform: `translate(${x}px, ${y}px)`,
            transition: 'transform 50ms ease',
            top: 0,
            left: 0,
          }}
        >
          <CursorIcon color={color} />
          <span
            className="absolute top-4 left-3 text-white text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm"
            style={{ backgroundColor: color }}
          >
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}
