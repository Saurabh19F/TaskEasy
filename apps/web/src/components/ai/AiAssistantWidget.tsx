'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { apiPost } from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Show my team summary',
  'How many tasks are pending?',
  'Give me a quick overview',
];

export function AiAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Don't render the widget on the login screen, etc.
  if (!isAuthenticated) return null;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      // Backend pulls real, hierarchy-scoped dashboard data for this user
      // and answers from that — see AiService.askAssistant.
      const { reply } = await apiPost<{ reply: string }>('/ai/assistant', {
        message: trimmed,
        history: next.slice(-8),
      });
      setMessages((cur) => [...cur, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((cur) => [
        ...cur,
        { role: 'assistant', content: "Sorry, I couldn't reach the server. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand via-primary to-accent text-contrast shadow-[0_18px_40px_-18px_rgba(37,99,235,0.42)] transition-transform hover:scale-105"
        aria-label={open ? 'Close TaskEasy AI' : 'Open TaskEasy AI'}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[600px] max-h-[80vh] w-[380px] flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-[0_40px_120px_-56px_rgba(15,23,42,0.85)]">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center gap-3 bg-gradient-to-r from-brand via-primary to-accent px-4 py-4 text-contrast">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-tight">TaskEasy AI</p>
              <p className="flex items-center gap-1 text-xs text-contrast-80">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Online
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto rounded-full p-1.5 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-4 pt-4 text-center">
                <div className="text-4xl">✨</div>
                <div>
                  <p className="font-semibold text-foreground">Hi! I&apos;m TaskEasy AI</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ask me about your team, tasks, company data, or anything on your dashboard.
                  </p>
                </div>
                <div className="space-y-2 pt-2 text-left">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-2.5 text-left text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-strong"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-contrast'
                      : 'bg-surface-muted text-foreground'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-surface-muted px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400/60 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400/60 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400/60" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex flex-shrink-0 items-center gap-2 border-t border-border bg-surface-strong p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your data…"
              className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-contrast transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
