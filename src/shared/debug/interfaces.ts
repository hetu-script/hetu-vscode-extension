import { DebugProtocol } from "vscode-debugprotocol";
import { WorkspaceConfig } from "../interfaces";

export interface DartSharedArgs {
	debugExternalLibraries: boolean;
	debugSdkLibraries: boolean;
	evaluateGettersInDebugViews: boolean;
	evaluateToStringInDebugViews: boolean;
	maxLogLineLength: number;
	vmServiceLogFile?: string;
	sendLogsToClient?: boolean;
	showDartDeveloperLogs: boolean;
	toolEnv?: { [key: string]: string | undefined };
	debugExtensionBackendProtocol: "sse" | "ws";
	injectedClientProtocol: "sse" | "ws";
}

export interface DartLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments, DartSharedArgs {
	name: string;
	type: string;
	request: string;
	cwd?: string;
	enableAsserts?: boolean;
	console?: "debugConsole" | "terminal";
	dartSdkPath: string;
	env?: { [key: string]: string | undefined };
	program: string;
	args?: string[];
	vmAdditionalArgs?: string[];
	vmServicePort?: number;
	webDaemonLogFile?: string;
	pubTestLogFile?: string;
	showMemoryUsage?: boolean;
	expectSingleTest?: boolean;
}

export interface FileLocation {
	line: number;
	column: number;
}
