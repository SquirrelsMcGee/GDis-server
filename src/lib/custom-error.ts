
export enum ExceptionLevel {
  FATAL,
  NON_FATAL,
}


export class Exception extends Error {
  constructor(public readonly level: ExceptionLevel, message?: string) {
    super(message)
  }

  public get isFatal() {
    return this.level === ExceptionLevel.FATAL;
  }
}

export class FatalException extends Exception {
  constructor(message?: string) {
    super(ExceptionLevel.FATAL, message);
  }
}

export class NonFatalException extends Exception {
  constructor(message?: string) {
    super(ExceptionLevel.NON_FATAL, message);
  }
}