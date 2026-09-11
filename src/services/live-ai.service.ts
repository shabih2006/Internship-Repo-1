import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from '../config/prompt.config.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import { type IAIService } from './ai.interface.js';

export class LiveAIService implements IAIService {
  private chatRepository: ChatRepository;
  private groqClient: Groq | null = null;

  constructor() {
    this.chatRepository = new ChatRepository();
    
    // Initialize Groq client if API key is present
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (apiKey && apiKey !== 'your_groq_api_key' && apiKey !== 'placeholder') {
      this.groqClient = new Groq({ apiKey });
    }
  }

  async generateResponse(studentId: number, prompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey || apiKey === 'your_groq_api_key' || apiKey === 'placeholder') {
      console.error('[Groq Error]: Missing or invalid GROQ_API_KEY in environment variables.');
      return "Groq API key is missing or invalid in your backend .env file! 🔑";
    }

    // Lazy initialization backup in case env vars loaded after constructor
    if (!this.groqClient) {
      this.groqClient = new Groq({ apiKey });
    }

    // 1. Save user turn to DB safely
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
        preferenceInstruction = `\nUSER PREFERENCES:\n- Preferred Language: ${prefs.preferredLanguage}\n- Learning Style: ${prefs.learningStyle}\nAlways respond using the user's preferred language and learning style.`;
      }
    } catch (prefErr) {
      console.warn('[Preference Warning]: Could not load preferences:', prefErr);
    }

    // 3. Inject system prompt & user preferences into history payload
    const MAX_HISTORY_TURNS = 10;
    const historyMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
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
    }

    // Append the CURRENT prompt so Groq actually receives it!
    historyMessages.push({ role: 'user', content: prompt });

    // Context Window Verification Log
    console.log('\n=============================================');
    console.log('--- CONTEXT WINDOW TRUNCATION CHECK ---');
    console.log(`Total messages sent in payload: ${historyMessages.length}`);
    console.log('=============================================\n');

    // 4. Request completion from Groq
    try {
      const response = await this.groqClient.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: historyMessages,
        temperature: 0.7,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
      });

      const reply = response.choices[0]?.message?.content?.trim();

      if (!reply) {
        throw new Error('Groq returned an empty response choices array.');
      }

      // 5. Save model turn to DB safely
      try {
        await this.chatRepository.saveConversation(studentId, 'model', reply);
      } catch (dbErr) {
        console.warn('[DB Warning]: Failed to log model reply:', dbErr);
      }

      return reply;
    } catch (error: any) {
      console.error('[Groq API Error]:', error?.message || error);
      return `Groq Error: ${error?.message || "I couldn't process that request right now. Please try again in a moment! 🙈"}`;
    }
  }
}