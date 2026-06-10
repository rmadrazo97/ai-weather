// ---------------------------------------------------------------------------
// useWeatherChat — chat state + streaming send against the `weatherChat`
// Firebase callable, with local keyword-matched fallback when offline or
// over the daily limit.
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from 'react';
import type { WeatherScenario, City } from '../data/weatherData';
import { ensureSignedIn, weatherChatCallable, type ChatTurn } from '../lib/firebase';
import { buildWeatherContext } from '../data/weatherContext';
import { generateLocalResponse } from '../utils/localAnswers';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface UseWeatherChatArgs {
  wx: WeatherScenario | null | undefined;
  unit: 'C' | 'F';
  city?: Pick<City, 'name' | 'lat' | 'lon'> | null;
}

interface UseWeatherChatResult {
  messages: ChatMessage[];
  isTyping: boolean;
  sendMessage: (text: string) => void;
  reset: () => void;
}

const MAX_HISTORY = 10;
const MAX_TURN_CHARS = 1000;

export function useWeatherChat({ wx, unit, city }: UseWeatherChatArgs): UseWeatherChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Latest messages, readable synchronously when building request history.
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const commit = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const upsertAssistant = useCallback(
    (id: string, text: string) => {
      const prev = messagesRef.current;
      const idx = prev.findIndex((m) => m.id === id);
      if (idx === -1) {
        commit([...prev, { id, role: 'assistant', text }]);
      } else {
        const next = prev.slice();
        next[idx] = { ...next[idx], text };
        commit(next);
      }
    },
    [commit],
  );

  const sendMessage = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || !wx) return;

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}-${++seqRef.current}`,
        role: 'user',
        text,
      };
      const withUser = [...messagesRef.current, userMsg];
      commit(withUser);
      setIsTyping(true);

      const history: ChatTurn[] = withUser
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_TURN_CHARS) }));

      const assistantId = `a-${Date.now()}-${++seqRef.current}`;

      const run = async () => {
        await ensureSignedIn();
        if (controller.signal.aborted) return;

        const { stream, data } = await weatherChatCallable.stream(
          {
            messages: history,
            context: buildWeatherContext(wx, city ?? null, unit),
          },
          { signal: controller.signal },
        );

        let acc = '';
        for await (const chunk of stream) {
          if (controller.signal.aborted) return;
          if (chunk && typeof chunk.delta === 'string' && chunk.delta.length > 0) {
            acc += chunk.delta;
            setIsTyping(false);
            upsertAssistant(assistantId, acc);
          }
        }

        const final = await data;
        if (controller.signal.aborted) return;
        if (final && typeof final.text === 'string' && final.text.trim().length > 0) {
          upsertAssistant(assistantId, final.text);
        } else if (!acc) {
          // Stream closed without any content (e.g. server aborted mid-stream).
          throw new Error('empty-response');
        }
        setIsTyping(false);
      };

      // Watchdog: a mid-stream server failure can close the SSE stream without
      // a result frame, leaving `await data` pending forever.
      let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
      const watchdog = new Promise<never>((_, reject) => {
        watchdogTimer = setTimeout(() => reject(new Error('chat-timeout')), 30000);
      });

      Promise.race([run(), watchdog])
        .catch((err: unknown) => {
        const timedOut = err instanceof Error && err.message === 'chat-timeout';
        if (timedOut) {
          controller.abort();
        } else if (controller.signal.aborted) {
          return;
        }
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        const local = generateLocalResponse(text, wx, unit);
        const reply =
          code === 'functions/resource-exhausted'
            ? `You've hit today's chat limit — here's a quick read instead: ${local}`
            : `${local}\n\n(offline answer)`;
        setIsTyping(false);
        upsertAssistant(assistantId, reply);
        })
        .finally(() => clearTimeout(watchdogTimer));
    },
    [wx, unit, city, commit, upsertAssistant],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    commit([]);
    setIsTyping(false);
  }, [commit]);

  return { messages, isTyping, sendMessage, reset };
}
