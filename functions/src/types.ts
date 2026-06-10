import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1).max(1000),
});

export const chatContextSchema = z.object({
  location: z.string().max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  unit: z.enum(['C', 'F']),
  localTime: z.string().max(40),
  weatherSummary: z.string().max(1500),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(10),
  context: chatContextSchema,
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatContext = z.infer<typeof chatContextSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
