import * as path from "path";
import * as stream from "stream";
import { CancellationToken, CodeActionContext, CompletionContext, CompletionItem, CompletionItemKind, MarkdownString, workspace, Position, Range, TextDocument, window } from "vscode";
import { ExecuteCommandSignature, HandleWorkDoneProgressSignature, LanguageClientOptions, Location, Middleware, ProgressToken, ProvideCodeActionsSignature, ProvideCompletionItemsSignature, ProvideHoverSignature, ResolveCompletionItemSignature, TextDocumentPositionParams, WorkDoneProgressBegin, WorkDoneProgressEnd, WorkDoneProgressReport, WorkspaceEdit } from "vscode-languageclient";
import { LanguageClient, StreamInfo } from "vscode-languageclient/node";
import { AnalyzerStatusNotification, CompleteStatementRequest, DiagnosticServerRequest, ReanalyzeRequest, SuperRequest } from "../../shared/analysis/lsp/custom_protocol";
import { Analyzer } from "../../shared/analyzer";
import { hetuLSPPath, dartVMPath, validClassNameRegex, validMethodNameRegex } from "../../shared/constants";
import { LogCategory } from "../../shared/enums";
import { DartSdks, Logger } from "../../shared/interfaces";
import { CategoryLogger } from "../../shared/logging";
import { WorkspaceContext } from "../../shared/workspace";
import { config } from "../config";
import { HETU_MODE } from "../extension";
import { reportAnalyzerTerminatedWithError } from "../utils/misc";
import { safeToolSpawn } from "../utils/processes";
import { getAnalyzerArgs } from "./analyzer";
import { LspFileTracker } from "./file_tracker_lsp";

export class LspAnalyzer extends Analyzer {
  public readonly client: LanguageClient;
  public readonly fileTracker: LspFileTracker;

  constructor(logger: Logger, sdks: DartSdks, wsContext: WorkspaceContext) {
    super(new CategoryLogger(logger, LogCategory.Analyzer));
    this.client = createClient(this.logger, sdks, wsContext, this.buildMiddleware());
    this.fileTracker = new LspFileTracker(logger, this.client, wsContext);
    this.disposables.push(this.client.start());
    this.disposables.push(this.fileTracker);

    // tslint:disable-next-line: no-floating-promises
    this.client.onReady().then(() => {
      // Reminder: These onNotification calls only hold ONE handler!
      // https://github.com/microsoft/vscode-languageserver-node/issues/174
      // TODO: Remove this once Dart/Flutter stable LSP servers are using $/progress.
      this.client.onNotification(AnalyzerStatusNotification.type, (params) => {
        this.onAnalysisStatusChangeEmitter.fire({ isAnalyzing: params.isAnalyzing });
      });
      this.onReadyCompleter.resolve();
    });
  }

  private buildMiddleware(): Middleware {
    return {
      handleWorkDoneProgress: (token: ProgressToken, params: WorkDoneProgressBegin | WorkDoneProgressReport | WorkDoneProgressEnd, next: HandleWorkDoneProgressSignature) => {
        if (params.kind === "begin")
          this.onAnalysisStatusChangeEmitter.fire({ isAnalyzing: true, suppressProgress: true });
        else if (params.kind === "end")
          this.onAnalysisStatusChangeEmitter.fire({ isAnalyzing: false, suppressProgress: true });

        next(token, params);
      },

      resolveCompletionItem: (item: CompletionItem, token: CancellationToken, next: ResolveCompletionItemSignature) => {
        return next(item, token);
      },

      provideHover: async (document: TextDocument, position: Position, token: CancellationToken, next: ProvideHoverSignature) => {
        const item = await next(document, position, token);
        return item;
      },

      executeCommand: async (command: string, args: any[], next: ExecuteCommandSignature) => {
        if (command === "refactor.perform") {
          const expectedCount = 6;
          if (args && args.length === expectedCount) {
            const refactorFailedErrorCode = -32011;
            const refactorKind = args[0];
            const optionsIndex = 5;
            // Intercept EXTRACT_METHOD and EXTRACT_WIDGET to prompt the user for a name, since
            // LSP doesn't currently allow us to prompt during a code-action invocation.
            let name: string | undefined;
            switch (refactorKind) {
              case "EXTRACT_METHOD":
                name = await window.showInputBox({
                  prompt: "Enter a name for the method",
                  validateInput: (s) => validMethodNameRegex.test(s) ? undefined : "Enter a valid method name",
                  value: "newMethod",
                });
                if (!name)
                  return;
                args[optionsIndex] = Object.assign({}, args[optionsIndex], { name });
                break;
              case "EXTRACT_WIDGET":
                name = await window.showInputBox({
                  prompt: "Enter a name for the widget",
                  validateInput: (s) => validClassNameRegex.test(s) ? undefined : "Enter a valid widget name",
                  value: "NewWidget",
                });
                if (!name)
                  return;
                args[optionsIndex] = Object.assign({}, args[optionsIndex], { name });
                break;
            }

            // The server may return errors for things like invalid names, so
            // capture the errors and present the error better if it's a refactor
            // error.
            try {
              return await next(command, args);
            } catch (e) {
              if (e?.code === refactorFailedErrorCode) {
                window.showErrorMessage(e.message);
                return;
              } else {
                throw e;
              }
            }
          }
        }
        return next(command, args);
      },
    };
  }

