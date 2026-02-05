'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  id: string;
  createdAt: string;
  title: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    }
  };

  const loadConversation = async (id: string) => {
    setLoading(true);
    setConversationId(id);
    try {
      const res = await fetch(`/api/chat?conversationId=${id}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to load conversation', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent loading the chat when deleting
    if (!confirm('Are you sure you want to delete this chat?')) return;

    try {
      const res = await fetch(`/api/conversations?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        // If deleted current chat, reset
        if (conversationId === id) {
          startNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setInput('');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId: conversationId,
        }),
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) throw new Error('Failed to send message');

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.reply },
        ]);
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
        // Refresh sidebar if it's a new conversation
        if (!conversationId) {
          fetchConversations();
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: Could not get response.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">

      {/* Sidebar */}
      <div className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-gray-800">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center space-x-2 bg-pink-600 hover:bg-pink-700 text-white py-3 rounded-lg transition-colors font-medium shadow-lg shadow-pink-900/20"
          >
            <span>+ New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">History</h3>
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => loadConversation(c.id)}
              className={`group w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm cursor-pointer transition-colors ${conversationId === c.id
                  ? 'bg-gray-800 text-pink-400'
                  : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                }`}
            >
              <span className="truncate flex-1 pr-2">{c.title || 'Untitled Chat'}</span>

              <button
                onClick={(e) => deleteConversation(e, c.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-500 transition-opacity"
                title="Delete Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 text-gray-400 hover:text-red-400 py-2 transition-colors text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
            </svg>
            <span>Sign Out</span>
          </button>
          <div className="mt-2 text-xs text-center text-gray-600">
            Reserved &copy; DonutCyber
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <header className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/95 backdrop-blur z-10">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-900/40">
              D
            </div>
            <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
              DonutCyber AI
            </h1>
          </div>
          {/* Mobile menu button could go here */}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-4xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-4">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-3xl">🍩</span>
              </div>
              <p className="text-lg font-medium">How can I help you today?</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-md ${msg.role === 'user'
                    ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white'
                    : 'bg-gray-800 border border-gray-700 text-gray-100'
                  }`}
              >
                <div className="text-xs opacity-50 mb-1 font-semibold uppercase tracking-wide">
                  {msg.role === 'user' ? 'You' : 'DonutCyber'}
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4">
                <div className="flex space-x-2 items-center">
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gray-900 border-t border-gray-800">
          <form
            onSubmit={handleSubmit}
            className="max-w-4xl mx-auto w-full relative flex items-center shadow-2xl shadow-black/50 rounded-2xl"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message DonutCyber..."
              className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-pink-500/50 border border-gray-700 transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 p-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </form>
          <p className="text-center text-xs text-gray-600 mt-2 font-medium">
            DonutCyber AI can make mistakes.
          </p>
        </div>
      </div>
    </div>
  );
}
