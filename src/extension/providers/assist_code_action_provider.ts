import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, CodeActionProviderMetadata, DocumentSelector, Range, TextDocument } from "vscode";
import * as as from "../../shared/analysis_server_types";
import { Logger } from "../../shared/interfaces";
import { fsPath } from "../../shared/utils/fs";
import { DasAnalyzerClient } from "../analysis/analyzer_das";
import { isAnalyzableAndInWorkspace } from "../utils";
import { getKindFor, RankedCodeActionProvider } from "./ranking_code_action_provider";

export class AssistCodeActionProvider implements RankedCodeActionProvider {
	constructor(private readonly logger: Logger, public readonly selector: DocumentSelector, private readonly analyzer: DasAnalyzerClient) { }

	public readonly rank = 10;

	public readonly metadata: CodeActionProviderMetadata = {
		providedCodeActionKinds: [CodeActionKind.Refactor],
	};

	public async provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext, token: CancellationToken): Promise<CodeAction[] | undefined> {
		if (!isAnalyzableAndInWorkspace(document))
			return undefined;

		// If we were only asked for specific action types and that doesn't include
		// refactor (which is all we supply), bail out.
		if (context && context.only && !CodeActionKind.Refactor.contains(context.only))
			return undefined;

		try {
			const startOffset = document.offsetAt(range.start);
			const endOffset = document.offsetAt(range.end);
			const assists = await this.analyzer.editGetAssists({
				file: fsPath(document.uri),
				length: endOffset - startOffset,
				offset: startOffset,
			});

			const allAssists = assists.assists.map((assist) => this.convertResult(document, assist));

			return context.only
				? allAssists.filter((ca) => context.only?.contains(ca.kind!))
				: allAssists;
		} catch (e) {
			this.logger.error(e);
		}
	}

	private convertResult(document: TextDocument, change: as.SourceChange): CodeAction {
		const title = change.message;
		const kind = getKindFor(change.id, CodeActionKind.Refactor);
		const action = new CodeAction(title, kind);
		action.command = {
			arguments: [document, change],
			command: "_dart.applySourceChange",
			title,
		};
		return action;
	}
}
