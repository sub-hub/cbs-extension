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
        // Helper function to identify inline tags
        function isInlineTag(tag: string): boolean {
            return /\{\{(user|char|bot)\}\}/.test(tag);
        }

        interface Token {
            type: 'text' | 'tag';
            text: string;
            preserveWhitespace?: boolean;
        }

        const tokens: Token[] = [];
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
                const nextTag = lineText.substring(nextBracePos).match(/\{\{(user|char|bot)\}\}/);
                // If next tag is an inline tag, preserve whitespace
                tokens.push({ 
                    type: 'text', 
                    text: textBefore,
                    preserveWhitespace: nextTag !== null
                });
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

        // Only filter out whitespace for non-inline tags
        const meaningfulTokens = tokens.filter((token, index, arr) => {
            if (token.type === 'text' && token.text.trim().length === 0 && !token.preserveWhitespace) {
                const nextToken = index < arr.length - 1 ? arr[index + 1] : null;
                // Only remove whitespace if next token is a block tag
                if (nextToken && nextToken.type === 'tag' && !isInlineTag(nextToken.text) && 
                    (nextToken.text.startsWith('{{#') || nextToken.text.startsWith('{{/'))) {
                    return false;
                }
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
                 const isInline = isInlineTag(token.text);

                 if (isBlockEnd) {
                     reconstructionIndentLevel = Math.max(0, reconstructionIndentLevel - 1);
                     currentIndentStr = indentChar.repeat(reconstructionIndentLevel); // Dedent *before* printing end tag
                 }

                 if (!firstToken) {
                     // Only add newline for non-inline tags
                     if (!isInline) {
                         prefix = '\n'; // Add newlines only for block tags and other non-inline tags
                     } else {
                         prefix = ''; // No extra space needed for inline tags
                     }
                 }

                 // For inline tags, don't add indentation
                     reconstructedLine += prefix + (isInline ? '' : currentIndentStr) + token.text;

                 if (isBlockStart) {
                     reconstructionIndentLevel++; // Indent *after* printing start tag
                 }

             } else { // Text token
                 if (token.text.length > 0) {
                     if (!firstToken) {
                         // Check if previous was a tag
                         const lastChar = reconstructedLine.length > 0 ? reconstructedLine[reconstructedLine.length - 1] : '';
                         const prevToken = meaningfulTokens[meaningfulTokens.indexOf(token) - 1];
                         const isPrevInline = prevToken?.type === 'tag' && isInlineTag(prevToken.text);
                         
                         if (lastChar === '}' && !isPrevInline) {
                             prefix = '\n' + currentIndentStr;
                         } else if (!token.preserveWhitespace) {
                             prefix = ' '; // Add space between text/tags on same line
                         } else {
                             prefix = ''; // Keep original spacing for inline tags
                         }
                     } else {
                         prefix = currentIndentStr; // Indent first text token
                     }
                     // Use original text if preserving whitespace, otherwise trim
                     reconstructedLine += prefix + (token.preserveWhitespace ? token.text : token.text.trim());
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
                preserveFocus: false,
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
                    }, 1500); // Highlight duration
                }
            });
        }, (err: any) => { // Add error handling for opening document
            vscode.window.showErrorMessage(`Error opening original document: ${err}`);
        });
    } else {
        vscode.window.showWarningMessage("Could not find original location mapping for this line.");
    }
}

// NEW: Interface for goToOriginalCharacter arguments
interface GoToOriginalCharArgs {
    sourceMap: SourceMapEntry[];
    previewSelectionForMapping: vscode.Selection; // Selection used to find the original line (might be user selection or derived line selection)
    previewLineText?: string;                     // Full text of the relevant preview line (trimmed if derived)
    previewSelectedText?: string;                 // Text selected by user (trimmed if derived)
    originalDocUri: vscode.Uri;
    originalCursorPosition?: vscode.Position;     // The actual position clicked by the user in the preview (if not a drag)
    targetViewColumn?: vscode.ViewColumn;
    targetEditor?: vscode.TextEditor;
    decorationType?: vscode.TextEditorDecorationType;
}


