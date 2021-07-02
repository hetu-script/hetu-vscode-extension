import { CompletionItem, CompletionItemProvider, DebugConfigurationProvider, DebugSession, DebugSessionCustomEvent, MarkdownString, OutputChannel, RenameProvider, TextDocument, TreeDataProvider, TreeItem, Uri } from "vscode";
import * as lsp from "../analysis/lsp/custom_protocol";
import { AvailableSuggestion, FlutterOutline, Outline } from "../analysis_server_types";
import { Analyzer } from "../analyzer";
import { VersionStatus, VmService, VmServiceExtension } from "../enums";
import { WebClient } from "../fetch";
import { CustomScript, SpawnedProcess } from "../interfaces";
import { EmittingLogger } from "../logging";
import { WorkspaceContext } from "../workspace";
import { Context } from "./workspace";

export interface DebugCommandHandler {
  vmServices: {
    serviceIsRegistered(service: VmService): boolean;
    serviceExtensionIsLoaded(extension: VmServiceExtension): boolean;
  };
  handleDebugSessionStart(session: DebugSession): void;
  handleDebugSessionEnd(session: DebugSession): void;
  handleDebugSessionCustomEvent(e: DebugSessionCustomEvent): void;
  devTools: {
    devtoolsUrl: Thenable<string> | undefined;
  };
}

export interface InternalExtensionApi {
  context: Context;
  currentAnalysis: () => Promise<void>;
  envUtils: {
    openInBrowser(url: string): Promise<boolean>;
  };
  fileTracker: {
    getOutlineFor(file: Uri): Outline | lsp.Outline | undefined;
    getFlutterOutlineFor?: (file: Uri) => FlutterOutline | lsp.FlutterOutline | undefined;
    getLastPriorityFiles?: () => string[];
    getLastSubscribedFiles?: () => string[];
  };
  getLogHeader: () => string;
  getOutputChannel: (name: string) => OutputChannel;
  logger: EmittingLogger;
  nextAnalysis: () => Promise<void>;
  safeToolSpawn: (workingDirectory: string | undefined, binPath: string, args: string[], envOverrides?: { [key: string]: string | undefined }) => SpawnedProcess;
  workspaceContext: WorkspaceContext;
}

export interface DelayedCompletionItem extends LazyCompletionItem {
  autoImportUri: string;
  document: TextDocument;
  enableCommitCharacters: boolean;
  filePath: string;
  insertArgumentPlaceholders: boolean;
  nextCharacter: string;
  offset: number;
  relevance: number;
  replacementLength: number;
  replacementOffset: number;
  suggestion: AvailableSuggestion;
  suggestionSetID: number;
}

// To avoid sending back huge docs for every completion item, we stash some data
// in our own fields (which won't serialise) and then restore them in resolve()
// on an individual completion basis.
export interface LazyCompletionItem extends CompletionItem {
  // tslint:disable-next-line: variable-name
  _documentation?: string | MarkdownString;
}

export interface FlutterSampleSnippet {
  readonly sourcePath: string;
  readonly sourceLine: number;
  readonly package: string;
  readonly library: string;
  readonly element: string;
  readonly id: string;
  readonly file: string;
  readonly description: string;
}
