import { versionIsAtLeast } from "../../shared/utils";

export class HetuCapabilities {
	public static get empty() { return new HetuCapabilities("0.0.0"); }

	public version: string;

	constructor(hetuVersion: string) {
		this.version = hetuVersion;
	}

	// get includesSourceForSdkLibs() { return versionIsAtLeast(this.version, "2.2.1") && !this.version.startsWith("2.10."); }
}
