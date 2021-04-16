import * as vs from "vscode";
import { IAmDisposable, Logger, Sdks } from "../shared/interfaces";
import { EmittingLogger } from "../shared/logging";
import { internalApiSymbol } from "../shared/symbols";
import { disposeAll } from "../shared/utils";
import { fsPath } from "../shared/utils/fs";
import { InternalExtensionApi } from "../shared/vscode/interfaces";
import { HetuUriHandler } from "../shared/vscode/uri_handlers/uri_handler";
import { getDartWorkspaceFolders, warnIfPathCaseMismatch } from "../shared/vscode/utils";
import { Context } from "../shared/vscode/workspace";
import { LspAnalyzer } from "./analysis/analyzer_lsp";
import { getOutputChannel } from "./commands/channels";
import { EditCommands } from "./commands/edit";
import { LspEditCommands } from "./commands/edit_lsp";
import { config } from "./config";
import { LspAnalyzerStatusReporter } from "./lsp/analyzer_status_reporter";
import { LspGoToSuperCommand } from "./lsp/go_to_super";
import { handleNewProjects, showUserPrompts } from "./user_prompts";
import * as util from "./utils";
import { getLogHeader } from "./utils/log";
import { safeToolSpawn } from "./utils/processes";

const HETU_MODE = { language: "hetu", scheme: "file" };

const PROJECT_LOADED = "hetu-script:anyProjectLoaded";
export const SERVICE_EXTENSION_CONTEXT_PREFIX = "hetu-script:serviceExtension.";
export const SERVICE_CONTEXT_PREFIX = "hetu-script:service.";

let lspAnalyzer: LspAnalyzer;
let analysisRoots: string[] = [];

let previousSettings: string;

const loggers: IAmDisposable[] = [];
const logger = new EmittingLogger();

export async function activate(context: vs.ExtensionContext, isRestart: boolean = false) {

  const extContext = Context.for(context);

  util.logTime("Code called activate");

  // Wire up a reload command that will re-initialise everything.
  context.subscriptions.push(vs.commands.registerCommand("_hetu.reloadExtension", async () => {
    logger.info("Performing silent extension reload...");
    await deactivate(true);
    disposeAll(context.subscriptions);
    await activate(context, true);
    logger.info("Done!");
  }));

  // Handle new projects before creating the analyer to avoid a few issues with
  // showing errors while packages are fetched, plus issues like
  // https://github.com/Dart-Code/Dart-Code/issues/2793 which occur if the analyzer
  // is created too early.
  if (!isRestart)
    await handleNewProjects(logger, extContext);

  lspAnalyzer = new LspAnalyzer(logger);
  const lspClient = (lspAnalyzer as LspAnalyzer).client;
  context.subscriptions.push(lspAnalyzer);

  const activeFileFilters: vs.DocumentFilter[] = [HETU_MODE];

  // TODO: Push the differences into the Analyzer classes so we can have one reporter.
  // tslint:disable-next-line: no-unused-expression
  new LspAnalyzerStatusReporter(lspAnalyzer);

  // Handle config changes so we can reanalyze if necessary.
  context.subscriptions.push(vs.workspace.onDidChangeConfiguration(() => handleConfigurationChange()));

  // Register URI handler.
  context.subscriptions.push(vs.window.registerUriHandler(new HetuUriHandler()));

  if (lspClient && lspAnalyzer) {
    // TODO: LSP equivs of the others...
    // Refactors
    // TypeHierarchyCommand
    context.subscriptions.push(new LspGoToSuperCommand(lspAnalyzer));
  }

  // Set up commands for Dart editors.
  context.subscriptions.push(new EditCommands());
  context.subscriptions.push(new LspEditCommands(lspAnalyzer));

  // Warn the user if they've opened a folder with mismatched casing.
  if (vs.workspace.workspaceFolders && vs.workspace.workspaceFolders.length) {
    for (const wf of vs.workspace.workspaceFolders) {
      if (warnIfPathCaseMismatch(logger, fsPath(wf.uri), "the open workspace folder", "re-open the folder using the File Open dialog"))
        break;
    }
  }

  // Handle changes to the workspace.
  // Set the roots, handling project changes that might affect SDKs.
  context.subscriptions.push(vs.workspace.onDidChangeWorkspaceFolders(async (f) => {
    recalculateAnalysisRoots();
  }));


  return {
    [internalApiSymbol]: {
      analyzer: lspAnalyzer,
      logger,
      context: extContext,
      currentAnalysis: () => lspAnalyzer.onCurrentAnalysisComplete,
      fileTracker: lspAnalyzer.fileTracker,
      getLogHeader,
      getOutputChannel,
      initialAnalysis: lspAnalyzer.onInitialAnalysis,
      nextAnalysis: () => lspAnalyzer.onNextAnalysisComplete,
      safeToolSpawn,
    } as InternalExtensionApi,
  };
}

function recalculateAnalysisRoots() {
  const workspaceFolders = getDartWorkspaceFolders();
  analysisRoots = workspaceFolders.map((w) => fsPath(w.uri));
}

function handleConfigurationChange() {

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
