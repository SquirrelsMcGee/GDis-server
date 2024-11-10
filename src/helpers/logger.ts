export enum LogLevel {
  None = 0,
  Errors = 1,
  All = 2
}

export class Logger {
  public static Level: LogLevel = LogLevel.None;

  public static error(className: string, msg: any, ...optionalParams: any[]): void {
    if (Logger.Level < LogLevel.Errors)
      return;

    console.error(`[ERROR] [${className}] - ${[msg, optionalParams].join(' | ')}`);
  }

  public static log(className: string, msg: any, ...optionalParams: any[]): void {
    if (Logger.Level < LogLevel.All)
      return;

    console.log(`[INFO] [${className}] - ${[msg, optionalParams].join(' | ')}`);
  }
}