export interface IAIService {
  generateResponse(studentId: number, prompt: string): Promise<string>;
}