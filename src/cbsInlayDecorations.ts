import * as vscode from 'vscode';
import { CbsInlayHint, CbsInlayHintsProvider } from './cbsInlayHints';

/**
 * Draws CBS inlay hints as editor decorations.
 * Real inlay hints can only be colored with editorInlayHint.*, which applies to every language,
 * so decorations are used to give CBS hints their own theme colors (cbs.inlayHint.*).
 */
export class CbsInlayDecorator implements vscode.Disposable {
    private readonly provider = new CbsInlayHintsProvider();
    private readonly tokenSource = new vscode.CancellationTokenSource();
    private readonly parameterDecoration = createHintDecorationType('parameter');
    private readonly typeDecoration = createHintDecorationType('type');
    private readonly updateTimers = new Map<string, NodeJS.Timeout>();
    private readonly disposables: vscode.Disposable[] = [];

    constructor() {
        this.disposables.push(
            vscode.window.onDidChangeVisibleTextEditors(() => this.updateVisibleEditors()),
            // Changing the language mode closes and reopens the document
            vscode.workspace.onDidOpenTextDocument(() => this.updateVisibleEditors()),
            vscode.workspace.onDidChangeTextDocument(event => this.scheduleUpdate(event.document)),
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration('cbs.inlayHints') || event.affectsConfiguration('editor.inlayHints')) {
                    this.updateVisibleEditors();
                }
            })
        );
        this.updateVisibleEditors();
    }

    private updateVisibleEditors(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.update(editor);
        }
    }

    private scheduleUpdate(document: vscode.TextDocument): void {
        if (document.languageId !== 'cbs') return;

        const key = document.uri.toString();
        const pending = this.updateTimers.get(key);
        if (pending) {
            clearTimeout(pending);
        }
        // Existing decorations move with the text until this runs
        this.updateTimers.set(key, setTimeout(() => {
            this.updateTimers.delete(key);
            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document === document) {
                    this.update(editor);
                }
            }
        }, 200));
    }

    private update(editor: vscode.TextEditor): void {
        const parameterOptions: vscode.DecorationOptions[] = [];
        const typeOptions: vscode.DecorationOptions[] = [];

        if (editor.document.languageId === 'cbs' && isInlayHintsEnabled(editor.document)) {
            for (const hint of this.getHints(editor.document)) {
                const label = typeof hint.label === 'string'
                    ? hint.label
                    : hint.label.map(part => part.value).join('');
                const contentText = label.trim();
                if (!contentText) continue;

                // Parameter hints are drawn before their target text, the others after it.
                // Hovering the target text shows the hint's tooltip.
                const isParameter = hint.kind === vscode.InlayHintKind.Parameter;
                const target = hint instanceof CbsInlayHint ? hint.target : undefined;
                const attachment: vscode.ThemableDecorationAttachmentRenderOptions = {
                    contentText,
                    margin: `0 ${hint.paddingRight ? '0.3em' : '0'} 0 ${hint.paddingLeft ? '0.3em' : '0'}`
                };
                const option: vscode.DecorationOptions = {
                    range: target ?? new vscode.Range(hint.position, hint.position),
                    hoverMessage: hint.tooltip,
                    renderOptions: isParameter ? { before: attachment } : { after: attachment }
                };
                (isParameter ? parameterOptions : typeOptions).push(option);
            }
        }

        // Also clears hints from editors that are no longer CBS
        editor.setDecorations(this.parameterDecoration, parameterOptions);
        editor.setDecorations(this.typeDecoration, typeOptions);
    }

    private getHints(document: vscode.TextDocument): vscode.InlayHint[] {
        const fullRange = new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end);
        const hints = this.provider.provideInlayHints(document, fullRange, this.tokenSource.token);
        return Array.isArray(hints) ? hints : [];
    }

    public dispose(): void {
        for (const timer of this.updateTimers.values()) {
            clearTimeout(timer);
        }
        this.updateTimers.clear();
        this.disposables.forEach(d => d.dispose());
        this.parameterDecoration.dispose();
        this.typeDecoration.dispose();
        this.tokenSource.dispose();
    }
}

function createHintDecorationType(kind: 'parameter' | 'type'): vscode.TextEditorDecorationType {
    const style: vscode.ThemableDecorationAttachmentRenderOptions = {
        color: new vscode.ThemeColor(`cbs.inlayHint.${kind}Foreground`),
        backgroundColor: new vscode.ThemeColor(`cbs.inlayHint.${kind}Background`),
        // Extra CSS to look like built-in inlay hints
        textDecoration: 'none; border-radius: 3px; padding: 0 2px; font-size: 90%;'
    };
    return vscode.window.createTextEditorDecorationType(kind === 'parameter' ? { before: style } : { after: style });
}

/**
 * Follows the user's editor.inlayHints.enabled setting.
 * The "while pressed" modes cannot be reproduced with decorations, so they map to their default state.
 */
function isInlayHintsEnabled(document: vscode.TextDocument): boolean {
    const mode = vscode.workspace.getConfiguration('editor', document).get<string>('inlayHints.enabled', 'on');
    return mode === 'on' || mode === 'onUnlessPressed';
}
