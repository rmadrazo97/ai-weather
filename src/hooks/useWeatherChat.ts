// ---------------------------------------------------------------------------
// useWeatherChat — chat state + streaming send against the `weatherChat`
// Firebase callable, with local keyword-matched fallback when offline or
// over the daily limit. Conversations persist per city as sessions
// (ChatGPT-style history) via chatStore.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cityId, type WeatherScenario, type City } from '../data/weatherData';
import { ensureSignedIn, weatherChatCallable, type ChatTurn } from '../lib/firebase';
import { buildWeatherContext } from '../data/weatherContext';
import { generateLocalResponse } from '../utils/localAnswers';
import {
  loadSessions,
  saveSessions,
  upsertSession,
  MAX_SESSION_MESSAGES,
  type ChatMessage,
  type ChatSession,
} from '../data/chatStore';

export type { ChatMessage, ChatSession };

interface UseWeatherChatArgs {
  wx: WeatherScenario | null | undefined;
  unit: 'C' | 'F';
  city?: Pick<City, 'name' | 'lat' | 'lon'> | null;
}

interface UseWeatherChatResult {
  messages: ChatMessage[];
  isTyping: boolean;
  sendMessage: (text: string) => void;
  /** Abort any in-flight stream without touching the conversation. */
  stop: () => void;
  /** Past conversations for the active location, newest first. */
  sessions: ChatSession[];
  activeSessionId: string | null;
  /** Start a fresh conversation (kept out of history until a message is sent). */
  newChat: () => void;
  /** Resume a past conversation. */
  openSession: (id: string) => void;
  /** Remove a conversation from history. */
  deleteSession: (id: string) => void;
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

  // Location scope key; falls back to the location name when no coordinates
  // are available.
  const cityKey = useMemo(() => {
    if (city) return cityId(city.lat, city.lon);
    if (wx?.location) return wx.location;
    return null;
  }, [city, wx?.location]);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const sessionsRef = useRef<ChatSession[]>([]);
  const activeIdRef = useRef<string | null>(null);

  // Only persist after this key's history has been loaded, so an initial
  // empty commit can't clobber stored conversations.
  const loadedKeyRef = useRef<string | null>(null);
  // Skip the persist pass triggered by merely opening a stored session, so
  // browsing history doesn't bump updatedAt.
  const skipNextSaveRef = useRef(false);

  const setActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveSessionId(id);
  }, []);

  const newSessionId = useCallback(
    () => `s-${Date.now()}-${++seqRef.current}`,
    [],
  );

  // Restore this location's history and resume its most recent conversation
  useEffect(() => {
    let cancelled = false;
    abortRef.current?.abort();
    setIsTyping(false);
    commit([]);
    sessionsRef.current = [];
    setSessions([]);
    loadedKeyRef.current = null;
    setActive(newSessionId());
    if (!cityKey) return;
    loadSessions(cityKey).then((list) => {
      if (cancelled) return;
      sessionsRef.current = list;
      setSessions(list);
      if (list.length > 0) {
        skipNextSaveRef.current = true;
        setActive(list[0].id);
        commit(list[0].messages);
      }
      loadedKeyRef.current = cityKey;
    });
    return () => {
      cancelled = true;
    };
  }, [cityKey, commit, setActive, newSessionId]);

  // Persist the active session on change (debounced — streaming updates
  // arrive per chunk)
  useEffect(() => {
    if (!cityKey || loadedKeyRef.current !== cityKey) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (messages.length === 0 || !activeIdRef.current) return;
    const timer = setTimeout(() => {
      const msgs = messagesRef.current.slice(-MAX_SESSION_MESSAGES);
      const firstUser = msgs.find((m) => m.role === 'user');
      const next = upsertSession(sessionsRef.current, {
        id: activeIdRef.current as string,
        title: (firstUser?.text ?? 'Conversation').slice(0, 80),
        updatedAt: Date.now(),
        messages: msgs,
      });
      sessionsRef.current = next;
      setSessions(next);
      saveSessions(cityKey, next);
    }, 400);
    return () => clearTimeout(timer);
  }, [messages, cityKey]);

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

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsTyping(false);
  }, []);

  const newChat = useCallback(() => {
    stop();
    commit([]);
    setActive(newSessionId());
  }, [stop, commit, setActive, newSessionId]);

  const openSession = useCallback(
    (id: string) => {
      const session = sessionsRef.current.find((s) => s.id === id);
      if (!session) return;
      stop();
      skipNextSaveRef.current = true;
      setActive(id);
      commit(session.messages);
    },
    [stop, commit, setActive],
  );

  const deleteSession = useCallback(
    (id: string) => {
      const next = sessionsRef.current.filter((s) => s.id !== id);
      sessionsRef.current = next;
      setSessions(next);
      if (cityKey) saveSessions(cityKey, next);
      if (activeIdRef.current === id) {
        stop();
        commit([]);
        setActive(newSessionId());
      }
    },
    [cityKey, stop, commit, setActive, newSessionId],
  );

  return {
    messages,
    isTyping,
    sendMessage,
    stop,
    sessions,
    activeSessionId,
    newChat,
    openSession,
    deleteSession,
  };
}
