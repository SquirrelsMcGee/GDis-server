export class PromiseFactory {
  public static reject(className: string, messages: (string | unknown)[]) {
    return Promise.reject(`[Promise.reject] [${className}] - ${messages.join(' | ')}`);
  }
}