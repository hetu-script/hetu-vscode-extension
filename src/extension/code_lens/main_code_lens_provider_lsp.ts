import { CancellationToken, CodeLens, CodeLensProvider, Event, EventEmitter, TextDocument } from "vscode";
import { IAmDisposable, Logger } from "../../shared/interfaces";
import { disposeAll } from "../../shared/utils";
import { fsPath } from "../../shared/utils/fs";
import { lspToRange } from "../../shared/vscode/utils";
import { LspAnalyzer } from "../analysis/analyzer_lsp";

export class LspMainCodeLensProvider implements CodeLensProvider, IAmDisposable {
  private disposables: IAmDisposable[] = [];
  private onDidChangeCodeLensesEmitter: EventEmitter<void> = new EventEmitter<void>();
  public readonly onDidChangeCodeLenses: Event<void> = this.onDidChangeCodeLensesEmitter.event;

  constructor(private readonly logger: Logger, private readonly analyzer: LspAnalyzer) {
    this.disposables.push(this.analyzer.fileTracker.onOutline.listen(() => {
      this.onDidChangeCodeLensesEmitter.fire();
    }));
  }

  public async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[] | undefined> {
    // Without version numbers, the best we have to tell if an outline is likely correct or stale is
    // if its length matches the document exactly.
    const expectedLength = document.getText().length;
    const outline = await this.analyzer.fileTracker.waitForOutlineWithLength(document, expectedLength, token);
    if (!outline || !outline.children || !outline.children.length)
      return;

    const mainFunction = outline.children?.find((o) => o.element.name === "main");
    if (!mainFunction)
      return;

    return [
      new CodeLens(
        lspToRange(mainFunction.range),
        {
          arguments: [document.uri],
          command: "dart.startWithoutDebugging",
          title: "Run",
        },
      ),
      new CodeLens(
        lspToRange(mainFunction.range),
        {
          arguments: [document.uri],
          command: "dart.startDebugging",
          title: "Debug",
        },
      ),
    ];
  }

  public dispose(): any {
    disposeAll(this.disposables);
  }
}
