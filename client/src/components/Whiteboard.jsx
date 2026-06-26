import { useEffect, useRef } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import socket from '../socket';
import useBoardStore from '../store/boardStore';

export default function Whiteboard({ roomId, currentUser, readOnly = false }) {
  const { snapshot: initialSnapshot, version: initialVersion, setSnapshot, setSyncing } = useBoardStore();

  const editorRef = useRef(null);
  const versionRef = useRef(initialVersion);
  const isApplyingRemote = useRef(false);
  const debounceRef = useRef(null);
  const snapshotLoaded = useRef(false);

  // Apply an incoming remote snapshot atomically using tldraw's batch API.
  function applyRemoteSnapshot(remoteSnap, remoteVersion) {
    const editor = editorRef.current;
    if (!editor || isApplyingRemote.current) return;
    if (remoteVersion <= versionRef.current) return;

    isApplyingRemote.current = true;
    try {
      editor.batch(() => {
        editor.loadSnapshot(remoteSnap, { partial: true });
      });
      versionRef.current = remoteVersion;
      setSnapshot(remoteSnap, remoteVersion);
    } finally {
      isApplyingRemote.current = false;
    }
  }

  // Called once tldraw has mounted and the editor is ready.
  function handleMount(editor) {
    editorRef.current = editor;

    // Apply pre-loaded snapshot (from roomData event) if available and not yet applied.
    if (initialSnapshot && !snapshotLoaded.current) {
      try {
        editor.loadSnapshot(initialSnapshot, { partial: true });
        versionRef.current = initialVersion;
      } catch {
        // Malformed snapshot — start fresh.
      }
      snapshotLoaded.current = true;
    }

    // Listen for local user changes, debounce, then emit to server.
    editor.store.listen(
      () => {
        if (isApplyingRemote.current) return; // don't echo remote changes back

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
          const snap = editor.getSnapshot();
          const nextVersion = versionRef.current + 1;
          versionRef.current = nextVersion;
          setSyncing(true);

          socket.emit('boardUpdate', {
            roomId,
            snapshot: snap,
            version: nextVersion,
          });
        }, 100);
      },
      { source: 'user' },
    );
  }

  // If initialSnapshot arrives (or changes) after the editor is already mounted, apply it.
  useEffect(() => {
    if (!initialSnapshot || snapshotLoaded.current || !editorRef.current) return;
    applyRemoteSnapshot(initialSnapshot, initialVersion);
    snapshotLoaded.current = true;
  }, [initialSnapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket events for remote board updates.
  useEffect(() => {
    function onBoardUpdated({ snapshot: remoteSnap, version: remoteVersion }) {
      setSyncing(false);
      applyRemoteSnapshot(remoteSnap, remoteVersion);
    }

    function onBoardUpdateRejected({ currentVersion }) {
      // Server rejected our write — sync versionRef down to current authoritative version.
      versionRef.current = currentVersion;
    }

    socket.on('boardUpdated', onBoardUpdated);
    socket.on('boardUpdateRejected', onBoardUpdateRejected);

    return () => {
      socket.off('boardUpdated', onBoardUpdated);
      socket.off('boardUpdateRejected', onBoardUpdateRejected);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full h-full">
      <Tldraw onMount={handleMount} readOnly={readOnly} />
    </div>
  );
}
