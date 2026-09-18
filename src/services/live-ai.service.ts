import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from '../config/prompt.config.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import { type IAIService } from './ai.interface.js';

export class LiveAIService implements IAIService {
  private chatRepository: ChatRepository;
  private groqClient: Groq | null = null;

  constructor() {
    this.chatRepository = new ChatRepository();

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (apiKey && apiKey !== 'your_groq_api_key' && apiKey !== 'placeholder') {
      this.groqClient = new Groq({ apiKey });
    }
  }

  async generateResponse(
    studentId: number,
    prompt: string,
    targetLanguage: string = 'English'
  ): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey || apiKey === 'your_groq_api_key' || apiKey === 'placeholder') {
      return "Groq API key is missing or invalid in your backend .env file!";
    }

    if (!this.groqClient) {
      this.groqClient = new Groq({ apiKey });
    }

    // Save user turn (non-blocking)
    try {
      await this.chatRepository.saveConversation(studentId, 'user', prompt);
    } catch (dbErr) {
      console.warn('[DB Warning]: Failed to log user prompt:', dbErr);
    }

    // Optional user prefs
    let preferenceInstruction = '';
    try {
      const prefs = await this.chatRepository.getUserPreference(studentId);
      if (prefs) {
        preferenceInstruction = `Learning Style: ${prefs.learningStyle || 'Standard'}.`;
      }
    } catch {
      /* ignore */
    }

    const languageLine =
      targetLanguage && targetLanguage !== 'English'
        ? `\n\nReply ONLY in ${targetLanguage}. Do not use English unless ${targetLanguage} is English.`
        : '';

    const systemContent = `${SYSTEM_PROMPT}\n${preferenceInstruction}${languageLine}`;

    const historyMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemContent },
    ];

    // Recent conversation history
    try {
      const recentHistory = await this.chatRepository.getRecentConversations(studentId, 6);
      recentHistory.forEach((c) => {
        historyMessages.push({
          role: c.role === 'user' ? 'user' : 'assistant',
          content: c.message,
        });
      });
    } catch {
      /* ignore */
    }

    historyMessages.push({ role: 'user', content: prompt });

    try {
      const response = await this.groqClient.chat.completions.create({
        model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
        messages: historyMessages,
        temperature: 0.7,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
      });

      const reply = response.choices[0]?.message?.content?.trim();
      if (!reply) throw new Error('Groq returned an empty response.');

      try {
        await this.chatRepository.saveConversation(studentId, 'model', reply);
      } catch {
        /* ignore */
      }

      return reply;
    } catch (error: any) {
      console.error('[Groq API Error]:', error?.message || error);
      return `Groq Error: ${error?.message || "I couldn't process that request right now."}`;
    }
  }
}