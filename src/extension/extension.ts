import * as vs from "vscode";
import { dartPlatformName, flutterExtensionIdentifier, HAS_LAST_DEBUG_CONFIG, HAS_LAST_TEST_DEBUG_CONFIG, isWin, IS_LSP_CONTEXT, IS_RUNNING_LOCALLY_CONTEXT, platformDisplayName, PUB_OUTDATED_SUPPORTED_CONTEXT } from "../shared/constants";
import { LogCategory } from "../shared/enums";
import { DartWorkspaceContext, FlutterSdks, FlutterWorkspaceContext, IAmDisposable, Logger, Sdks, WritableWorkspaceConfig } from "../shared/interfaces";
import { captureLogs, EmittingLogger, logToConsole, RingLog } from "../shared/logging";
import { internalApiSymbol } from "../shared/symbols";
import { disposeAll } from "../shared/utils";
import { fsPath } from "../shared/utils/fs";
import { extensionVersion, isDevExtension } from "../shared/vscode/extension_utils";
import { InternalExtensionApi } from "../shared/vscode/interfaces";
import { envUtils, getDartWorkspaceFolders, warnIfPathCaseMismatch } from "../shared/vscode/utils";
import { Context } from "../shared/vscode/workspace";
import { WorkspaceContext } from "../shared/workspace";
import { LspAnalyzer } from "./analysis/analyzer_lsp";
import { getOutputChannel } from "./commands/channels";
import { EditCommands } from "./commands/edit";
import { LspEditCommands } from "./commands/edit_lsp";
import { config } from "./config";
import { LspAnalyzerStatusReporter } from "./lsp/analyzer_status_reporter";
import { LspGoToSuperCommand } from "./lsp/go_to_super";
import { SdkUtils } from "./sdk/utils";
import * as util from "./utils";
import { addToLogHeader, clearLogHeader, getExtensionLogPath, getLogHeader } from "./utils/log";
import { safeToolSpawn } from "./utils/processes";

export const HETU_MODE = { language: "hetu", scheme: "file" };

const PROJECT_LOADED = "hetu-script:anyProjectLoaded";
export const SERVICE_EXTENSION_CONTEXT_PREFIX = "hetu-script:serviceExtension.";
export const SERVICE_CONTEXT_PREFIX = "hetu-script:service.";

let lspAnalyzer: LspAnalyzer;

let showTodos: boolean | undefined;
let previousSettings: string;

const loggers: IAmDisposable[] = [];
let ringLogger: IAmDisposable | undefined;
const logger = new EmittingLogger();

// Keep a running in-memory buffer of last 200 log events we can give to the
// user when something crashed even if they don't have disk-logging enabled.
export const ringLog: RingLog = new RingLog(200);

export async function activate(context: vs.ExtensionContext, isRestart: boolean = false) {
  // Ring logger is only set up once and presist over silent restarts.
  if (!ringLogger)
    ringLogger = logger.onLog((message) => ringLog.log(message.toLine(500)));

  context.subscriptions.push(logToConsole(logger));

  const extContext = Context.for(context);

  // Wire up a reload command that will re-initialise everything.
  context.subscriptions.push(vs.commands.registerCommand("_hetu.reloadExtension", async () => {
    logger.info("Performing silent extension reload...");
    await deactivate(true);
    disposeAll(context.subscriptions);
    await activate(context, true);
    logger.info("Done!");
  }));


  const sdkUtils = new SdkUtils(logger);
  const workspaceContextUnverified = await sdkUtils.scanWorkspace();
  util.logTime("initWorkspace");

  // Set up log files.
  setupLog(config.analyzerLogFile, LogCategory.Analyzer);

  if (!workspaceContextUnverified.sdks.dart || (workspaceContextUnverified.hasAnyFlutterProjects && !workspaceContextUnverified.sdks.flutter)) {
    // Don't set anything else up; we can't work like this!
    return sdkUtils.handleMissingSdks(context, workspaceContextUnverified);
  }

  const workspaceContext = workspaceContextUnverified as DartWorkspaceContext;
  const sdks = workspaceContext.sdks;
  const writableConfig = workspaceContext.config as WritableWorkspaceConfig;

  lspAnalyzer = new LspAnalyzer(logger, sdks, workspaceContext);
  const lspClient = lspAnalyzer.client;
  context.subscriptions.push(lspAnalyzer);

  const activeFileFilters: vs.DocumentFilter[] = [HETU_MODE];

  // TODO: Push the differences into the Analyzer classes so we can have one reporter.
  // tslint:disable-next-line: no-unused-expression
  new LspAnalyzerStatusReporter(lspAnalyzer);

  // Handle config changes so we can reanalyze if necessary.
  context.subscriptions.push(vs.workspace.onDidChangeConfiguration(() => handleConfigurationChange(sdks)));

  // TODO: LSP equivs of the others...
  // Refactors
  // TypeHierarchyCommand
  // context.subscriptions.push(new LspGoToSuperCommand(lspAnalyzer));

  // Set up commands for Dart editors.
  // context.subscriptions.push(new EditCommands());
  // context.subscriptions.push(new LspEditCommands(lspAnalyzer));

  // Warn the user if they've opened a folder with mismatched casing.
  if (vs.workspace.workspaceFolders && vs.workspace.workspaceFolders.length) {
    for (const wf of vs.workspace.workspaceFolders) {
      if (warnIfPathCaseMismatch(logger, fsPath(wf.uri), "the open workspace folder", "re-open the folder using the File Open dialog"))
        break;
    }
  }

  // Handle changes to the workspace.
  // Set the roots, handling project changes that might affect SDKs.
  // context.subscriptions.push(vs.workspace.onDidChangeWorkspaceFolders(async (f) => {
  //   recalculateAnalysisRoots();
  // }));

  return {
    [internalApiSymbol]: {
      analyzer: lspAnalyzer,
      context: extContext,
      currentAnalysis: () => lspAnalyzer.onCurrentAnalysisComplete,
      envUtils,
      fileTracker: lspAnalyzer.fileTracker,
      getLogHeader,
      getOutputChannel,
      initialAnalysis: lspAnalyzer.onInitialAnalysis,
      logger,
      nextAnalysis: () => lspAnalyzer.onNextAnalysisComplete,
      safeToolSpawn,
      workspaceContext,
    } as InternalExtensionApi,
  };
}

