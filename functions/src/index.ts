import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { logger } from 'firebase-functions';
import { SystemMessage, HumanMessage, AIMessage, isAIMessageChunk } from '@langchain/core/messages';
import type { BaseMessage, BaseMessageChunk } from '@langchain/core/messages';
import { buildAgent, systemPrompt } from './agent';
import { checkRateLimit } from './rateLimit';
import { chatRequestSchema } from './types';

initializeApp();

const geminiKey = defineSecret('GEMINI_API_KEY');

/** Extract plain-text deltas from an AIMessageChunk's content. */
function chunkText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (part && typeof part === 'object' && part.type === 'text' ? part.text ?? '' : ''))
      .join('');
  }
  return '';
}

export const weatherChat = onCall(
  {
    secrets: [geminiKey],
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
    maxInstances: 5,
  },
  async (request, response) => {
    // 1) Require anonymous (or any) Firebase Auth.
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign-in required.');
    }

    // 2) Per-UID daily rate limit.
    await checkRateLimit(uid);

    // 3) Validate payload.
    const parsed = chatRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Invalid chat request.');
    }
    const { messages, context } = parsed.data;

    // 4) Build LangChain message history.
    const lcMessages: BaseMessage[] = [
      new SystemMessage(systemPrompt(context)),
      ...messages.map((m) =>
        m.role === 'user' ? new HumanMessage(m.text) : new AIMessage(m.text)
      ),
    ];

    // 5–7) Run the agent, streaming text deltas to the client.
    try {
      const agent = buildAgent(geminiKey.value());
      const stream = await agent.stream(
        { messages: lcMessages },
        { streamMode: 'messages', recursionLimit: 8 }
      );

      let full = '';
      for await (const [msg, meta] of stream as AsyncIterable<[BaseMessageChunk, Record<string, any>]>) {
        if (meta?.langgraph_node !== 'agent') continue;
        if (!isAIMessageChunk(msg)) continue;
        // Skip tool-call chunks; we only stream user-facing text.
        if (msg.tool_call_chunks && msg.tool_call_chunks.length > 0) continue;
        const delta = chunkText(msg.content);
        if (!delta) continue;
        full += delta;
        if (request.acceptsStreaming) {
          await response?.sendChunk({ delta });
        }
      }

      return { text: full };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('weatherChat agent error', err);
      // Don't throw here: once SSE streaming has started, an HttpsError
      // produces an empty stream and the client hangs. Return a graceful
      // message instead so the client always receives a result frame.
      const fallback =
        "I couldn't reach the forecast brain just now. Please try again in a moment.";
      if (request.acceptsStreaming) {
        await response?.sendChunk({ delta: fallback });
      }
      return { text: fallback, degraded: true };
    }
  }
);
