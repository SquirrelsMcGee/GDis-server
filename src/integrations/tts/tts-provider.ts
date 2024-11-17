export interface ITextToSpeechProvider {
  generateSpeech(inputText: string): Promise<void>;
}