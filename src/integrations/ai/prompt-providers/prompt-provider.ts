/**
 * Generic interface for an LLM prompt provider
 */
export interface IPromptProvider<T> {
  /**
   * Provide a prompt for use in an LLM context
   */
  provide(values?: T): string;
}