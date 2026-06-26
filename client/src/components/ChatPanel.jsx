import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../store/authStore';
import socket from '../socket';
import useChatStore from '../store/chatStore';
import useRoomStore from '../store/roomStore';

// ── Helpers ───────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  return (name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

// ── Avatar chip ───────────────────────────────────────────────────────────

function MiniAvatar({ name, color }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: color ?? '#6366f1' }}
    >
      {initials(name)}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────

function MessageBubble({ message, isOwn, onReply }) {
  return (
    <div className={`group flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {!isOwn && (
        <MiniAvatar name={message.author?.name} color={message.author?.cursorColor} />
      )}

      <div className={`max-w-[200px] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isOwn && (
          <p className="text-xs text-gray-400 mb-0.5 px-1">{message.author?.name}</p>
        )}

        {/* Reply-to preview */}
        {message.replyTo && (
          <div className="text-xs text-gray-400 bg-gray-100 border-l-2 border-gray-300 px-2 py-1 rounded mb-1 line-clamp-1 max-w-full">
            <span className="font-medium">{message.replyTo.author?.name}: </span>
            {message.replyTo.content}
          </div>
        )}

        <div
          className={`relative px-3 py-2 rounded-2xl text-sm leading-snug
            ${isOwn
              ? 'bg-indigo-500 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-800 rounded-tl-sm'
            }`}
        >
          {message.content}
        </div>

        <div className="flex items-center gap-2 mt-0.5 px-1">
          <span className="text-xs text-gray-300">{formatTime(message.createdAt)}</span>

          <button
            onClick={() => onReply(message)}
            className="text-xs text-gray-300 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition"
          >
            Balas
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ChatPanel({ roomId, currentUser }) {
  const {
    messages,
    unreadCount,
    isPanelOpen,
    setMessages,
    prependMessages,
    addMessage,
    openPanel,
    closePanel,
    clearUnread,
  } = useChatStore();

  const { participants } = useRoomStore();

  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, authorName, content }
  const [mentionQuery, setMentionQuery] = useState(null); // string | null
  const [mentionStart, setMentionStart] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const isAtBottom = useRef(true);

  // ── Scroll helpers ─────────────────────────────────────────────────────

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const trackScroll = () => {
    const el = listRef.current;
    if (!el) return;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // ── Load history ───────────────────────────────────────────────────────

  const loadHistory = useCallback(
    async (page = 1) => {
      setLoadingHistory(true);
      try {
        const { data } = await api.get(`/api/rooms/${roomId}/chat`, {
          params: { page, limit: 50 },
        });
        if (page === 1) {
          setMessages(data.messages ?? []);
          setHasMoreHistory(data.pagination?.hasMore ?? false);
          setHistoryPage(1);
        } else {
          prependMessages(data.messages ?? []);
          setHasMoreHistory(data.pagination?.hasMore ?? false);
          setHistoryPage(page);
        }
      } catch {
        // history unavailable
      } finally {
        setLoadingHistory(false);
      }
    },
    [roomId, setMessages, prependMessages],
  );

  // Open panel → clear badge + load history
  const handleOpen = () => {
    openPanel();
    clearUnread();
    if (messages.length === 0) loadHistory(1);
  };

  // ── Socket listener ────────────────────────────────────────────────────

  useEffect(() => {
    const onNewMessage = ({ message }) => {
      addMessage(message);
    };
    socket.on('newMessage', onNewMessage);
    return () => socket.off('newMessage', onNewMessage);
  }, [addMessage]);

  // Auto-scroll when messages arrive and user is already at bottom
  useEffect(() => {
    if (isPanelOpen && isAtBottom.current) {
      scrollToBottom();
    }
  }, [messages, isPanelOpen, scrollToBottom]);

  // Scroll to bottom when panel first opens
  useEffect(() => {
    if (isPanelOpen) {
      setTimeout(() => scrollToBottom(), 50);
    }
  }, [isPanelOpen, scrollToBottom]);

  // ── @mention ───────────────────────────────────────────────────────────

  const mentionSuggestions =
    mentionQuery !== null
      ? participants.filter(
          (p) =>
            p.id !== currentUser?.id &&
            p.name?.toLowerCase().startsWith(mentionQuery.toLowerCase()),
        )
      : [];

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const mentionMatch = textBefore.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionStart(cursor - mentionMatch[0].length);
    } else {
      setMentionQuery(null);
    }
  };

  const completeMention = (name) => {
    const before = inputValue.slice(0, mentionStart);
    const after = inputValue.slice(mentionStart + (mentionQuery?.length ?? 0) + 1);
    const newVal = `${before}@${name} ${after}`;
    setInputValue(newVal);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  // ── Send ───────────────────────────────────────────────────────────────

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content) return;

    socket.emit('chatMessage', {
      roomId,
      content,
      replyToId: replyTo?.id ?? null,
    });

    setInputValue('');
    setReplyTo(null);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0 && e.key === 'Escape') {
      setMentionQuery(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <aside className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">

      {/* Panel header */}
      <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Chat</span>
        </div>

        <button
          onClick={isPanelOpen ? closePanel : handleOpen}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition"
        >
          {!isPanelOpen && unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] bg-indigo-500 text-white text-[10px] font-bold
              rounded-full flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          {isPanelOpen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>

      {isPanelOpen ? (
        <>
          {/* Load more history */}
          {hasMoreHistory && (
            <div className="py-2 text-center border-b border-gray-100">
              <button
                onClick={() => loadHistory(historyPage + 1)}
                disabled={loadingHistory}
                className="text-xs text-indigo-500 hover:text-indigo-700 disabled:text-gray-300 transition"
              >
                {loadingHistory ? 'Memuat…' : 'Muat pesan lama'}
              </button>
            </div>
          )}

          {/* Message list */}
          <div
            ref={listRef}
            onScroll={trackScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.length === 0 && !loadingHistory && (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-sm text-gray-300">Belum ada pesan</p>
                <p className="text-xs text-gray-200 mt-1">Mulai percakapan di bawah</p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.author?.id === currentUser?.id}
                onReply={(m) =>
                  setReplyTo({ id: m.id, authorName: m.author?.name, content: m.content })
                }
              />
            ))}
          </div>

          {/* Reply bar */}
          {replyTo && (
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-t border-indigo-100">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-indigo-600">
                  Membalas {replyTo.authorName}
                </p>
                <p className="text-xs text-gray-400 truncate">{replyTo.content}</p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="text-gray-400 hover:text-gray-600 transition flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* @mention dropdown */}
          {mentionQuery !== null && mentionSuggestions.length > 0 && (
            <div className="mx-4 mb-2 bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden max-h-32 overflow-y-auto">
              {mentionSuggestions.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur before click registers
                    completeMention(p.name);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 transition text-left"
                >
                  <div
                    className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-semibold flex-shrink-0"
                    style={{ backgroundColor: p.cursorColor ?? '#6366f1' }}
                  >
                    {initials(p.name)}
                  </div>
                  @{p.name}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pesan… (Enter kirim, Shift+Enter baris baru)"
                className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-300 focus:outline-none
                  leading-snug max-h-24 overflow-y-auto py-1"
                style={{ lineHeight: '1.4' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
                }}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full
                  bg-indigo-500 hover:bg-indigo-600 text-white transition disabled:opacity-30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Collapsed state */
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            {unreadCount > 0 ? (
              <div>
                <p className="text-sm font-semibold text-indigo-600">{unreadCount} pesan baru</p>
                <p className="text-xs text-gray-400 mt-0.5">Klik ▲ di atas untuk membuka</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Klik ▲ di atas untuk membuka chat</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
