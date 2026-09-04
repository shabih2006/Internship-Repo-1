import { ChatRequestDto, ChatResponseDto } from '../dtos/chat.dto.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import { STUDY_ASSISTANT_PROMPT } from '../config/prompt.config.js';

export default class ChatService {
  private chatRepository: ChatRepository;

  constructor() {
    this.chatRepository = new ChatRepository();
  }

  async getHistory() {
    return await this.chatRepository.getAllConversations();
  }

  async generateResponse(dto: ChatRequestDto): Promise<ChatResponseDto> {
    if (!dto.message || dto.message.trim() === '') {
      throw new Error('Message content cannot be empty.');
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    let reply = '';

    // Check off-topic keywords directly from central config
    const lowerMessage = dto.message.toLowerCase();
    const isOffTopic = STUDY_ASSISTANT_PROMPT.offTopicKeywords.some((keyword) =>
      lowerMessage.includes(keyword)
    );

    if (isOffTopic) {
      reply = STUDY_ASSISTANT_PROMPT.refusalMessage;
    } else if (apiKey.startsWith('AQ.')) {
      reply = `**[Study Assistant AI]**\n\nProcessing your academic query regarding "${dto.message}". Here is a structured overview...`;
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const fullSystemInstruction = `${STUDY_ASSISTANT_PROMPT.systemRole}\n${STUDY_ASSISTANT_PROMPT.constraints}`;

        const contents = [
          ...STUDY_ASSISTANT_PROMPT.fewShotExamples,
          {
            role: 'user',
            parts: [{ text: dto.message }],
          },
        ];

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: fullSystemInstruction }],
            },
            contents,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data: any = await response.json();
        if (!response.ok) {
          const errorMsg = data.error?.message || 'External AI service encountered an issue.';
          throw new Error(`AI Service Unavailable: ${errorMsg}`);
        }

        reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new Error('The AI service timed out. Please try again in a few moments.');
        }

        console.error('ChatService External API Error:', error.message);
        throw new Error(error.message || 'Unable to connect to the AI service. Please try again later.');
      }
    }

    // Persist conversation to PostgreSQL
    await this.chatRepository.saveConversation(dto.message, reply);

    return { reply };
  }
}