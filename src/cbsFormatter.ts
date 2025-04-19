import * as vscode from 'vscode';

export interface FormattingState {
    indentLevel: number;
    inPureBlock: number;
}

// NEW: Structure to hold mapping info (Simplified)
export interface SourceMapEntry {
    originalLine: number;       // Original line number (0-based)
    formattedStartLine: number; // Starting line number in formatted output (0-based)
    formattedEndLine: number;   // Ending line number in formatted output (0-based)
}

export interface FullFormattingResult {
    formattedText: string;
    sourceMap: SourceMapEntry[];
}


export interface LineFormattingResult {
    formattedText: string | null; // Null if no change needed for this line's content (indent might still change)
    nextState: FormattingState;
    // NEW: Track how many lines the formatted output for this original line spans
    formattedLineCount: number;
}

const blockStartRegex = /\{\{#([\w-]+)/; // Matches {{#command
const pureBlockStartRegex = /\{\{#(if-pure|pure_display)/; // Add other pure blocks if needed
const blockEndRegex = /\{\{\/(?:[\w-]+)?\}\}|\{\{\/\}\}/; // Matches {{/command}} or {{/}}

// Modified formatLine to return formattedLineCount
export function formatLine(
    line: vscode.TextLine,
    currentState: FormattingState,
    options: vscode.FormattingOptions
): LineFormattingResult {
    const { indentLevel, inPureBlock } = currentState;
    const tabSize = options.tabSize;
    const insertSpaces = options.insertSpaces;
    const indentChar = insertSpaces ? ' '.repeat(tabSize) : '\t';

    const lineText = line.text;
    const trimmedLine = lineText.trim();

    let nextIndentLevel = indentLevel;
    let nextInPureBlock = inPureBlock;
    let formattedLineContent: string | null = null; // Assume no change initially
    let formattedLineCount = 1; // Default: one original line maps to one formatted line

    // ... (rest of the existing indent calculation logic remains the same) ...
    let indentChange = 0;
    let pureChange = 0;
    const allBlockStarts = [...trimmedLine.matchAll(new RegExp(blockStartRegex.source, 'g'))];
    const allPureStarts = [...trimmedLine.matchAll(new RegExp(pureBlockStartRegex.source, 'g'))];
    const allBlockEnds = [...trimmedLine.matchAll(new RegExp(blockEndRegex.source, 'g'))];

    pureChange += allPureStarts.length;
    indentChange += allPureStarts.length; // Pure blocks also increase indent
    indentChange += allBlockStarts.length - allPureStarts.length; // Non-pure block starts
    indentChange -= allBlockEnds.length; // All block ends decrease indent

    // Adjust pure block count based on closing tags
    for (let k = 0; k < allBlockEnds.length; k++) {
        if ((nextInPureBlock + pureChange) > 0) {
            pureChange--; // A closing tag closes a pure block if we are inside one
        }
    }

    nextIndentLevel = Math.max(0, indentLevel + indentChange);
    nextInPureBlock = Math.max(0, inPureBlock + pureChange);

    // Determine the indentation level that *applies* to the *current* line
    let effectiveIndentLevelForThisLine = indentLevel;
    const startsWithEndTag = trimmedLine.match(new RegExp(`^${blockEndRegex.source}`));
    // If a line starts with an end tag, it should be dedented *before* printing
    if (startsWithEndTag && inPureBlock === 0 && indentLevel > 0) {
        effectiveIndentLevelForThisLine = Math.max(0, indentLevel - 1);
    }

    const currentIndentLength = line.firstNonWhitespaceCharacterIndex;
    const currentIndent = lineText.substring(0, currentIndentLength);
    let correctIndent = currentIndent; // Assume correct initially

    if (trimmedLine.length === 0) {
        // Handle empty lines - they should just be empty
        if (lineText.length > 0) {
            formattedLineContent = "";
        }
        formattedLineCount = formattedLineContent === null ? 1 : formattedLineContent.split('\n').length; // Usually 1 for empty/whitespace lines
        return { formattedText: formattedLineContent, nextState: { indentLevel: indentLevel, inPureBlock: inPureBlock }, formattedLineCount };
    }


    if (inPureBlock === 0) {
        correctIndent = indentChar.repeat(effectiveIndentLevelForThisLine);

        // --- Start of complex tokenization/reconstruction logic ---
        // THIS IS THE PART THAT NEEDS SIGNIFICANT CHANGE FOR MAPPING
        // For now, we'll keep the existing logic but count newlines in the output
        const tokens = [];
        let currentPos = 0;
        let braceLevel = 0;
        let tagStart = -1;
        let textStart = 0;

        while (currentPos < lineText.length) {
            const openBracePos = lineText.indexOf('{{', currentPos);
            const closeBracePos = lineText.indexOf('}}', currentPos);

            let nextBracePos = -1;
            let isOpening = false;

            if (openBracePos !== -1 && (closeBracePos === -1 || openBracePos < closeBracePos)) {
                nextBracePos = openBracePos;
                isOpening = true;
            } else if (closeBracePos !== -1) {
                nextBracePos = closeBracePos;
                isOpening = false;
            } else {
                break;
            }

            if (nextBracePos > textStart && braceLevel === 0) {
                const textBefore = lineText.substring(textStart, nextBracePos);
                 // Simplified: Treat all text before brace as one token for now
                 tokens.push({ type: 'text', text: textBefore });
            }

            if (isOpening) {
                if (braceLevel === 0) tagStart = nextBracePos;
                braceLevel++;
                currentPos = nextBracePos + 2;
            } else { // Closing brace
                if (braceLevel > 0) {
                    braceLevel--;
                    if (braceLevel === 0 && tagStart !== -1) {
                        // We've closed the outermost brace, capture the tag
                        const tagEnd = nextBracePos + 2;
                        const tagText = lineText.substring(tagStart, tagEnd);
                        // Simplified: Treat all tags similarly for now
                        tokens.push({ type: 'tag', text: tagText });
                        textStart = tagEnd; // Update start position for next text segment
                        tagStart = -1; // Reset tag start marker
                    } else if (braceLevel === 0 && tagStart === -1) {
                         // Handle case like '}}' outside a tag - treat as text
                         const textBetween = lineText.substring(textStart, nextBracePos + 2);
                         tokens.push({ type: 'text', text: textBetween });
                         textStart = nextBracePos + 2;
                    }
                } else {
                     // Handle case like '}}' outside a tag - treat as text
                     const textBetween = lineText.substring(textStart, nextBracePos + 2);
                     tokens.push({ type: 'text', text: textBetween });
                     textStart = nextBracePos + 2;
                }
                currentPos = nextBracePos + 2;
            }
        }

        // Capture any remaining text after the last brace
        if (textStart < lineText.length) {
            tokens.push({ type: 'text', text: lineText.substring(textStart) });
        }

        // Filter out purely whitespace text tokens adjacent to tags that will cause newlines
        // (This simplification might lose some original whitespace, needs refinement for accurate mapping)
        const meaningfulTokens = tokens.filter((token, index, arr) => {
            if (token.type === 'text' && token.text.trim().length === 0) {
                const prevToken = index > 0 ? arr[index - 1] : null;
                const nextToken = index < arr.length - 1 ? arr[index + 1] : null;
                // Simple check: remove whitespace if next token is a tag (likely block start/end)
                if (nextToken && nextToken.type === 'tag' && (nextToken.text.startsWith('{{#') || nextToken.text.startsWith('{{/'))) return false;
                // Simple check: remove whitespace if previous token is a tag
                if (prevToken && prevToken.type === 'tag' && (prevToken.text.startsWith('{{#') || prevToken.text.startsWith('{{/'))) return false;
            }
            return true;
        });


        // Reconstruct the line (Simplified - needs proper indent handling based on tags)
        let reconstructedLine = '';
        let reconstructionIndentLevel = effectiveIndentLevelForThisLine;
        let firstToken = true;

        for (const token of meaningfulTokens) {
             let prefix = '';
             let currentIndentStr = indentChar.repeat(reconstructionIndentLevel);

             if (token.type === 'tag') {
                 const isBlockStart = token.text.startsWith('{{#');
                 const isBlockEnd = token.text.startsWith('{{/');

                 if (isBlockEnd) {
                     reconstructionIndentLevel = Math.max(0, reconstructionIndentLevel - 1);
                     currentIndentStr = indentChar.repeat(reconstructionIndentLevel); // Dedent *before* printing end tag
                 }

                 if (!firstToken) {
                     prefix = '\n'; // Assume tags often go on new lines (simplification)
                 }

                 reconstructedLine += prefix + currentIndentStr + token.text.trim(); // Trim whitespace around tags

                 if (isBlockStart) {
                     reconstructionIndentLevel++; // Indent *after* printing start tag
                 }

             } else { // Text token
                 const trimmedText = token.text.trim();
                 if (trimmedText.length > 0) {
                     if (!firstToken) {
                         // Check if previous was a tag, if so, newline + indent
                         const lastChar = reconstructedLine.length > 0 ? reconstructedLine[reconstructedLine.length - 1] : '';
                         if (lastChar === '}') { // Simple check if previous was likely a tag
                             prefix = '\n' + currentIndentStr;
                         } else {
                             prefix = ' '; // Add space between text/tags on same line
                         }
                     } else {
                         prefix = currentIndentStr; // Indent first text token
                     }
                     reconstructedLine += prefix + trimmedText;
                 }
             }
             firstToken = false;
        }
         // --- End of complex tokenization/reconstruction logic ---

        // Check if the reconstructed line is different from the original
        // We compare the core content (ignoring initial indent) and the indent separately
        const finalTrimmedLine = reconstructedLine.trim(); // Use reconstructed trim
        const originalTrimmedLine = lineText.trim(); // Use original trim for comparison

        if (finalTrimmedLine !== originalTrimmedLine || currentIndent !== correctIndent) {
             // If only indent changed, result is correctIndent + originalTrimmedLine
             if (finalTrimmedLine === originalTrimmedLine && currentIndent !== correctIndent) {
                 formattedLineContent = correctIndent + originalTrimmedLine;
             } else {
                 // Otherwise, use the fully reconstructed line
                 formattedLineContent = reconstructedLine;
             }
        }

    } else {
        // Inside a pure block, only check indentation
        correctIndent = indentChar.repeat(effectiveIndentLevelForThisLine);
        if (currentIndent !== correctIndent) {
            formattedLineContent = correctIndent + trimmedLine;
        }
        // Pure blocks don't change line count internally (usually)
        formattedLineCount = formattedLineContent === null ? 1 : formattedLineContent.split('\n').length;
    }

    // Calculate formatted line count based on the final content
    if (formattedLineContent !== null) {
        formattedLineCount = formattedLineContent.split('\n').length;
    } else {
        // If no content change, check if indent changed - still 1 line
        formattedLineCount = 1;
    }


    return {
        formattedText: formattedLineContent,
        nextState: { indentLevel: nextIndentLevel, inPureBlock: nextInPureBlock },
        formattedLineCount: formattedLineCount // Return the count
    };
}

// NEW: Function to format the entire document and generate source map
export function formatDocumentWithMapping(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions
): FullFormattingResult {
    const sourceMap: SourceMapEntry[] = [];
    let formattedLines: string[] = [];
    let currentState: FormattingState = { indentLevel: 0, inPureBlock: 0 };
    let currentFormattedLine = 0;

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const { formattedText, nextState, formattedLineCount } = formatLine(line, currentState, options);

        const actualTextToAdd = formattedText ?? line.text; // Use original if no change
        const linesToAdd = actualTextToAdd.split('\n');
        formattedLines.push(...linesToAdd);

        // Add mapping entry for this original line (Simplified)
        sourceMap.push({
            originalLine: i,
            formattedStartLine: currentFormattedLine,
            // End line is inclusive here
            formattedEndLine: currentFormattedLine + Math.max(0, formattedLineCount - 1)
        });

        currentFormattedLine += formattedLineCount; // Move to the next line number in formatted output
        currentState = nextState; // Update state for the next line
    }

    return {
        formattedText: formattedLines.join('\n'),
        sourceMap: sourceMap
    };
}


// calculateInitialFormattingState remains the same for now
export function calculateInitialFormattingState(
    document: vscode.TextDocument,
    targetLine: number,
    options: vscode.FormattingOptions
): FormattingState {
    let state: FormattingState = { indentLevel: 0, inPureBlock: 0 };

    for (let i = 0; i < targetLine; i++) {
        const line = document.lineAt(i);
        // Use the modified formatLine, but ignore its text/count output here
        const { nextState } = formatLine(line, state, options);
        state = nextState;
    }

    return state;
}

// NEW: Function to find the SourceMapEntry containing the formatted line
function findMapEntryForFormattedLine(sourceMap: SourceMapEntry[], formattedLine: number): SourceMapEntry | undefined {
    return sourceMap.find(entry => formattedLine >= entry.formattedStartLine && formattedLine <= entry.formattedEndLine);
}

// NEW: Function to navigate to the original line
export function goToOriginalLine(
    sourceMap: SourceMapEntry[],
    formattedPosition: vscode.Position,
    originalDocUri: vscode.Uri,
    targetViewColumn?: vscode.ViewColumn, // Optional target view column
    targetEditor?: vscode.TextEditor, // Optional: Editor to apply decoration
    decorationType?: vscode.TextEditorDecorationType // Optional: Decoration to apply
): void {
    const entry = findMapEntryForFormattedLine(sourceMap, formattedPosition.line);
    if (entry) {
        const targetLineNumber = entry.originalLine;

        // Find or open the original document
        vscode.workspace.openTextDocument(originalDocUri).then(doc => {
            // Ensure target line is valid
            if (targetLineNumber >= doc.lineCount) {
                vscode.window.showErrorMessage(`Original line number ${targetLineNumber} is out of bounds.`);
                return;
            }
            const targetLine = doc.lineAt(targetLineNumber);
            // Select the start of the line for navigation, but use full line range for highlight
            const targetPosition = new vscode.Position(targetLineNumber, 0);
            const selectionRange = new vscode.Range(targetPosition, targetPosition);
            const highlightRange = targetLine.range; // Highlight the whole line

            vscode.window.showTextDocument(doc, {
                selection: selectionRange, // Navigate to the start of the line
                viewColumn: targetViewColumn ?? vscode.ViewColumn.Active,
                preserveFocus: true,
                preview: false
            }).then(editor => {
                // Reveal the start of the line
                editor.revealRange(selectionRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

                // Apply temporary highlight to the whole line if editor and decorationType are provided
                if (targetEditor && decorationType && editor.document.uri.toString() === targetEditor.document.uri.toString()) {
                    targetEditor.setDecorations(decorationType, [highlightRange]); // Use highlightRange
                    // Remove the highlight after a short delay
                    setTimeout(() => {
                        targetEditor.setDecorations(decorationType, []);
                    }, 3000); // Highlight duration
                }
            });
        }, (err: any) => { // Add error handling for opening document
            vscode.window.showErrorMessage(`Error opening original document: ${err}`);
        });
    } else {
        vscode.window.showWarningMessage("Could not find original location mapping for this line.");
    }
}

// NEW: Function to navigate to the original character position (using text search)
export function goToOriginalCharacter(
    sourceMap: SourceMapEntry[],
    formattedSelection: vscode.Selection,
    formattedDoc: vscode.TextDocument, // Need the formatted doc content
    originalDocUri: vscode.Uri,
    targetViewColumn?: vscode.ViewColumn, // Optional target view column
    targetEditor?: vscode.TextEditor, // Optional: Editor to apply decoration
    decorationType?: vscode.TextEditorDecorationType // Optional: Decoration to apply
): void {
    const startLine = formattedSelection.start.line;

    // Find the map entry for the start of the selection
    const startEntry = findMapEntryForFormattedLine(sourceMap, startLine);

    if (!startEntry) {
        vscode.window.showWarningMessage("Could not find original location mapping for the start of the selection.");
        return;
    }

    const originalTargetLineNumber = startEntry.originalLine;

    // Get the selected text from the formatted document
    let selectedText = formattedDoc.getText(formattedSelection);
    selectedText = selectedText.trim(); // Trim whitespace
    if (!selectedText || selectedText.trim().length === 0) {
        vscode.window.showInformationMessage("Please select some text to find its original location.");
        return; // Nothing selected or only whitespace
    }

    // Open the original document and search within the target line
    vscode.workspace.openTextDocument(originalDocUri).then(originalDoc => {
        if (originalTargetLineNumber >= originalDoc.lineCount) {
             vscode.window.showErrorMessage(`Original line number ${originalTargetLineNumber} is out of bounds.`);
             return;
        }
        const originalLine = originalDoc.lineAt(originalTargetLineNumber);
        const originalLineText = originalLine.text;

        // Search for the selected text within the original line
        const foundIndex = originalLineText.indexOf(selectedText);

        if (foundIndex !== -1) {
            // Found it! Calculate the range in the original document
            const originalStartPosition = new vscode.Position(originalTargetLineNumber, foundIndex);
            const originalEndPosition = new vscode.Position(originalTargetLineNumber, foundIndex + selectedText.length);
            const originalRange = new vscode.Range(originalStartPosition, originalEndPosition);

            // Show the original document and select the range
            vscode.window.showTextDocument(originalDoc, {
                selection: originalRange, // Select the found text
                viewColumn: targetViewColumn ?? vscode.ViewColumn.Active,
                preserveFocus: true,
                preview: false
            }).then(editor => {
                // Reveal the range
                editor.revealRange(originalRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

                // Apply temporary highlight if editor and decorationType are provided
                if (targetEditor && decorationType && editor.document.uri.toString() === targetEditor.document.uri.toString()) {
                    targetEditor.setDecorations(decorationType, [originalRange]);
                    // Remove the highlight after a short delay
                    setTimeout(() => {
                        targetEditor.setDecorations(decorationType, []);
                    }, 3000); // Highlight duration
                }
            });

        } else {
            // If not found on the mapped line
            // For now, just show a message. The formatting might have changed the text too much.
            vscode.window.showWarningMessage(`Could not find the exact text "${selectedText}" in the original line ${originalTargetLineNumber + 1}. Formatting might have altered it.`);
            // As a fallback, maybe just go to the start of the original line?
             goToOriginalLine(sourceMap, formattedSelection.start, originalDocUri, targetViewColumn); // Pass view column to fallback
        }
    }, (err: any) => { // Attach catch to openTextDocument promise and type err
         vscode.window.showErrorMessage(`Error opening original document: ${err}`);
    });
}
