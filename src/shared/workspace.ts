import { EventEmitter } from "./events";
import { IAmDisposable, Sdks, WorkspaceConfig } from "./interfaces";

export class WorkspaceContext implements IAmDisposable {
  public readonly events = new WorkspaceEvents();
  // TODO: Move things from Sdks to this class that aren't related to the SDKs.
  constructor(
    public readonly sdks: Sdks,
    public readonly config: WorkspaceConfig,
    public readonly hasAnyFlutterMobileProjects: boolean,
    public readonly hasAnyWebProjects: boolean,
    public readonly hasAnyStandardDartProjects: boolean,
    public readonly hasProjectsInFuchsiaTree: boolean,
  ) {
  }

  get hasAnyFlutterProjects() { return this.hasAnyFlutterMobileProjects; }
  get shouldLoadFlutterExtension() { return this.hasAnyFlutterProjects; }


  public dispose(): any {
    this.events.dispose();
  }

  // TODO: Since this class is passed around, we may need to make it update itself
  // (eg. if the last Flutter project is removed from the multi-root workspace)?
}

class WorkspaceEvents implements IAmDisposable {
  public readonly onPackageMapChange = new EventEmitter<void>();

  public dispose(): any {
    this.onPackageMapChange.dispose();
  }
}
