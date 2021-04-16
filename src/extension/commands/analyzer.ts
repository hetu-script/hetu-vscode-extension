import * as vs from "vscode";
import { Analyzer } from "../../shared/analyzer";
import { Logger } from "../../shared/interfaces";

export class AnalyzerCommands {
  constructor(context: vs.ExtensionContext, private readonly logger: Logger, analyzer: Analyzer) {
    context.subscriptions.push(vs.commands.registerCommand("hetu.restartAnalysisServer", async () => {
      vs.commands.executeCommand("_hetu.reloadExtension");
    }));
  }
}
