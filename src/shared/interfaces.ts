import * as child_process from "child_process";
import * as stream from "stream";
import { LogCategory, LogSeverity } from "./enums";
import { UnknownResponse } from "./services/interfaces";
import { WorkspaceContext } from "./workspace";

export interface SdkSearchResults {
  sdkPath: string | undefined;
  candidatePaths: string[];
}

export interface Sdks {
  readonly dart?: string;
  readonly dartVersion?: string;
  readonly flutter?: string;
  readonly flutterVersion?: string;
  readonly dartSdkIsFromFlutter: boolean;
}

export interface DartSdks extends Sdks {
  readonly dart: string;
}

export interface FlutterSdks extends Sdks {
  readonly flutter: string;
}

export interface DartWorkspaceContext extends WorkspaceContext {
  readonly sdks: DartSdks;
}

export interface FlutterWorkspaceContext extends WorkspaceContext {
  readonly sdks: FlutterSdks;
}

export interface WritableWorkspaceConfig {
  // All fields here should handle undefined, and the default (undefined) state
  // should be what is expected from a standard workspace without any additional
  // config.

  dartSdkHomeLinux?: string;
  dartSdkHomeMac?: string;
  flutterSdkHome?: string;
  flutterVersionFile?: string;
}

export interface WritableWorkspaceConfig {
  // All fields here should handle undefined, and the default (undefined) state
  // should be what is expected from a standard workspace without any additional
  // config.

  startDevToolsServerEagerly?: boolean;
  disableAutomaticPackageGet?: boolean;
  disableSdkUpdateChecks?: boolean;
  flutterDaemonScript?: CustomScript;
  flutterDoctorScript?: CustomScript;
  flutterRunScript?: CustomScript;
  flutterScript?: CustomScript;
  flutterSdkHome?: string;
  flutterTestScript?: CustomScript;
  flutterVersion?: string;
  useLsp?: boolean;
  useVmForTests?: boolean;
  forceFlutterWorkspace?: boolean;
  forceFlutterDebug?: boolean;
  skipFlutterInitialization?: boolean;
  skipTargetFlag?: boolean;
}

export type WorkspaceConfig = Readonly<WritableWorkspaceConfig>;
export interface CustomScript {
  script: string;
  replacesArgs: number;
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
