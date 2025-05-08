import * as vscode from 'vscode';
import * as path from 'path';
import { cbsCommandsData, findCommandInfo, extractCommandIdentifierFromPrefix, countParametersInCurrentTag } from './cbsData';
import { CbsLinter } from './cbsLinter';
import { formatLine, calculateInitialFormattingState, FormattingState, formatDocumentWithMapping, SourceMapEntry, goToOriginalLine, goToOriginalCharacter } from './cbsFormatter';

// NEW: Define a decoration type for highlighting
const foundRangeDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 255, 0, 0.3)', // Yellow background with some transparency
    border: '1px solid rgba(200, 0, 0, 0.5)', // Slightly darker yellow border
    borderRadius: '2px', // Slightly rounded corners
    isWholeLine: false, // Only highlight the exact range
    overviewRulerColor: 'yellow', // Show marker in the overview ruler
    overviewRulerLane: vscode.OverviewRulerLane.Center
});


interface VariableLocation {
    name: string;
    location: vscode.Location;
    isDefinition: boolean;
}

// NEW: Structure to store preview context
interface PreviewContext {
    originalUri: vscode.Uri;
    sourceMap: SourceMapEntry[];
    formattedContent: string; // Store the content here
}

// Map to store context for active previews
const previewContextMap = new Map<string, PreviewContext>(); // Key: Preview URI string
// Map to track which original URI corresponds to which preview URI(s)
const originalToPreviewMap = new Map<string, Set<string>>(); // Key: Original URI string, Value: Set of Preview URI strings
// Debounce timer for preview updates
let updatePreviewDebounceTimer: NodeJS.Timeout | undefined;


function getVariableNameAtPosition(document: vscode.TextDocument, position: vscode.Position, allLocations: VariableLocation[]): string | undefined {
    for (const loc of allLocations) {
        if (loc.location.range.contains(position)) {
            return loc.name;
        }
    }
    return undefined;
}

class CbsDefinitionProvider implements vscode.DefinitionProvider {
    private linter: CbsLinter;

    constructor(linter: CbsLinter) {
        this.linter = linter;
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        // Prevent running on preview documents
        if (previewContextMap.has(document.uri.toString())) {
            return undefined;
        }
        const allLocations: VariableLocation[] = this.linter.parseDocumentForVariables(document);
        const varName = getVariableNameAtPosition(document, position, allLocations);

        if (!varName) {
            return undefined;
        }

        const definitions = allLocations
            .filter((loc: VariableLocation) => loc.name === varName && loc.isDefinition)
            .map((loc: VariableLocation) => loc.location);

        return definitions;
    }
}

class CbsReferenceProvider implements vscode.ReferenceProvider {
     private linter: CbsLinter;

    constructor(linter: CbsLinter) {
        this.linter = linter;
    }

    provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location[]> {
         // Prevent running on preview documents
        if (previewContextMap.has(document.uri.toString())) {
            return undefined;
        }
        const allLocations: VariableLocation[] = this.linter.parseDocumentForVariables(document);
        const varName = getVariableNameAtPosition(document, position, allLocations);

        if (!varName) {
            return undefined;
        }

        const references = allLocations
            .filter((loc: VariableLocation) => loc.name === varName)
            .map((loc: VariableLocation) => loc.location);

        return references;
    }
}

function isInsideCbsTag(document: vscode.TextDocument, position: vscode.Position): boolean {
    // Prevent running on preview documents for tag-specific features
    if (previewContextMap.has(document.uri.toString())) {
        return false;
    }
    const lineText = document.lineAt(position.line).text;
    const textBeforePosition = lineText.substring(0, position.character);
    const textAfterPosition = lineText.substring(position.character);

    const openBraceIndex = textBeforePosition.lastIndexOf('{{');
    if (openBraceIndex === -1) {
        return false; // No opening braces before cursor
    }

    const closeBraceIndexBefore = textBeforePosition.lastIndexOf('}}');
    // Ensure the last opening brace is *after* the last closing brace before the cursor
    if (closeBraceIndexBefore > openBraceIndex) {
        return false;
    }

    const closeBraceIndexAfter = textAfterPosition.indexOf('}}');
    if (closeBraceIndexAfter === -1) {
        // Check subsequent lines if no closing brace on the current line
        for (let i = position.line + 1; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('}}')) {
                return true; // Found closing brace on a later line
            }
        }
        return false; // No closing brace found anywhere after
    }

    return true;
}

