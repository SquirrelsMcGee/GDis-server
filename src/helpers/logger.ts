import { injectable } from "inversify";

export enum LogLevel {
  ALL,
  DEBUG,
  INFO,
  WARN,
  ERROR
}

@injectable()
export class Logger {
  private static currentLevel: LogLevel = LogLevel.DEBUG;

  private source: string = '';

  constructor() { }

  setLevel(level: LogLevel) {
    Logger.currentLevel = level;
  }

  setInfo(source: string) {
    this.source = source;
  }

  debug(message: string, ...optionalParams: unknown[]) {
    if (!this.shouldLog(LogLevel.DEBUG))
      return;
    console.debug(this.formatMessage('DEBUG', message), ...optionalParams);
  }

  info(message: string, ...optionalParams: unknown[]) {
    if (!this.shouldLog(LogLevel.INFO))
      return;
    console.info(this.formatMessage('INFO', message), ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]) {
    if (!this.shouldLog(LogLevel.WARN))
      return;
    console.warn(`\x1b[33m${this.formatMessage('WARN', message)}\x1b[0m`, ...optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]) {
    if (!this.shouldLog(LogLevel.ERROR))
      return;
    console.error(`\x1b[31m${this.formatMessage('ERROR', message)}\x1b[0m`, ...optionalParams);
  }


  private formatMessage(level: string, message: string) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.source}] ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= Logger.currentLevel;
  }
}