export interface ISpeechToTextProvider {
  /**
   * Generate transcript for a given file
   */
  generateTranscript(filename: string): Promise<string>;
}
