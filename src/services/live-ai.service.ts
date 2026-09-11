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

  async generateResponse(studentId: number, prompt: string, targetLanguage: string = 'English'): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey || apiKey === 'your_groq_api_key' || apiKey === 'placeholder') {
      console.error('[Groq Error]: Missing or invalid GROQ_API_KEY in environment variables.');
      return "Groq API key is missing or invalid in your backend .env file! 🔑";
    }

    if (!this.groqClient) {
      this.groqClient = new Groq({ apiKey });
    }

    // 1. Save user turn to DB
    try {
      await this.chatRepository.saveConversation(studentId, 'user', prompt);
    } catch (dbErr) {
      console.warn('[DB Warning]: Failed to log user prompt:', dbErr);
    }

    // 2. Fetch User Preferences
    let preferenceInstruction = '';
    try {
      const prefs = await this.chatRepository.getUserPreference(studentId);
      if (prefs) {
        preferenceInstruction = `Learning Style: ${prefs.learningStyle || 'Standard'}.`;
      }
    } catch (prefErr) {
      console.warn('[Preference Warning]: Could not load preferences:', prefErr);
    }

    // 3. Strict System Prompt
    const strictSystemPrompt = `${SYSTEM_PROMPT}\n${preferenceInstruction}\n\n[SYSTEM MANDATE]: You are a multi-lingual AI assistant. You MUST respond ONLY in ${targetLanguage}. Do not write in English unless ${targetLanguage} is English.`;

    const historyMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: strictSystemPrompt },
    ];

    try {
      const recentHistory = await this.chatRepository.getRecentConversations(studentId, 6);
      recentHistory.forEach((c) => {
        historyMessages.push({
          role: c.role === 'user' ? 'user' : 'assistant',
          content: c.message,
        });
      });
    } catch (historyErr) {
      console.warn('[History Warning]: Proceeding without past history window:', historyErr);
    }

    // 4. WRAP THE PROMPT WITH AN IMMEDIATE TRANSLATION COMMAND
    const languageEnforcedPrompt = `${prompt}\n\n(IMPORTANT: Translate your entire reply into ${targetLanguage} native script. Do NOT output any English text!)`;

    historyMessages.push({ role: 'user', content: languageEnforcedPrompt });

    try {
      const response = await this.groqClient.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: historyMessages,
        temperature: 0.1, // Very low temperature prevents ignoring system instructions
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
      });

      const reply = response.choices[0]?.message?.content?.trim();

      if (!reply) {
        throw new Error('Groq returned an empty response choices array.');
      }

      try {
        await this.chatRepository.saveConversation(studentId, 'model', reply);
      } catch (dbErr) {
        console.warn('[DB Warning]: Failed to log model reply:', dbErr);
      }

      return reply;
    } catch (error: any) {
      console.error('[Groq API Error]:', error?.message || error);
      return `Groq Error: ${error?.message || "I couldn't process that request right now. Please try again! 🙈"}`;
    }
  }
}