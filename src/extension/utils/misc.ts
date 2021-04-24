import { promptToReloadExtension } from "../utils";

export type NullAsUndefined<T> = null extends T ? Exclude<T, null> | undefined : T;

export function nullToUndefined<T>(value: T): NullAsUndefined<T> {
  return (value === null ? undefined : value) as NullAsUndefined<T>;
}

let isShowingAnalyzerError = false;

export function reportAnalyzerTerminatedWithError(duringStartup: boolean = false) {
  if (isShowingAnalyzerError)
    return;
  isShowingAnalyzerError = true;
  const message = duringStartup
    ? "The Hetu Analyzer could not be started."
    : "The Hetu Analyzer has terminated.";
  // tslint:disable-next-line: no-floating-promises
  promptToReloadExtension(message, undefined, true).then(() => isShowingAnalyzerError = false);
}
