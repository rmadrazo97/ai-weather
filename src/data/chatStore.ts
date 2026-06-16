// ---------------------------------------------------------------------------
// chatStore — per-city persisted chat sessions (ChatGPT-style history).
// Each city key maps to a list of sessions, newest first.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatSession {
  id: string;
  /** First user message, used as the list title. */
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const KEY_PREFIX = 'wxai.chats.';
/** Pre-session storage: a single rolling thread per city. */
const LEGACY_KEY_PREFIX = 'wxai.chat.';

export const MAX_SESSIONS = 20;
export const MAX_SESSION_MESSAGES = 40;

function isStoredMessage(m: unknown): m is ChatMessage {
  return (
    typeof m === 'object' &&
    m !== null &&
    typeof (m as ChatMessage).id === 'string' &&
    ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') &&
    typeof (m as ChatMessage).text === 'string'
  );
}

function isStoredSession(s: unknown): s is ChatSession {
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof (s as ChatSession).id === 'string' &&
    typeof (s as ChatSession).title === 'string' &&
    typeof (s as ChatSession).updatedAt === 'number' &&
    Array.isArray((s as ChatSession).messages)
  );
}

export async function loadSessions(cityKey: string): Promise<ChatSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + cityKey);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(isStoredSession)
          .map((s) => ({ ...s, messages: s.messages.filter(isStoredMessage) }));
      }
      return [];
    }

    // Migrate the legacy single-thread format into one session.
    const legacy = await AsyncStorage.getItem(LEGACY_KEY_PREFIX + cityKey);
    if (legacy) {
      AsyncStorage.removeItem(LEGACY_KEY_PREFIX + cityKey).catch(() => {});
      const parsed: unknown = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const messages = parsed.filter(isStoredMessage);
        if (messages.length > 0) {
          const firstUser = messages.find((m) => m.role === 'user');
          const session: ChatSession = {
            id: `s-migrated-${cityKey}`,
            title: (firstUser?.text ?? 'Conversation').slice(0, 80),
            updatedAt: Date.now(),
            messages,
          };
          await saveSessions(cityKey, [session]);
          return [session];
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveSessions(cityKey: string, sessions: ChatSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      KEY_PREFIX + cityKey,
      JSON.stringify(sessions.slice(0, MAX_SESSIONS)),
    );
  } catch {
    // best-effort persistence
  }
}

/** Insert or update a session, keeping the list sorted newest-first. */
export function upsertSession(sessions: ChatSession[], session: ChatSession): ChatSession[] {
  return [session, ...sessions.filter((s) => s.id !== session.id)].slice(0, MAX_SESSIONS);
}