function setupLog(logFile: string | undefined, category: LogCategory) {
  if (logFile)
    loggers.push(captureLogs(logger, logFile, getLogHeader(), config.maxLogLineLength, [category]));
}

function buildLogHeaders(logger?: Logger, workspaceContext?: WorkspaceContext) {
  clearLogHeader();
  addToLogHeader(() => `!! PLEASE REVIEW THIS LOG FOR SENSITIVE INFORMATION BEFORE SHARING !!`);
  addToLogHeader(() => ``);
  addToLogHeader(() => `Dart Code extension: ${extensionVersion}`);
  addToLogHeader(() => {
    const ext = vs.extensions.getExtension(flutterExtensionIdentifier)!;
    return `Flutter extension: ${ext.packageJSON.version} (${ext.isActive ? "" : "not "}activated)`;
  });
  addToLogHeader(() => ``);
  addToLogHeader(() => `App: ${vs.env.appName}`);
  addToLogHeader(() => `Version: ${vs.version}`);
  addToLogHeader(() => `Platform: ${platformDisplayName}`);
  if (workspaceContext) {
    addToLogHeader(() => ``);
    addToLogHeader(() => `Workspace type: ${workspaceContext.workspaceTypeDescription}`);
    addToLogHeader(() => `Analyzer type: ${workspaceContext.config.useLsp ? "LSP" : "DAS"}`);
    addToLogHeader(() => `Multi-root?: ${vs.workspace.workspaceFolders && vs.workspace.workspaceFolders.length > 1}`);
    const sdks = workspaceContext.sdks;
    addToLogHeader(() => ``);
    addToLogHeader(() => `Dart SDK:\n    Loc: ${sdks.dart}\n    Ver: ${sdks.dartVersion}`);
    addToLogHeader(() => `Flutter SDK:\n    Loc: ${sdks.flutter}\n    Ver: ${sdks.flutterVersion}`);
  }
  addToLogHeader(() => ``);
  addToLogHeader(() => `HTTP_PROXY: ${process.env.HTTP_PROXY}`);
  addToLogHeader(() => `NO_PROXY: ${process.env.NO_PROXY}`);

  // Any time the log headers are rebuilt, we should re-log them.
  logger?.info(getLogHeader());
}

function handleConfigurationChange(sdks: Sdks) {
  // TODOs
  const newShowTodoSetting = config.showTodos;
  const todoSettingChanged = showTodos !== newShowTodoSetting;
  showTodos = newShowTodoSetting;

  // SDK
  const newSettings = getSettingsThatRequireRestart();
  const settingsChanged = previousSettings !== newSettings;
  previousSettings = newSettings;

  if (settingsChanged) {
    // Delay the restart slightly, because the config change may be transmitted to the LSP server
    // and shutting the server down too quickly results in that trying to write to a closed
    // stream.
    setTimeout(util.promptToReloadExtension, 50);
  }
}

function getSettingsThatRequireRestart() {
  // The return value here is used to detect when any config option changes that requires a project reload.
  // It doesn't matter how these are combined; it just gets called on every config change and compared.
  // Usually these are options that affect the analyzer and need a reload, but config options used at
  // activation time will also need to be included.
  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
  return "CONF-"
    + config.sdkPath
}

export async function deactivate(isRestart: boolean = false): Promise<void> {
  vs.commands.executeCommand("setContext", PROJECT_LOADED, false);
  lspAnalyzer?.dispose();
  if (loggers) {
    await Promise.all(loggers.map((logger) => logger.dispose()));
    loggers.length = 0;
  }
  if (!isRestart) {
    logger.dispose();
  }
}

function setCommandVisiblity(enable: boolean, workspaceContext?: WorkspaceContext) {
  vs.commands.executeCommand("setContext", PROJECT_LOADED, enable);
}