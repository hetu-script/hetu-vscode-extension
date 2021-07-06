import * as vs from "vscode";

export function isHetuDocument(document: vs.TextDocument): boolean {
	return document && document.languageId === "hetu";
}

export function getActiveHetuEditor(): vs.TextEditor | undefined {
	const editor = vs.window.activeTextEditor;
	if (!editor || editor.document.languageId !== "hetu")
		return undefined;
	return editor;
}
