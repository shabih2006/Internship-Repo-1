declare module 'gtts' {
  class gTTS {
    constructor(text: string, lang?: string, debug?: boolean);
    save(file: string, callback?: (err: Error | null, result: any) => void): void;
    stream(lang?: string): any;
  }
  export default gTTS;
}