import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { weatherTools } from './tools';
import type { ChatContext } from './types';

export function buildAgent(apiKey: string) {
  const llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash-lite',
    apiKey,
    maxOutputTokens: 512,
    temperature: 0.4,
    // Default is 6 retries with exponential backoff — a hard quota 429 would
    // stall the callable for 60s+. Two retries keeps transient blips covered.
    maxRetries: 2,
  });
  return createReactAgent({ llm, tools: weatherTools });
}

export function systemPrompt(ctx: ChatContext): string {
  return `You are the friendly weather assistant inside the "AI Weather" app.

The user is looking at the weather for ${ctx.location} (lat ${ctx.lat}, lon ${ctx.lon}). Their local time is ${ctx.localTime}. They use °${ctx.unit} — always give temperatures in °${ctx.unit}.

Current weather data for ${ctx.location}:
${ctx.weatherSummary}

How to answer:
- Answer practical questions (Do I need an umbrella? A coat? Sunglasses? When should I run?) in plain, warm language. Keep it to 2-4 sentences.
- For questions about ${ctx.location} today, use the weather data embedded above — do not call tools for it.
- Only call tools when you need something not in the data above: other locations (call geocode_city first to get coordinates, then get_weather), air quality (get_air_quality), or days/details not covered.
- Never invent weather data. If you can't get the data, say so honestly.
- If asked about something unrelated to weather, gently steer the conversation back to weather.`;
}
