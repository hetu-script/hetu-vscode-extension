import * as vs from "vscode";

export class DartUriHandler implements vs.UriHandler {

	public async handleUri(uri: vs.Uri): Promise<void> {
		// const handlerPrefix = Object.keys(this.handlers).find((key) => uri.path.startsWith(key));
		// if (handlerPrefix) {
		// 	await this.handlers[handlerPrefix].handle(uri.path.substr(handlerPrefix.length));
		// } else {
			vs.window.showErrorMessage(`No handler for '${uri.path}'. Check you have the latest version of the Dart plugin and try again.`);
		// }
	}
}
