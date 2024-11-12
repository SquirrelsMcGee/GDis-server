export enum LogLevel {
  None = 0,
  Errors = 1,
  All = 2
}

export class Logger {
  public static Level: LogLevel = LogLevel.All;

  public static error(className: string, msg: any, ...optionalParams: any[]): void {
    if (Logger.Level < LogLevel.Errors)
      return;

    console.error(`\x1b[31m [ERROR] [${className}] - ${[msg, optionalParams].join(' | ')} \x1b[0m`);
  }

  public static log(className: string, msg: any, ...optionalParams: any[]): void {
    if (Logger.Level < LogLevel.All)
      return;

    console.log(`\x1b[33m [INFO] [${className}] - ${[msg, optionalParams].join(' | ')} \x1b[0m`);
  }
}