import * as vscode from 'vscode';

/**
 * Builds an in-memory TextDocument with the members the extension code uses.
 * Line breaks are normalized to \n so results do not depend on git's checkout settings.
 */
export function createDocument(text: string, name = 'test.cbs'): vscode.TextDocument {
    const content = text.replace(/\r\n/g, '\n');
    const lines = content.split('\n');
    const lineStarts: number[] = [];
    let offset = 0;
    for (const line of lines) {
        lineStarts.push(offset);
        offset += line.length + 1;
    }

    const positionAt = (target: number): vscode.Position => {
        const clamped = Math.max(0, Math.min(target, content.length));
        let line = 0;
        while (line + 1 < lineStarts.length && lineStarts[line + 1] <= clamped) {
            line++;
        }
        return new vscode.Position(line, clamped - lineStarts[line]);
    };

    const offsetAt = (position: vscode.Position): number =>
        Math.min(lineStarts[position.line] + position.character, content.length);

    const lineAt = (lineOrPosition: number | vscode.Position) => {
        const lineNumber = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
        const lineText = lines[lineNumber];
        const firstNonWhitespace = lineText.search(/\S/);
        return {
            lineNumber,
            text: lineText,
            range: new vscode.Range(lineNumber, 0, lineNumber, lineText.length),
            rangeIncludingLineBreak: new vscode.Range(lineNumber, 0, lineNumber + 1, 0),
            firstNonWhitespaceCharacterIndex: firstNonWhitespace === -1 ? lineText.length : firstNonWhitespace,
            isEmptyOrWhitespace: firstNonWhitespace === -1
        };
    };

    const document = {
        uri: vscode.Uri.file(`/fixtures/${name}`),
        fileName: `/fixtures/${name}`,
        languageId: 'cbs',
        version: 1,
        lineCount: lines.length,
        getText: (range?: vscode.Range) =>
            range ? content.substring(offsetAt(range.start), offsetAt(range.end)) : content,
        positionAt,
        offsetAt,
        lineAt
    };
    return document as unknown as vscode.TextDocument;
}