  public async getDiagnosticServerPort(): Promise<{ port: number }> {
    return this.client.sendRequest(DiagnosticServerRequest.type);
  }

  public async forceReanalyze(): Promise<void> {
    try {
      return await this.client.sendRequest(ReanalyzeRequest.type);
    } catch (e) {
      window.showErrorMessage("Reanalyze is not supported by this version of the Dart SDK's LSP server.");
    }
  }

  public async getSuper(params: TextDocumentPositionParams): Promise<Location | null> {
    return this.client.sendRequest(
      SuperRequest.type,
      params,
    );
  }

  public async completeStatement(params: TextDocumentPositionParams): Promise<WorkspaceEdit | null> {
    return this.client.sendRequest(
      CompleteStatementRequest.type,
      params,
    );
  }
}

function createClient(logger: Logger, sdks: DartSdks, wsContext: WorkspaceContext, middleware: Middleware): LanguageClient {
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    // documentSelector: [{ scheme: 'file', language: 'plaintext' }],
    // synchronize: {
    //   // Notify the server about file changes to '.clientrc files contained in the workspace
    //   fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    // }
    initializationOptions: {
      // 	onlyAnalyzeProjectsWithOpenFiles: true,
      // closingLabels: config.closingLabels,
      // outline: true,
      // suggestFromUnimportedLibraries: config.autoImportCompletions,
    },
    middleware,
    outputChannelName: "LSP",
  };

  const client = new LanguageClient(
    "hetuLanguageServer",
    "Hetu Language Server",
    () => spawnServer(logger, sdks),
    clientOptions,
  );

  return client;
}

function spawnServer(logger: Logger, sdks: DartSdks): Promise<StreamInfo> {
  // TODO: Replace with constructing an Analyzer that passes LSP flag (but still reads config
  // from paths etc) and provide it's process.
  const vmPath = path.join(sdks.dart, dartVMPath);
  // const args = getAnalyzerArgs(logger, sdks);
  const hetuLangServerPath = path.join(__dirname, hetuLSPPath);
  const args = ['run', hetuLangServerPath];

  logger.info(`Executing command: [${vmPath} run ${hetuLangServerPath}]`);
  const process = safeToolSpawn(undefined, vmPath, args);
  logger.info(`    PID: ${process.pid}`);

  const reader = process.stdout.pipe(new LoggingTransform(logger, "<=="));
  const writer = new LoggingTransform(logger, "==>");
  writer.pipe(process.stdin);

  process.stderr.on("data", (data) => logger.error(data.toString()));
  process.on("exit", (code, signal) => {
    if (code)
      reportAnalyzerTerminatedWithError();
  });

  return Promise.resolve({ reader, writer });
}

class LoggingTransform extends stream.Transform {
  constructor(private readonly logger: Logger, private readonly prefix: string, opts?: stream.TransformOptions) {
    super(opts);
  }
  public _transform(chunk: any, encoding: BufferEncoding, callback: () => void): void {
    this.logger.info(`${this.prefix} ${chunk}`);
    this.push(chunk, encoding);
    callback();
  }
}
