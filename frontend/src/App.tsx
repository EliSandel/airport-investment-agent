import './App.css';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ToolCall {
  name: string;
  input: unknown;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

const EXAMPLES = [
  'Which airports in New England are strong candidates for terminal expansion?',
  'Compare LA and Santa Ana airport congestion levels.',
  'What is the percentage of long haul flights out of Anchorage airport?',
  'What is the unmet flight demand in SFO airport and why?',
];

/** e.g. rank_airports(states: ME,NH,VT, limit: 10) */
function formatToolCall(call: ToolCall): string {
  const args = Object.entries((call.input ?? {}) as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(',') : JSON.stringify(v)}`)
    .join(', ');
  return `${call.name}(${args})`;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    const history: Message[] = [...messages, { role: 'user', content: question }];
    setMessages(history);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The backend is stateless: send the whole conversation (text only).
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const data: { reply: string; toolCalls: ToolCall[] } = await res.json();
      setMessages([
        ...history,
        { role: 'assistant', content: data.reply, toolCalls: data.toolCalls },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a new line.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>Airport Investment Intelligence</h1>
          <p className="subtitle">
            Rankings are computed by a deterministic scoring model on BTS data.
            The AI chooses the analysis and explains the results.
          </p>
        </div>
        {messages.length > 0 && (
          <button className="secondary" onClick={() => setMessages([])}>
            New chat
          </button>
        )}
      </header>

      <main className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <p>Try one of these:</p>
            {EXAMPLES.map((q) => (
              <button key={q} className="example" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <div className="tools">
                {m.toolCalls.map((t, j) => (
                  <code key={j}>🔧 {formatToolCall(t)}</code>
                ))}
              </div>
            )}
            {m.role === 'assistant' ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            ) : (
              <p>{m.content}</p>
            )}
          </div>
        ))}

        {loading && <div className="message assistant loading">Analyzing…</div>}
        {error && <div className="error">⚠️ {error}</div>}
        <div ref={bottomRef} />
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about US airports…"
          rows={2}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}