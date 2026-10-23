/**
 * Minimal stand-in for the `vscode` module, enough to run the linter, formatter and
 * inlay hint code under plain Node. setup.ts makes `require('vscode')` resolve here.
 */

export class Position {
    constructor(public readonly line: number, public readonly character: number) {}

    isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character;
    }
}

export class Range {
    public readonly start: Position;
    public readonly end: Position;

    constructor(start: Position | number, end: Position | number, endLine?: number, endCharacter?: number) {
        if (typeof start === 'number') {
            this.start = new Position(start, end as number);
            this.end = new Position(endLine as number, endCharacter as number);
        } else {
            this.start = start;
            this.end = end as Position;
        }
    }

    get isEmpty(): boolean {
        return this.start.isEqual(this.end);
    }
}

export class Selection extends Range {
    constructor(public readonly anchor: Position, public readonly active: Position) {
        super(anchor, active);
    }
}

export enum DiagnosticSeverity { Error = 0, Warning = 1, Information = 2, Hint = 3 }

export class Diagnostic {
    source?: string;
    code?: string | number;

    constructor(public range: Range, public message: string, public severity: DiagnosticSeverity = DiagnosticSeverity.Error) {}
}

export class Location {
    constructor(public uri: unknown, public range: Range | Position) {}
}

export class MarkdownString {
    constructor(public value = '') {}

    appendMarkdown(value: string): this {
        this.value += value;
        return this;
    }

    appendText(value: string): this {
        this.value += value;
        return this;
    }

    appendCodeblock(value: string, language = ''): this {
        this.value += `\n\`\`\`${language}\n${value}\n\`\`\`\n`;
        return this;
    }
}

export enum InlayHintKind { Type = 1, Parameter = 2 }

export class InlayHint {
    tooltip?: string | MarkdownString;
    paddingLeft?: boolean;
    paddingRight?: boolean;

    constructor(public position: Position, public label: string, public kind?: InlayHintKind) {}
}

export class ThemeColor {
    constructor(public readonly id: string) {}
}

export class CancellationTokenSource {
    token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) };
    cancel(): void {}
    dispose(): void {}
}

export const Uri = {
    file: (fsPath: string) => ({ scheme: 'file', fsPath, path: fsPath, toString: () => `file://${fsPath}` })
};

export enum ViewColumn { Active = -1 }
export enum TextEditorRevealType { InCenterIfOutsideViewport = 2 }

class DiagnosticCollection {
    private readonly entries = new Map<string, Diagnostic[]>();

    set(uri: { toString(): string }, diagnostics: Diagnostic[]): void {
        this.entries.set(uri.toString(), diagnostics);
    }

    get(uri: { toString(): string }): Diagnostic[] | undefined {
        return this.entries.get(uri.toString());
    }

    delete(uri: { toString(): string }): void {
        this.entries.delete(uri.toString());
    }

    clear(): void {
        this.entries.clear();
    }

    dispose(): void {}
}

const noopEvent = () => ({ dispose() {} });
const noop = () => undefined;

export const languages = {
    createDiagnosticCollection: () => new DiagnosticCollection()
};

export const window = {
    activeTextEditor: undefined,
    visibleTextEditors: [],
    createOutputChannel: () => ({ trace: noop, debug: noop, info: noop, warn: noop, error: noop, appendLine: noop, dispose: noop }),
    showErrorMessage: noop,
    showWarningMessage: noop,
    onDidChangeActiveTextEditor: noopEvent,
    onDidChangeVisibleTextEditors: noopEvent
};

export const workspace = {
    getConfiguration: () => ({ get: <T>(_key: string, defaultValue?: T) => defaultValue }),
    onDidOpenTextDocument: noopEvent,
    onDidSaveTextDocument: noopEvent,
    onDidChangeTextDocument: noopEvent,
    onDidCloseTextDocument: noopEvent,
    onDidChangeConfiguration: noopEvent
};
