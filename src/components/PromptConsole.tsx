import { FormEvent, useState } from 'react';
import type { ConversationTurn } from '../hooks/useImaginationLog';

interface PromptConsoleProps {
  history: ConversationTurn[];
  loading: boolean;
  error?: string | null;
  onPromptSubmit: (prompt: string) => Promise<void>;
  onReset: () => void;
}

export default function PromptConsole({
  history,
  loading,
  error,
  onPromptSubmit,
  onReset
}: PromptConsoleProps) {
  const [prompt, setPrompt] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }
    await onPromptSubmit(prompt.trim());
    setPrompt('');
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2 className="panel__title">Run the Imagination Network</h2>
          <p className="panel__subtitle">
            Prompt the network as soon as you land. Every exchange is preserved locally so you can evolve ideas offline.
          </p>
        </div>
        <button className="ghost" type="button" onClick={onReset}>
          Purge Memory
        </button>
      </header>

      <div className="console">
        <div className="console__scroll">
          {history.length === 0 && (
            <p className="console__empty">Awaiting your spark. Prompt to entangle with the network.</p>
          )}
          {history.map((turn) => (
            <article key={turn.id} className={`console__turn console__turn--${turn.role}`}>
              <div className="console__meta">
                <span>{turn.role === 'user' ? 'You' : 'Imagination Network'}</span>
                <time dateTime={new Date(turn.timestamp).toISOString()}>
                  {new Date(turn.timestamp).toLocaleTimeString()}
                </time>
              </div>
              <p>{turn.content}</p>
            </article>
          ))}
        </div>
      </div>

      <form className="prompt-form" onSubmit={handleSubmit}>
        <label htmlFor="prompt" className="sr-only">
          Prompt the network
        </label>
        <textarea
          id="prompt"
          name="prompt"
          placeholder="Describe the vision you want the Imagination Network to manifest..."
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          required
          disabled={loading}
        />
        <div className="prompt-form__actions">
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Entangling…' : 'Transmit Prompt'}
          </button>
          {error ? <p className="prompt-form__error">{error}</p> : null}
        </div>
      </form>
    </section>
  );
}
