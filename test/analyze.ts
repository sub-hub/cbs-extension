import * as vscode from 'vscode';
import { CbsLinter } from '../src/cbsLinter';
import { formatDocumentWithMapping } from '../src/cbsFormatter';
import { CbsInlayHint, CbsInlayHintsProvider } from '../src/cbsInlayHints';

// Turns linter, formatter and inlay hint results into plain text that is easy to diff in snapshots.
// Positions are 1-based line:column, like the editor shows them.

const formatPosition = (position: vscode.Position) => `${position.line + 1}:${position.character + 1}`;
const formatRange = (range: vscode.Range) => `${formatPosition(range.start)}-${formatPosition(range.end)}`;

export function lint(document: vscode.TextDocument): string[] {
    const linter = new CbsLinter();
    linter.updateDiagnostics(document);
    const diagnostics = linter['diagnosticCollection'].get(document.uri) ?? [];
    return diagnostics.map(d => `${formatRange(d.range)} ${vscode.DiagnosticSeverity[d.severity]} ${d.message}`);
}

export function format(document: vscode.TextDocument): { formatted: string[]; sourceMap: string[] } {
    const result = formatDocumentWithMapping(document, { tabSize: 4, insertSpaces: true });
    return {
        formatted: result.formattedText.split('\n'),
        sourceMap: result.sourceMap.map(e => `${e.originalLine + 1} -> ${e.formattedStartLine + 1}-${e.formattedEndLine + 1}`)
    };
}

export function inlayHints(document: vscode.TextDocument): string[] {
    const provider = new CbsInlayHintsProvider();
    const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
    const hints = provider.provideInlayHints(document, fullRange, new vscode.CancellationTokenSource().token);
    return (Array.isArray(hints) ? hints : []).map(hint => {
        const label = typeof hint.label === 'string' ? hint.label : hint.label.map(part => part.value).join('');
        const target = hint instanceof CbsInlayHint && hint.target ? ` on ${formatRange(hint.target)}` : '';
        return `${formatPosition(hint.position)} ${vscode.InlayHintKind[hint.kind ?? 0] ?? 'None'} ${JSON.stringify(label)}${target}`;
    });
}
