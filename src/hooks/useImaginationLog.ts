import { useEffect, useState } from 'react';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'network';
  content: string;
  timestamp: number;
}

const STORAGE_KEY = 'imagination-network-history';

function readInitialHistory(): ConversationTurn[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ConversationTurn[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse imagination history', error);
    return [];
  }
}

export function useImaginationLog() {
  const [history, setHistory] = useState<ConversationTurn[]>([]);

  useEffect(() => {
    setHistory(readInitialHistory());
  }, []);

  useEffect(() => {
    if (!history.length) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  return {
    history,
    appendTurn: (turn: ConversationTurn) =>
      setHistory((prev) => [...prev, turn]),
    reset: () => setHistory([])
  } as const;
}
