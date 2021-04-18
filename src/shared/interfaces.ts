import * as child_process from "child_process";
import * as stream from "stream";
import { LogCategory, LogSeverity } from "./enums";
import { UnknownResponse } from "./services/interfaces";
import { WorkspaceContext } from "./workspace";

export interface Sdks {
  readonly version?: string;
}

export interface DartWorkspaceContext extends WorkspaceContext {
  readonly sdks: Sdks;
}

export interface WritableWorkspaceConfig {
  // All fields here should handle undefined, and the default (undefined) state
  // should be what is expected from a standard workspace without any additional
  // config.

  activateDevToolsEagerly?: boolean;
  startDevToolsServerEagerly?: boolean;
  dartSdkHomeLinux?: string;
  dartSdkHomeMac?: string;
  devtoolsActivateScript?: CustomScript;
  devtoolsRunScript?: CustomScript;
  disableAutomaticPackageGet?: boolean;
  disableSdkUpdateChecks?: boolean;
  useLsp?: boolean;
}

export type WorkspaceConfig = Readonly<WritableWorkspaceConfig>;

export interface CustomScript {
  script: string;
  replacesArgs: number;
}

export interface HetuProjectTemplate {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly categories: string[];
  readonly entrypoint: string;
}

export interface Logger {
  info(message: string, category?: LogCategory): void;
  warn(message: SomeError, category?: LogCategory): void;
  error(error: SomeError, category?: LogCategory): void;
}

export type SomeError = string | Error | undefined | { message: string };

export interface LogMessage {
  readonly message: string;
  readonly severity: LogSeverity;
  readonly category: LogCategory;
  toLine(maxLength: number): string;
}

export interface IAmDisposable {
  dispose(): void | Promise<void>;
}

export interface Location {
  startLine: number;
  startColumn: number;
  length: number;
}

export type SpawnedProcess = child_process.ChildProcess & {
  stdin: stream.Writable,
  stdout: stream.Readable,
  stderr: stream.Readable,
};

export interface OpenedFileInformation {
  readonly contents: string;
  readonly selectionOffset: number;
  readonly selectionLength: number;
}
