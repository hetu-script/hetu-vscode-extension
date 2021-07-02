import { CancellationToken, TextDocument, Uri, workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { FlutterOutline, FlutterOutlineParams, Outline, OutlineParams, PublishFlutterOutlineNotification, PublishOutlineNotification } from "../../shared/analysis/lsp/custom_protocol";
import { EventEmitter } from "../../shared/events";
import { IAmDisposable, Logger } from "../../shared/interfaces";
import { disposeAll } from "../../shared/utils";
import { fsPath } from "../../shared/utils/fs";
import { waitFor } from "../../shared/utils/promises";
import { lspToPosition } from "../../shared/vscode/utils";
import { WorkspaceContext } from "../../shared/workspace";
import { locateBestProjectRoot } from "../project";
import * as util from "../utils";

export class LspFileTracker implements IAmDisposable {
	private disposables: IAmDisposable[] = [];
	private readonly outlines: { [key: string]: Outline } = {};
	private readonly flutterOutlines: { [key: string]: FlutterOutline } = {};
	private readonly pubRunTestSupport: { [key: string]: boolean } = {};

	protected readonly onOutlineEmitter = new EventEmitter<OutlineParams>();
	public readonly onOutline = this.onOutlineEmitter.event;
	protected readonly onFlutterOutlineEmitter = new EventEmitter<FlutterOutlineParams>();
	public readonly onFlutterOutline = this.onFlutterOutlineEmitter.event;

	constructor(private readonly logger: Logger, private readonly analyzer: LanguageClient, private readonly wsContext: WorkspaceContext) {
		// tslint:disable-next-line: no-floating-promises
		analyzer.onReady().then(() => {
			this.analyzer.onNotification(PublishOutlineNotification.type, (n) => {
				const filePath = fsPath(Uri.parse(n.uri));
				this.outlines[filePath] = n.outline;
				this.onOutlineEmitter.fire(n);
			});
		});
	}

	public getOutlineFor(file: { fsPath: string } | string): Outline | undefined {
		return this.outlines[fsPath(file)];
	}
	
	// TODO: Change this to withVersion when server sends versions.
	public async waitForOutlineWithLength(document: TextDocument, length: number, token: CancellationToken): Promise<Outline | undefined> {
		return waitFor(() => {
			const outline = this.outlines[fsPath(document.uri)];
			return outline && document.offsetAt(lspToPosition(outline.range.end)) === length ? outline : undefined;
		}, 50, 5000, token);
	}

	public dispose(): any {
		disposeAll(this.disposables);
	}
}
