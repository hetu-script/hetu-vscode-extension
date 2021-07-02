import * as vs from "vscode";
import { Analyzer } from "../../shared/analyzer";
import { Logger } from "../../shared/interfaces";

// Must be global, as all classes are created during an extension restart.
// let forcedReanalyzeCount = 0;

export class AnalyzerCommands {
  constructor(context: vs.ExtensionContext, private readonly logger: Logger, analyzer: Analyzer) {
		context.subscriptions.push(vs.commands.registerCommand("dart.restartAnalysisServer", async () => {
			// forcedReanalyzeCount++;
			// if (forcedReanalyzeCount === 10)
			// 	this.showServerRestartPrompt().catch((e) => logger.error(e));
			// analytics.logAnalyzerRestart();
			vs.commands.executeCommand("_dart.reloadExtension");
		}));
  }
  
	// private async showServerRestartPrompt(): Promise<void> {
	// 	const choice = await vs.window.showInformationMessage("Needing to reanalyze a lot? Please consider filing a bug with a server instrumentation log", issueTrackerAction);
	// 	if (choice === issueTrackerAction)
	// 		await envUtils.openInBrowser(issueTrackerUri, this.logger);
	// }
}
