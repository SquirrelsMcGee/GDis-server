import { NonFatalException } from "../lib/custom-error";
import { PreconditionInfo } from "./preconditions";

export type AnyArgs<Returntype> = (...args: unknown[]) => Promise<Returntype>

/**
 * Decorator function to assert a set of preconditions before running a command
 */
export async function runWithPreconditions<ReturnType, T extends AnyArgs<ReturnType>>(
  this: unknown,
  method: T,
  conditions: PreconditionInfo[]
) {
  return async function (this: any, ...args: Parameters<T>) {
    // Execute each precondition with the captured arguments
    for (const condition of conditions) {
      const result = await condition.execute(...args);
      if (!result)
        throw new NonFatalException(`Precondition failed: ${condition.name}`);
    }

    // Apply `args` to the `method` with the correct `this` context
    return method.apply(this, args);
  }.apply(this);
}
