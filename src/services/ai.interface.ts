export interface IAIService {
  generateResponse(studentId: number, prompt: string, targetLanguage?: string): Promise<string>;
}