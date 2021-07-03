import * as fs from "fs";
import * as path from "path";
import { extensions, Uri } from "vscode";
import { hetuscriptExtensionIdentifier, dartCodeExtensionIdentifier, flutterExtensionIdentifier } from "../constants";

export const extensionPath = getExtensionPath();
export const extensionVersion = getExtensionVersion();
export const vsCodeVersionConstraint = getVsCodeVersionConstraint();
export const isDevExtension = checkIsDevExtension();
export const hasFlutterExtension = checkHasFlutterExtension();
export const docsIconPathFormat = Uri.file(path.join(extensionPath, "media/doc-icons/")).toString() + "$1%402x.png";

export function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file).toString());
}

function getExtensionPath(): string {
  const ext = extensions.getExtension(hetuscriptExtensionIdentifier)!;
  return ext.extensionPath;
}

function getExtensionVersion(): string {
  const packageJson = readJson(path.join(extensionPath, "package.json"));
  return packageJson.version;
}

function getVsCodeVersionConstraint(): string {
  const packageJson = readJson(path.join(extensionPath, "package.json"));
  return packageJson.engines.vscode;
}

function checkIsDevExtension() {
  return extensionVersion.endsWith("-dev");
}

export function checkHasDartExtension() {
  return extensions.getExtension(dartCodeExtensionIdentifier) !== undefined;
}

export function checkHasFlutterExtension() {
  return extensions.getExtension(flutterExtensionIdentifier) !== undefined;
}
