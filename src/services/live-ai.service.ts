import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from '../config/prompt.config.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import { type IAIService } from './ai.interface.js';

export class LiveAIService implements IAIService {
  private chatRepository: ChatRepository;

  constructor() {
    this.chatRepository = new ChatRepository();
  }

  async generateResponse(studentId: number, prompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey || apiKey === 'your_groq_api_key' || apiKey === 'placeholder') {
      throw new Error('GROQ_API_KEY is missing or invalid.');
    }

    // 1. Save user turn to DB
    try {
      await this.chatRepository.saveConversation(studentId, 'user', prompt);
    } catch (dbErr) {
      console.error('[DB Log Error]: Failed to log user prompt:', dbErr);
    }

    // 2. Fetch User Preferences
    let preferenceInstruction = '';
    try {
      const prefs = await this.chatRepository.getUserPreference(studentId);
      if (prefs) {
        preferenceInstruction = `\nUSER PREFERENCES:\n- Preferred Language: ${prefs.preferredLanguage}\n- Learning Style: ${prefs.learningStyle}\nAlways respond using the user's preferred language and learning style.`;
      }
    } catch (prefErr) {
      console.warn('[Preference Warning]: Could not load preferences:', prefErr);
    }

    // 3. Inject history window into prompt with truncation (MAX 10 TURNS)
    const MAX_HISTORY_TURNS = 10;
    let historyMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: `${SYSTEM_PROMPT}${preferenceInstruction}` },
    ];

    try {
      const recentHistory = await this.chatRepository.getRecentConversations(studentId, MAX_HISTORY_TURNS);

      recentHistory.forEach((c) => {
        historyMessages.push({
          role: c.role === 'user' ? 'user' : 'assistant',
          content: c.message,
        });
      });
    } catch (historyErr) {
      console.warn('[History Warning]: Proceeding without past history window:', historyErr);
      historyMessages.push({ role: 'user', content: prompt });
    }

    // CLEAN LOG FOR ITEM 3 VERIFICATION
    console.log('\n=============================================');
    console.log('--- ITEM 3: CONTEXT WINDOW TRUNCATION CHECK ---');
    console.log(`Total messages sent in payload: ${historyMessages.length}`);
    console.log('=============================================\n');

    // 4. Send request to Groq SDK
    try {
      const groq = new Groq({ apiKey });
      const response = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: historyMessages,
        temperature: 0.7,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
      });

      const reply = response.choices[0]?.message?.content?.trim();

      if (!reply) {
        throw new Error('Groq returned an empty response.');
      }

      // 5. Save model turn to DB
      try {
        await this.chatRepository.saveConversation(studentId, 'model', reply);
      } catch (dbErr) {
        console.error('[DB Log Error]: Failed to log model reply:', dbErr);
      }

      return reply;
    } catch (error: any) {
      console.error('[Groq API Error]:', error?.message || error);
      return "Oops! I couldn't process that request right now. Please try again in a moment!";
    }
  }
}