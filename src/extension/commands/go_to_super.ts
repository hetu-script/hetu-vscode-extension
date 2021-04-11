import * as vs from "vscode";
import { disposeAll } from "../../shared/utils";
import { fsPath } from "../../shared/utils/fs";
import { showCode, toRangeOnLine } from "../../shared/vscode/utils";
import { DasAnalyzer } from "../analysis/analyzer_das";
import * as editors from "../editors";
import { findNearestOutlineNode } from "../utils/vscode/outline";

export class GoToSuperCommand implements vs.Disposable {
	private disposables: vs.Disposable[] = [];

	constructor(private readonly analyzer: DasAnalyzer) {
		this.disposables.push(vs.commands.registerCommand("dart.goToSuper", this.goToSuper, this));
	}

	private async goToSuper(): Promise<void> {
		const editor = editors.getActiveDartEditor();
		if (!editor) {
			vs.window.showWarningMessage("No active Dart editor.");
			return;
		}

		const document = editor.document;
		const position = editor.selection.start;

		const outlineNode = findNearestOutlineNode(this.analyzer.fileTracker, document, position);
		const offset = outlineNode && outlineNode.element && outlineNode.element.location
			? outlineNode.element.location.offset
			: document.offsetAt(position);

		const hierarchy = await this.analyzer.client.searchGetTypeHierarchy({
			file: fsPath(document.uri),
			offset,
			superOnly: true,
		});

		if (!hierarchy || !hierarchy.hierarchyItems || !hierarchy.hierarchyItems.length || hierarchy.hierarchyItems.length === 1)
			return;

		// The first item is the current node, so skip that one and walk up till we find a matching member.
		const isClass = !hierarchy.hierarchyItems[0].memberElement;
		const item = hierarchy.hierarchyItems.slice(1).find((h) => isClass ? !!h.classElement : !!h.memberElement);
		const element = isClass ? item && item.classElement : item && item.memberElement;

		if (!element || !element.location)
			return;

		const elementDocument = await vs.workspace.openTextDocument(element.location.file);
		const elementEditor = await vs.window.showTextDocument(elementDocument);
		const range = toRangeOnLine(element.location);
		showCode(elementEditor, range, range, range);
	}

	public dispose(): any {
		disposeAll(this.disposables);
	}
}
