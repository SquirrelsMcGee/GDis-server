export enum LogLevel {
  All,
  Errors
}

export class Logger {
  public static Level: LogLevel = LogLevel.All;

  public static error(className: string, msg: any, ...optionalParams: any[]): void {
    console.error(`[ERROR] [${className}] - ${[msg, optionalParams].join(' | ')}`);
  }

  public static log(className: string, msg: any, ...optionalParams: any[]): void {
    if (Logger.Level !== LogLevel.All)
      return;

    console.log(`[INFO] [${className}] - ${[msg, optionalParams].join(' | ')}`);
  }
}