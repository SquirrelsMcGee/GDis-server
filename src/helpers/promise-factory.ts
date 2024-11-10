export class PromiseFactory {
  /**
   * Create a rejected promise
   * @param className Source class
   * @param messages Array of messages to join to the promise reason
   */
  public static reject(className: string, messages: (string | unknown)[]) {
    return Promise.reject(`[Promise.reject] [${className}] - ${messages.join(' | ')}`);
  }
}