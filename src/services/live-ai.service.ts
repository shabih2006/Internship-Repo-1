import Groq from 'groq-sdk';
import { pool } from '../config/db.js';
import { type IAIService } from './ai.interface.js';

export class LiveAIService implements IAIService {
  async generateResponse(studentId: number, prompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey || apiKey === 'your_groq_api_key' || apiKey === 'placeholder') {
      throw new Error('GROQ_API_KEY is missing or still set to a placeholder.');
    }

    // 1. Log user prompt to PostgreSQL
    try {
      await pool.query(
        'INSERT INTO conversation (student_id, role, message) VALUES ($1, $2, $3)',
        [studentId, 'user', prompt]
      );
    } catch (dbErr) {
      console.error('[Database Warning]: Failed to log user prompt:', dbErr);
    }

    // 2. Stream AI completion from Groq
    const groq = new Groq({ apiKey });
    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful, concise AI Campus Assistant for university students.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 1,
      max_completion_tokens: 2048,
      top_p: 1,
      reasoning_effort: 'medium',
      stream: true,
    });

    let reply = '';
    for await (const chunk of response) {
      reply += chunk.choices[0]?.delta?.content || '';
    }

    reply = reply.trim();
    if (!reply) throw new Error('Groq returned an empty response.');

    // 3. Log model response to PostgreSQL
    try {
      await pool.query(
        'INSERT INTO conversation (student_id, role, message) VALUES ($1, $2, $3)',
        [studentId, 'model', reply]
      );
    } catch (dbErr) {
      console.error('[Database Warning]: Failed to log model response:', dbErr);
    }

    return reply;
  }
}