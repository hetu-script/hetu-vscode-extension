export const maxStackFrameMessageLength = 1000;
const containsStackFramePattern = new RegExp(`(?:dart:|package:|\\.dart)`);
const stackFramePattern = new RegExp(`\\(*((?:dart|package):[\\w\\-]+|\\S*\\.dart)(?:[: ](\\d+):(\\d+))?\\)*(\\s+.*)?$`, "m");

export function mayContainStackFrame(message: string) {
	return containsStackFramePattern.test(message);
}

export function parseStackFrame(message: string): MessageWithUriData | undefined {
	// Messages over 1000 characters are unlikely to be stack frames, so short-cut
	// and assume no match.
	if (!message || message.length > maxStackFrameMessageLength)
		return undefined;

	const match = stackFramePattern.exec(message);
	if (match) {
		const prefix = message.substr(0, match.index).trim();
		const suffix = (match[4] || "").trim();
		const col = match[3] !== undefined ? parseInt(match[3]) : undefined;
		const line = match[2] !== undefined ? parseInt(match[2]) : undefined;

		// Only consider this a stack frame if this has either a prefix or suffix, otherwise
		// it's likely just a printed filename or a line like "Launching lib/foo.dart on ...".
		const isStackFrame = !!prefix !== !!suffix;

		// Text should only be replaced if there was a line/col and only one of prefix/suffix, to avoid
		// replacing user prints of filenames or text like "Launching lib/foo.dart on Chrome".
		const textReplacement = (isStackFrame && line && col)
			? (prefix || suffix)
			: undefined;
		const text = `${textReplacement || message}`.trim();


		return {
			col,
			isStackFrame,
			line,
			sourceUri: match[1],
			text,
		} as MessageWithUriData;
	}
	return undefined;
}

export interface MessageWithUriData {
	col: number | undefined;
	isStackFrame: boolean;
	line: number | undefined;
	text: string;
	sourceUri: string;
}