let cbsLinter: CbsLinter;

// Content provider for the virtual preview document
class CbsPreviewContentProvider implements vscode.TextDocumentContentProvider {
    // Emitter and event for signalling content changes
    private _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChangeEmitter.event;

    // Provide content - VS Code calls this when opening the virtual doc or when notified of change
    provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
        const context = previewContextMap.get(uri.toString());
        console.log(`Preview Provider: Providing content for ${uri.toString()}. Found context: ${!!context}`);
        return context?.formattedContent ?? `// Error: Could not find preview content for ${uri.toString()}`;
    }

    // Method to signal that the content for a specific URI has changed
    update(uri: vscode.Uri) {
        console.log(`Preview Provider: Firing change event for ${uri.toString()}`);
        this._onDidChangeEmitter.fire(uri);
    }

    dispose() {
        this._onDidChangeEmitter.dispose();
    }
}

// PreviewContext interface remains the same
interface PreviewContext {
    originalUri: vscode.Uri;
    sourceMap: SourceMapEntry[];
    formattedContent: string; // Store the content here
}


export function activate(context: vscode.ExtensionContext) {

  cbsLinter = new CbsLinter();
  cbsLinter.activate(context);

  // --- Register Content Provider ---
  const previewScheme = 'cbs-preview';
  const previewProvider = new CbsPreviewContentProvider(); // Instantiate the provider
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(previewScheme, previewProvider));
  context.subscriptions.push(previewProvider); // Ensure provider is disposed

  // --- Command: Show Formatted Preview ---
  const showPreviewCommand = vscode.commands.registerCommand('cbs.showFormattedPreview', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'cbs') {
        vscode.window.showInformationMessage('Open a CBS file first to show the formatted preview.');
        return;
    }
     // Prevent running on preview documents
    if (previewContextMap.has(editor.document.uri.toString())) {
        vscode.window.showInformationMessage('Cannot create a preview from a preview window.');
        return;
    }


    const originalDocument = editor.document;
    const options: vscode.FormattingOptions = { // Get formatting options from settings
        tabSize: editor.options.tabSize as number || 4,
        insertSpaces: editor.options.insertSpaces as boolean || true
    };

    try {
        const { formattedText, sourceMap } = formatDocumentWithMapping(originalDocument, options);

        // Create a unique URI for the preview, using only the base filename for clarity
        const relativePath = vscode.workspace.asRelativePath(originalDocument.uri);
        const filenameOnly = path.basename(relativePath); // Extract just the filename
        const previewUri = vscode.Uri.parse(`${previewScheme}:CBS Preview: ${filenameOnly}?_ts=${Date.now()}`);

        // Store context BEFORE opening the document
        previewContextMap.set(previewUri.toString(), {
            originalUri: originalDocument.uri,
            sourceMap: sourceMap,
            formattedContent: formattedText
        });

        // Track the mapping from original to preview
        const originalUriString = originalDocument.uri.toString();
        if (!originalToPreviewMap.has(originalUriString)) {
            originalToPreviewMap.set(originalUriString, new Set());
        }
        originalToPreviewMap.get(originalUriString)?.add(previewUri.toString());
        console.log(`Show Preview: Added mapping ${originalUriString} -> ${previewUri.toString()}`);

        // Open the virtual document
        const previewDoc = await vscode.workspace.openTextDocument(previewUri); // URI is now correctly passed
        await vscode.window.showTextDocument(previewDoc, {
            viewColumn: vscode.ViewColumn.Beside, // Open beside the original
            preview: false, // Keep it open
            preserveFocus: false // Focus the new preview window
        });

        // Set context key for the 'Go to Original' command visibility
        vscode.commands.executeCommand('setContext', 'cbs.isPreviewActive', true);

    } catch (error) {
        console.error("Error generating CBS preview:", error);
        vscode.window.showErrorMessage(`Failed to generate CBS formatted preview: ${error}`);
    }
  });
  context.subscriptions.push(showPreviewCommand);


  // --- Command: Go To Original Location (Sentence/Selection) ---
  const goToOriginalCommand = vscode.commands.registerCommand('cbs.goToOriginalLocation', async () => {
    console.log('GoToOriginal (Sentence/Selection): Command triggered.');
    const previewEditor = vscode.window.activeTextEditor;
    if (!previewEditor || previewEditor.document.uri.scheme !== previewScheme) {
        // Should not happen if 'when' clause is set correctly in package.json
    console.log('GoToOriginal (Sentence/Selection): Command triggered on non-preview editor or no active editor.');
        return;
    }
    console.log('GoToOriginal (Sentence/Selection): Active editor is a preview editor. URI:', previewEditor.document.uri.toString());

    const previewUriString = previewEditor.document.uri.toString();
    const contextData = previewContextMap.get(previewUriString);

    if (!contextData) {
        console.error('GoToOriginal (Sentence/Selection): Could not find context data for URI:', previewUriString);
        vscode.window.showErrorMessage('Could not find original source context for this preview.');
        return;
    }
    console.log('GoToOriginal (Sentence/Selection): Found context data. Original URI:', contextData.originalUri.toString());

    const previewSelection = previewEditor.selection; // The actual user selection
    const previewDocument = previewEditor.document;
    const originalCursorPosition = previewSelection.active; // Store the actual click/cursor position
    const wasInitiallyEmpty = previewSelection.isEmpty; // Check if it was a click or drag

    let selectionToSearch: vscode.Selection; // This will be the range used for mapping (usually the start line)
    let previewLineText: string | undefined = undefined; // Text of the full line in preview
    let previewSelectedText: string | undefined = undefined; // Text of the user's selection

    if (wasInitiallyEmpty) {
        // CLICK / NO SELECTION: Select the non-whitespace part of the current line for searching
        const currentLineNumber = previewSelection.active.line;
        const currentLine = previewDocument.lineAt(currentLineNumber);
        previewLineText = currentLine.text; // Get the full line text
        const trimmedLineText = previewLineText.trim();

        if (trimmedLineText.length > 0) {
            const startChar = currentLine.firstNonWhitespaceCharacterIndex;
            const endChar = startChar + trimmedLineText.length;
            const startPos = new vscode.Position(currentLineNumber, startChar);
            const endPos = new vscode.Position(currentLineNumber, endChar);
            selectionToSearch = new vscode.Selection(startPos, endPos); // Use this derived selection for mapping/search
            previewSelectedText = trimmedLineText; // The text to search for is the trimmed line content
            console.log(`GoToOriginal (Sentence/Selection): No selection. Searching for line content: "${previewSelectedText}"`);
        } else {
            // Line is empty or only whitespace. Fallback to line navigation.
            console.log(`GoToOriginal (Sentence/Selection): No selection and line is empty/whitespace. Falling back to line navigation.`);
            // Directly call goToOriginalLine here or let goToOriginalCharacter handle the empty previewSelectedText case.
            // Let's modify goToOriginalCharacter to handle it.
            selectionToSearch = previewSelection; // Use original empty selection for mapping
            previewSelectedText = ""; // Indicate no text to search
        }
    } else {
        // DRAG SELECTION: Use the user's selection
        selectionToSearch = previewSelection; // Use the actual selection for mapping start line
        previewSelectedText = previewDocument.getText(previewSelection); // Get the selected text
        // Get the text of the line where the selection starts
        previewLineText = previewDocument.lineAt(previewSelection.start.line).text;
        console.log(`GoToOriginal (Sentence/Selection): User selection. Line text: "${previewLineText}", Selected text: "${previewSelectedText}"`);
    }

    // Ensure we have text to search if we derived it from an empty selection line
    if (!previewSelectedText && wasInitiallyEmpty) {
         console.log(`GoToOriginal (Sentence/Selection): No searchable text derived from empty line. Aborting character search.`);
         // Optionally call goToOriginalLine as a fallback here if desired
         // goToOriginalLine(...)
         return; // Stop processing for character search
    }


    // Call goToOriginalCharacter with the necessary info
    console.log(`GoToOriginal (Sentence/Selection): Calling goToOriginalCharacter. Mapping starts at line ${selectionToSearch.start.line}.`);

     // Find the target editor window for the original document
    const targetEditor = vscode.window.visibleTextEditors.find(editor =>
        editor.document.uri.toString() === contextData.originalUri.toString()
    );

    // Prepare arguments for goToOriginalCharacter
    const args = {
        sourceMap: contextData.sourceMap,
        previewSelectionForMapping: selectionToSearch, // Selection used to find the original line
        previewLineText: previewLineText,             // Full text of the preview line
        previewSelectedText: previewSelectedText,     // Text selected by user (or derived line text)
        originalDocUri: contextData.originalUri,
        originalCursorPosition: wasInitiallyEmpty ? originalCursorPosition : undefined, // Pass click position only if no drag
        targetViewColumn: targetEditor ? targetEditor.viewColumn : vscode.ViewColumn.Active,
        targetEditor: targetEditor, // Pass editor if visible
        decorationType: targetEditor ? foundRangeDecorationType : undefined // Pass decoration if editor visible
    };

    if (targetEditor) {
        console.log('GoToOriginal (Sentence/Selection): Original document editor is visible.');
        goToOriginalCharacter(args);
    } else {
        console.log('GoToOriginal (Sentence/Selection): Original document editor not visible. Opening and selecting.');
        goToOriginalCharacter(args); // goToOriginalCharacter handles opening
    }
  });
  context.subscriptions.push(goToOriginalCommand);


  // --- Command: Go To Original Location (Line) ---
  const goToOriginalLineCommand = vscode.commands.registerCommand('cbs.goToOriginalLocationLine', async () => {
    console.log('GoToOriginal (Line): Command triggered.');
    const previewEditor = vscode.window.activeTextEditor;
    if (!previewEditor || previewEditor.document.uri.scheme !== previewScheme) {
        console.log('GoToOriginal (Line): Command triggered on non-preview editor or no active editor.');
        return;
    }
    console.log('GoToOriginal (Line): Active editor is a preview editor. URI:', previewEditor.document.uri.toString());

    const previewUriString = previewEditor.document.uri.toString();
    const contextData = previewContextMap.get(previewUriString);

    if (!contextData) {
        console.error('GoToOriginal (Line): Could not find context data for URI:', previewUriString);
        vscode.window.showErrorMessage('Could not find original source context for this preview.');
        return;
    }
    console.log('GoToOriginal (Line): Found context data. Original URI:', contextData.originalUri.toString());

    const previewPosition = previewEditor.selection.active; // Always use the active cursor position

    console.log(`GoToOriginal (Line): Calling goToOriginalLine for position: Line ${previewPosition.line}, Char ${previewPosition.character}`);

    // Find the target editor window for the original document
    const targetEditor = vscode.window.visibleTextEditors.find(editor =>
        editor.document.uri.toString() === contextData.originalUri.toString()
    );

    if (targetEditor) {
        // Original document is visible, pass the editor and decoration
        console.log('GoToOriginal (Line): Original document editor is visible. Passing editor and decoration.');
        goToOriginalLine(
            contextData.sourceMap,
            previewPosition,
            contextData.originalUri,
            targetEditor.viewColumn, // Use the existing editor's view column
            targetEditor,           // Pass the target editor instance
            foundRangeDecorationType // Pass the decoration type
        );
    } else {
        // Original document not visible, just navigate
         console.log('GoToOriginal (Line): Original document editor not visible. Opening and selecting.');
         goToOriginalLine(
            contextData.sourceMap,
            previewPosition,
            contextData.originalUri,
            vscode.ViewColumn.Active, // Let showTextDocument decide view column if opening new
            undefined, // No editor to pass yet
            undefined  // No decoration type needed if editor isn't ready
        );
    }
  });
  context.subscriptions.push(goToOriginalLineCommand); // Register the new command


  // --- Manage Context Key and Cleanup ---
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && editor.document.uri.scheme === previewScheme) {
        vscode.commands.executeCommand('setContext', 'cbs.isPreviewActive', true);
    } else {
        vscode.commands.executeCommand('setContext', 'cbs.isPreviewActive', false);
    }
  }));

  // --- Listener for Original Document Changes (for Real-time Preview) ---
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
    const changedDocument = event.document;
    const config = vscode.workspace.getConfiguration('cbs.preview.realtimeUpdate');
    const isRealtimeEnabled = config.get<boolean>('enabled', true);
    const debounceDelay = config.get<number>('debounceDelay', 500);

    // Only proceed if real-time updates are enabled and the changed doc is a CBS file
    // AND it's an original file (not a preview itself) that has an active preview
    if (!isRealtimeEnabled || changedDocument.languageId !== 'cbs' || changedDocument.uri.scheme === previewScheme) {
        return;
    }

    const originalUriString = changedDocument.uri.toString();
    const correspondingPreviewUris = originalToPreviewMap.get(originalUriString);

    if (!correspondingPreviewUris || correspondingPreviewUris.size === 0) {
        // No active preview for this original document
        return;
    }

    console.log(`Doc Change: Detected change in ${originalUriString}, which has previews.`);

    // Clear existing timer if there is one
    if (updatePreviewDebounceTimer) {
        clearTimeout(updatePreviewDebounceTimer);
    }

    // Set a new timer
    updatePreviewDebounceTimer = setTimeout(() => {
        console.log(`Doc Change Debounced: Updating preview for ${originalUriString}`);
        try {
            const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === originalUriString);
            const options: vscode.FormattingOptions = {
                tabSize: editor?.options.tabSize as number || vscode.workspace.getConfiguration('editor', { languageId: 'cbs' }).get('tabSize', 4),
                insertSpaces: editor?.options.insertSpaces as boolean || vscode.workspace.getConfiguration('editor', { languageId: 'cbs' }).get('insertSpaces', true)
            };

            // Re-format the *current* state of the original document
            const { formattedText, sourceMap } = formatDocumentWithMapping(changedDocument, options);

            // Update context and notify provider for each associated preview window
            correspondingPreviewUris.forEach(previewUriString => {
                const previewUri = vscode.Uri.parse(previewUriString);
                const existingContext = previewContextMap.get(previewUriString);
                if (existingContext) {
                    // Update the context in the map
                    previewContextMap.set(previewUriString, {
                        ...existingContext, // Keep originalUri
                        sourceMap: sourceMap,
                        formattedContent: formattedText
                    });
                    console.log(`Doc Change Debounced: Updated context for ${previewUriString}`);

                    // Notify the content provider to refresh this specific preview
                    previewProvider.update(previewUri);
                } else {
                     console.warn(`Doc Change Debounced: Could not find context for preview URI ${previewUriString} during update.`);
                }
            });

        } catch (error) {
            console.error("Error updating CBS preview:", error);
            // Optionally show a subtle error to the user, but avoid being too noisy
            // vscode.window.showWarningMessage(`Failed to update CBS preview: ${error}`);
        }
        updatePreviewDebounceTimer = undefined; // Clear timer reference
    }, debounceDelay);
  });
  context.subscriptions.push(documentChangeListener);


  // --- Cleanup map when preview documents are closed ---
  const closeDocumentListener = vscode.workspace.onDidCloseTextDocument(document => {
    if (document.uri.scheme === previewScheme) {
        const closedPreviewUriString = document.uri.toString();
        console.log(`Close Doc: Preview closed: ${closedPreviewUriString}`);
        previewContextMap.delete(closedPreviewUriString);

        // Remove the closed preview from the originalToPreviewMap
        originalToPreviewMap.forEach((previewSet, originalUri) => {
            if (previewSet.has(closedPreviewUriString)) {
                previewSet.delete(closedPreviewUriString);
                console.log(`Close Doc: Removed ${closedPreviewUriString} from mapping for ${originalUri}`);
                // If no more previews exist for this original, remove the entry entirely
                if (previewSet.size === 0) {
                    originalToPreviewMap.delete(originalUri);
                     console.log(`Close Doc: Removed empty mapping entry for ${originalUri}`);
                }
            }
        });


        // Check if any other preview windows are open before disabling context
        let anyPreviewOpen = false;
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.scheme === previewScheme) {
                anyPreviewOpen = true;
                break;
            }
        }
        if (!anyPreviewOpen) {
             vscode.commands.executeCommand('setContext', 'cbs.isPreviewActive', false);
        }
    }
  });

  // --- Existing Providers ---
  const hoverProvider = vscode.languages.registerHoverProvider('cbs', {
    provideHover(document, position, token) {
      // Prevent running on preview documents
      if (previewContextMap.has(document.uri.toString())) {
          return undefined;
      }
      if (!isInsideCbsTag(document, position)) {
          return undefined;
      }
      // ... (rest of hover logic)

      const range = document.getWordRangeAtPosition(position, /([\w#-]+|\?)/);
      if (!range) {
        return undefined;
      }
      const word = document.getText(range);
      const commandInfo = findCommandInfo(word);

      if (commandInfo) {
        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(`{{${commandInfo.signatureLabel}}}`, 'cbs');
        markdown.appendMarkdown(`\n---\n`);
        markdown.appendMarkdown(typeof commandInfo.description === 'string' ? commandInfo.description : commandInfo.description.value);
        if (commandInfo.aliases && commandInfo.aliases.length > 0) {
            markdown.appendMarkdown(`\n\n*Aliases: ${commandInfo.aliases.map(a => `\`${a}\``).join(', ')}*`);
        }
        return new vscode.Hover(markdown, range);
      }
      return undefined;
    }
  });

  const signatureHelpProvider = vscode.languages.registerSignatureHelpProvider('cbs', {
    provideSignatureHelp(document, position, token, context) {
       // Prevent running on preview documents
       if (previewContextMap.has(document.uri.toString())) {
           return undefined;
       }
       if (!isInsideCbsTag(document, position)) {
        return undefined;
       }
       // ... (rest of signature help logic)

      const lineText = document.lineAt(position.line).text;
      const textBeforeCursor = lineText.substring(0, position.character);

      const tagStartIndex = textBeforeCursor.lastIndexOf('{{');
      if (tagStartIndex === -1) {
          return undefined;
      }
      const tagContent = textBeforeCursor.substring(tagStartIndex);

      const commandIdentifier = extractCommandIdentifierFromPrefix(tagContent);
      if (!commandIdentifier) {
          return undefined;
      }

      const commandInfo = findCommandInfo(commandIdentifier);
      if (!commandInfo || !commandInfo.parameters || commandInfo.parameters.length === 0) {
          return undefined;
      }

      const activeParameter = countParametersInCurrentTag(tagContent);

      const signatureHelp = new vscode.SignatureHelp();
      const signatureInfo = new vscode.SignatureInformation(
          `{{${commandInfo.signatureLabel}}}`,
          new vscode.MarkdownString(typeof commandInfo.description === 'string' ? commandInfo.description : commandInfo.description.value)
      );

      signatureInfo.parameters = commandInfo.parameters.map(p =>
          new vscode.ParameterInformation(p.label, p.documentation)
      );

      signatureHelp.signatures = [signatureInfo];
      signatureHelp.activeSignature = 0;
      signatureHelp.activeParameter = Math.min(activeParameter, commandInfo.parameters.length - 1);

      return signatureHelp;
    }
  },
  ':'
  );

  const commandCompletionProvider = vscode.languages.registerCompletionItemProvider(
    'cbs',
    {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
             // Prevent running on preview documents
            if (previewContextMap.has(document.uri.toString())) {
                return undefined;
            }
            let isValidTrigger = false;
            let triggerChar = ''; // Variable to store the actual trigger character

            // Check for TriggerCharacter
            if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && ['[', '{', '<'].includes(context.triggerCharacter ?? '')) {
                isValidTrigger = true;
                triggerChar = context.triggerCharacter ?? '';
            }
            // Check for Invoke after '[' or '{' or '<'
            else if (context.triggerKind === vscode.CompletionTriggerKind.Invoke && position.character > 0) {
                const charBefore = document.getText(new vscode.Range(position.translate(0, -1), position));
                if (['[', '{', '<'].includes(charBefore)) {
                    isValidTrigger = true;
                    triggerChar = charBefore;
                }
            }

            if (!isValidTrigger) {
                return undefined;
            }

            // If the trigger is valid, we always want to delete the preceding character
            const deleteRange = new vscode.Range(position.translate(0, -1), position);
            const deleteTriggerEdit = vscode.TextEdit.delete(deleteRange);
            const insertRange = new vscode.Range(position, position); // Insert at the original cursor position

            // Handle ChatML completion for '<'
            if (triggerChar === '<') {
                const chatMLItems: vscode.CompletionItem[] = [];

                // System Block
                const systemBlock = new vscode.CompletionItem('ChatML system block', vscode.CompletionItemKind.Snippet);
                systemBlock.insertText = new vscode.SnippetString('<|im_start|>system\n$0\n<|im_end|>');
                systemBlock.documentation = new vscode.MarkdownString('Inserts a ChatML system message block.');
                systemBlock.range = insertRange;
                systemBlock.additionalTextEdits = [deleteTriggerEdit];
                systemBlock.detail = "ChatML System Snippet";
                systemBlock.sortText = "chatml_1system";
                chatMLItems.push(systemBlock);

                // User Block
                const userBlock = new vscode.CompletionItem('ChatML user block', vscode.CompletionItemKind.Snippet);
                userBlock.insertText = new vscode.SnippetString('<|im_start|>user\n$0\n<|im_end|>');
                userBlock.documentation = new vscode.MarkdownString('Inserts a ChatML user message block.');
                userBlock.range = insertRange;
                userBlock.additionalTextEdits = [deleteTriggerEdit];
                userBlock.detail = "ChatML User Snippet";
                userBlock.sortText = "chatml_2user";
                chatMLItems.push(userBlock);

                // Assistant Block
                const assistantBlock = new vscode.CompletionItem('ChatML assistant block', vscode.CompletionItemKind.Snippet);
                assistantBlock.insertText = new vscode.SnippetString('<|im_start|>assistant\n$0\n<|im_end|>');
                assistantBlock.documentation = new vscode.MarkdownString('Inserts a ChatML assistant message block.');
                assistantBlock.range = insertRange;
                assistantBlock.additionalTextEdits = [deleteTriggerEdit];
                assistantBlock.detail = "ChatML Assistant Snippet";
                assistantBlock.sortText = "chatml_3assistant";
                chatMLItems.push(assistantBlock);

                // End Tag
                const endTag = new vscode.CompletionItem('ChatML end tag', vscode.CompletionItemKind.Snippet);
                endTag.insertText = new vscode.SnippetString('<|im_end|>');
                endTag.documentation = new vscode.MarkdownString('Inserts the ChatML end tag.');
                endTag.range = insertRange;
                endTag.additionalTextEdits = [deleteTriggerEdit];
                endTag.detail = "ChatML End Tag Snippet";
                endTag.sortText = "chatml_4end_tag";
                chatMLItems.push(endTag);

                return chatMLItems;
            }
            // Handle existing CBS command completions for '[' or '{'
            else if (triggerChar === '[' || triggerChar === '{') {
                const useOriginalNameForAlias = vscode.workspace.getConfiguration('cbs').get<boolean>('completion.useOriginalNameForAlias', true);
                const commandCompletionItems: vscode.CompletionItem[] = [];

                cbsCommandsData.forEach(cmdInfo => {
                    const item = new vscode.CompletionItem(cmdInfo.name, vscode.CompletionItemKind.Keyword);
                    item.documentation = new vscode.MarkdownString(typeof cmdInfo.description === 'string' ? cmdInfo.description : cmdInfo.description.value);

                    item.range = insertRange; // Use the original position for insertion range
                    item.additionalTextEdits = [deleteTriggerEdit]; // Always include the deletion edit

                    if (cmdInfo.parameters && cmdInfo.parameters.length > 0) {
                        // Make sure to use the correct separator for prefix commands
                        let separator;
                        if(cmdInfo.name === '?'){
                            separator = ' ';
                        }else{
                            if(cmdInfo.isPrefixCommand){
                                separator = ':';
                            }else{
                                separator = '::';
                            }
                        }
                        item.insertText = new vscode.SnippetString(`{{${cmdInfo.name}${separator}$\{1\}}}`);
                    } else {
                        item.insertText = `{{${cmdInfo.name}}}`;
                    }

                    if (cmdInfo.signatureLabel) {
                        item.detail = `{{${cmdInfo.signatureLabel}}}`;
                    } else {
                        item.detail = `CBS Command`;
                    }

                    item.sortText = cmdInfo.name;
                    commandCompletionItems.push(item);

                    if (cmdInfo.aliases) {
                        cmdInfo.aliases.forEach(alias => {
                            const aliasItem = new vscode.CompletionItem(alias, vscode.CompletionItemKind.Keyword);
                            aliasItem.documentation = new vscode.MarkdownString(`Alias for {{${cmdInfo.name}}}\n\n${typeof cmdInfo.description === 'string' ? cmdInfo.description : cmdInfo.description.value}`);
                            aliasItem.range = insertRange; // Use the original position for insertion range
                            aliasItem.additionalTextEdits = [deleteTriggerEdit]; // Always include the deletion edit

                            // Determine the text to insert based on the setting
                            const textToInsert = useOriginalNameForAlias ? cmdInfo.name : alias;

                            if (cmdInfo.parameters && cmdInfo.parameters.length > 0) {
                                let separator;
                                if (textToInsert === '?') {
                                    separator = ' ';
                                } else {
                                    // Use original command's prefix status
                                    // except for separator difference between original and alias
                                    if (cmdInfo.isPrefixCommand && textToInsert !== 'calc') {
                                        separator = ':';
                                    } else {
                                        separator = '::';
                                    }
                                }
                                aliasItem.insertText = new vscode.SnippetString(`{{${textToInsert}${separator}$\{1\}}}`);
                            } else {
                                aliasItem.insertText = `{{${textToInsert}}}`;
                            }
                            if (cmdInfo.signatureLabel) {
                                 aliasItem.detail = `Alias for {{${cmdInfo.signatureLabel}}}`;
                            } else {
                                 aliasItem.detail = `Alias for ${cmdInfo.name}`;
                            }
                            aliasItem.sortText = alias;
                            commandCompletionItems.push(aliasItem);
                        });
                    }
                });
                return commandCompletionItems;
            }
            // Fallback if triggerChar is somehow not one of the expected ones after isValidTrigger
            return undefined;
        }
    },
    '[', '{', '<'
  );

  // --- Document Formatting Provider (Full Document) ---
  const documentFormattingProvider = vscode.languages.registerDocumentFormattingEditProvider('cbs', {
    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
       // Prevent running on preview documents
       if (previewContextMap.has(document.uri.toString())) {
           vscode.window.showInformationMessage('Formatting is disabled for preview windows.');
           return []; // Return empty edits for preview
       }
      const edits: vscode.TextEdit[] = [];
      let currentState: FormattingState = { indentLevel: 0, inPureBlock: 0 };

      for (let i = 0; i < document.lineCount; i++) {
        if (token.isCancellationRequested) {
          return edits; // Return partial edits if cancelled
        }

        const line = document.lineAt(i);
        // Use the original formatLine here, as we want the edits, not the mapping
        const { formattedText, nextState } = formatLine(line, currentState, options);

        if (formattedText !== null && formattedText !== line.text) {
          // Only add edit if the formatted text is different from the original line text
          edits.push(vscode.TextEdit.replace(line.range, formattedText));
        }
        currentState = nextState; // Update state for the next line
      }
      return edits;
    }
  });

  // --- Document Range Formatting Provider (Selection) ---
  const rangeFormattingProvider = vscode.languages.registerDocumentRangeFormattingEditProvider('cbs', {
      provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
           // Prevent running on preview documents
           if (previewContextMap.has(document.uri.toString())) {
               vscode.window.showInformationMessage('Formatting is disabled for preview windows.');
               return []; // Return empty edits for preview
           }
          const edits: vscode.TextEdit[] = [];
          // Calculate the initial state just before the range starts
          let currentState = calculateInitialFormattingState(document, range.start.line, options);

          // Iterate through lines within the selected range
          for (let i = range.start.line; i <= range.end.line; i++) {
              if (token.isCancellationRequested) {
                  return edits; // Return partial edits if cancelled
              }

              const line = document.lineAt(i);
              // Use the original formatLine here
              const { formattedText, nextState } = formatLine(line, currentState, options);

              // Add edit if the line is within the range and needs formatting
              if (formattedText !== null && formattedText !== line.text) {
                  // Ensure the edit range corresponds to the original line range
                  edits.push(vscode.TextEdit.replace(line.range, formattedText));
              }
              currentState = nextState; // Update state for the next line
          }
          return edits;
      }
  });


  context.subscriptions.push(
    // Commands
    showPreviewCommand,
    goToOriginalCommand,
    goToOriginalLineCommand, // Added new command registration
    // Existing providers
    hoverProvider,
    signatureHelpProvider,
    commandCompletionProvider,
    documentFormattingProvider, // Register new full document formatter
    rangeFormattingProvider,    // Register range formatter
    vscode.languages.registerDefinitionProvider('cbs', new CbsDefinitionProvider(cbsLinter)),
    vscode.languages.registerReferenceProvider('cbs', new CbsReferenceProvider(cbsLinter)), // Added comma here
    // Note: ContentProvider registration was pushed earlier
  );

   // Set initial context
   vscode.commands.executeCommand('setContext', 'cbs.isPreviewActive', false);
}

export function deactivate() {
    // Clear debounce timer if extension is deactivated
    if (updatePreviewDebounceTimer) {
        clearTimeout(updatePreviewDebounceTimer);
    }
    if (cbsLinter) {
        cbsLinter.dispose();
    }
    foundRangeDecorationType.dispose();
    previewContextMap.clear();
    originalToPreviewMap.clear(); // Clear the tracking map
    console.log("CBS Extension Deactivated: Cleaned up resources.");
}