// NEW: Function to navigate to the original character position (using text search)
export function goToOriginalCharacter(args: GoToOriginalCharArgs): void {
    const {
        sourceMap,
        previewSelectionForMapping,
        previewLineText,
        previewSelectedText,
        originalDocUri,
        originalCursorPosition,
        targetViewColumn,
        targetEditor,
        decorationType
    } = args;

    // Handle cases where essential text is missing (e.g., empty line click)
    if (!previewSelectedText || previewSelectedText.trim().length === 0) {
        // If text is empty, fall back to line navigation using the mapping selection start
        console.log("goToOriginalCharacter: No selected text provided, falling back to line navigation.");
        goToOriginalLine(
            sourceMap,
            previewSelectionForMapping.start, // Use the start of the selection used for mapping
            originalDocUri,
            targetViewColumn,
            targetEditor,
            decorationType
        );
        return;
    }
     // Also check previewLineText, although it should generally exist if previewSelectedText does
     if (!previewLineText || previewLineText.trim().length === 0) {
        console.warn("goToOriginalCharacter: previewLineText is missing or empty, falling back to simpler search.");
        // Fallback logic might be needed here, perhaps just searching for previewSelectedText directly
        // For now, let's proceed but the more robust search might fail.
    }


    // Use the start line from the selection that was used for mapping
    const startLine = previewSelectionForMapping.start.line;

    // Find the map entry for the start of the selection
    const startEntry = findMapEntryForFormattedLine(sourceMap, startLine);

    if (!startEntry) {
        vscode.window.showWarningMessage("Could not find original location mapping for the start of the selection.");
        return;
    }

    const originalTargetLineNumber = startEntry.originalLine;
    const searchText = previewSelectedText.trim(); // Use the trimmed selected text for searching
    const searchLineText = previewLineText?.trim(); // Use the trimmed line text for the primary search

    // Open the original document and search within the target line
    vscode.workspace.openTextDocument(originalDocUri).then(originalDoc => {
        if (originalTargetLineNumber >= originalDoc.lineCount) {
             vscode.window.showErrorMessage(`Original line number ${originalTargetLineNumber + 1} is out of bounds.`);
             return;
        }
        const originalLine = originalDoc.lineAt(originalTargetLineNumber);
        const originalLineText = originalLine.text;

        // --- NEW Selected Text Search Logic ---
        let foundLineIndex = -1;
        // Only search for the line text if it was provided and different from the selected text
        if (searchLineText && searchLineText !== searchText) {
            foundLineIndex = originalLineText.indexOf(searchLineText);
        }

        let foundSelectionIndex = -1;
        let searchStartIndexForSelection = 0;

        if (foundLineIndex !== -1 && searchLineText) { // Add check for searchLineText here
            // If the line was found, search for the selection *within* that found line segment
            searchStartIndexForSelection = foundLineIndex;
            // Now searchLineText is guaranteed to be a string
            const lineSegment = originalLineText.substring(foundLineIndex, foundLineIndex + searchLineText.length);
            foundSelectionIndex = lineSegment.indexOf(searchText);
            if (foundSelectionIndex !== -1) {
                // Adjust index to be relative to the start of the original line
                foundSelectionIndex += foundLineIndex;
            }
             console.log(`Found line text "${searchLineText}" at index ${foundLineIndex}. Searching for "${searchText}" within it.`);
        } else {
            // If the full line wasn't found (or wasn't searched for), search the entire original line for the selected text
            console.log(`Line text "${searchLineText}" not found or not searched. Searching entire original line for "${searchText}".`);
            foundSelectionIndex = originalLineText.indexOf(searchText);
            searchStartIndexForSelection = 0; // Search started from beginning of original line
        }
        // --- END NEW SEARCH LOGIC ---


        if (foundSelectionIndex !== -1) {
            // Found the selected text!
            console.log(`Found selected text "${searchText}" at index ${foundSelectionIndex} in original line.`);
            let originalSelection: vscode.Selection;
            const originalStartPosition = new vscode.Position(originalTargetLineNumber, foundSelectionIndex);
            const originalEndPosition = new vscode.Position(originalTargetLineNumber, foundSelectionIndex + searchText.length);

            if (originalCursorPosition) {
                // CLICK CASE: Map character offset relative to the start of the *found selection*
                console.log("Click detected. Calculating precise cursor position.");
                // Find start character of the *selected text* within the *preview line*
                const selectedTextStartIndexInPreview = previewLineText?.indexOf(searchText) ?? -1;

                let targetCharIndex = foundSelectionIndex; // Default to start of found text

                if (selectedTextStartIndexInPreview !== -1 && previewLineText) {
                    // Calculate the offset of the click *relative to the start of the matched text* in the preview
                    const clickOffsetRelativeToFoundText = originalCursorPosition.character - selectedTextStartIndexInPreview;
                    // Clamp the offset to be within the bounds of the found text length in the original
                    const safeOffset = Math.max(0, Math.min(clickOffsetRelativeToFoundText, searchText.length));
                    targetCharIndex = foundSelectionIndex + safeOffset;
                    console.log(`Preview click offset relative to found text: ${clickOffsetRelativeToFoundText}, Safe offset: ${safeOffset}, Target char index: ${targetCharIndex}`);
                } else {
                    console.warn("Could not find selected text start in preview line or previewLineText missing; placing cursor at start of found text in original.");
                }

                const targetPosition = new vscode.Position(originalTargetLineNumber, targetCharIndex);
                originalSelection = new vscode.Selection(targetPosition, targetPosition); // Zero-width selection
            } else {
                // DRAG CASE: Select the entire found range of the selected text.
                 console.log("Drag detected. Selecting the entire found range.");
                originalSelection = new vscode.Selection(originalStartPosition, originalEndPosition);
            }

            // Define the range of the *found selected text* for highlighting
            const originalHighlightRange = new vscode.Range(originalStartPosition, originalEndPosition);

            // Show the original document and set the calculated selection
            vscode.window.showTextDocument(originalDoc, {
                selection: originalSelection,
                viewColumn: targetViewColumn ?? vscode.ViewColumn.Active,
                preserveFocus: false,
                preview: false
            }).then(editor => {
                editor.revealRange(originalSelection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

                if (targetEditor && decorationType && editor.document.uri.toString() === targetEditor.document.uri.toString()) {
                    console.log(`Applying decoration to range: [${originalHighlightRange.start.line}, ${originalHighlightRange.start.character}] to [${originalHighlightRange.end.line}, ${originalHighlightRange.end.character}]`);
                    targetEditor.setDecorations(decorationType, [originalHighlightRange]);
                    setTimeout(() => {
                        targetEditor.setDecorations(decorationType, []);
                    }, 3000);
                } else {
                     console.log("Skipping decoration: Target editor or decoration type not provided or editor mismatch.");
                }
            });

        } else {
            // If the selected text was not found even after trying the line search
            vscode.window.showWarningMessage(`Could not find the exact text "${searchText}" in the original line ${originalTargetLineNumber + 1}. Formatting might have altered it.`);
            // Fallback to line navigation
            console.log("Selected text not found, falling back to line navigation.");
            goToOriginalLine(
                sourceMap,
                previewSelectionForMapping.start, // Use the start of the selection used for mapping
                originalDocUri,
                targetViewColumn,
                targetEditor,
                decorationType
            );
        }
    }, (err: any) => {
         vscode.window.showErrorMessage(`Error opening original document: ${err}`);
    });
}
