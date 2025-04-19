import * as vscode from 'vscode';

export interface FormattingState {
    indentLevel: number;
    inPureBlock: number;
}

export interface LineFormattingResult {
    formattedText: string | null; // Null if no change needed for this line's content (indent might still change)
    nextState: FormattingState;
}

const blockStartRegex = /\{\{#([\w-]+)/; // Matches {{#command
const pureBlockStartRegex = /\{\{#(if-pure|pure_display)/; // Add other pure blocks if needed
const blockEndRegex = /\{\{\/(?:[\w-]+)?\}\}|\{\{\/\}\}/; // Matches {{/command}} or {{/}}

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

    // Calculate indent changes based on tags on this line
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
        // Empty lines don't change the state for the next line
        return { formattedText: formattedLineContent, nextState: { indentLevel: indentLevel, inPureBlock: inPureBlock } };
    }


    if (inPureBlock === 0) {
        // Apply complex formatting only outside pure blocks
        correctIndent = indentChar.repeat(effectiveIndentLevelForThisLine);

        // --- Start of complex tokenization/reconstruction logic ---
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
                // No more braces found, break the loop
                break;
            }

            // Capture text before the brace if outside a tag
            if (nextBracePos > textStart && braceLevel === 0) {
                const textBefore = lineText.substring(textStart, nextBracePos);
                if (textBefore.trim().length === 0) {
                    tokens.push({ type: 'raw_text', text: textBefore });
                } else {
                    tokens.push({ type: 'text', text: textBefore });
                }
            }

            if (isOpening) {
                if (braceLevel === 0) {
                    tagStart = nextBracePos; // Mark start of potential tag
                }
                braceLevel++;
                currentPos = nextBracePos + 2;
            } else { // Closing brace
                if (braceLevel > 0) {
                    braceLevel--;
                    if (braceLevel === 0 && tagStart !== -1) {
                        // We've closed the outermost brace, capture the tag
                        const tagEnd = nextBracePos + 2;
                        const tagText = lineText.substring(tagStart, tagEnd);

                        if (tagText.startsWith('{{#')) {
                            tokens.push({ type: 'block_start', text: tagText });
                        } else if (tagText.startsWith('{{/')) {
                            tokens.push({ type: 'block_end', text: tagText });
                        } else {
                            tokens.push({ type: 'simple_tag', text: tagText });
                        }
                        textStart = tagEnd; // Update start position for next text segment
                        tagStart = -1; // Reset tag start marker
                    }
                }
                currentPos = nextBracePos + 2;
            }
        }

        // Capture any remaining text after the last brace
        if (textStart < lineText.length) {
            const textAfter = lineText.substring(textStart);
            if (textAfter.trim().length === 0) {
                tokens.push({ type: 'raw_text', text: textAfter });
            } else {
                tokens.push({ type: 'text', text: textAfter });
            }
        }

        // Filter out meaningless tokens (e.g., empty text tokens)
        const meaningfulTokens = tokens.filter(t => {
            if (t.type === 'raw_text') return true; // Keep raw whitespace/newlines
            if (t.type === 'text') return t.text.trim().length > 0; // Keep non-empty text
            return true; // Keep all tags
        });


        // Reconstruct the line from tokens
        let reconstructedLine = '';
        let needsInitialIndent = true;
        let reconstructionIndentLevel = effectiveIndentLevelForThisLine; // Use the calculated indent for this line

        for (let index = 0; index < meaningfulTokens.length; index++) {
            const currentToken = meaningfulTokens[index];
            const isFirstToken = index === 0;
            const isLastToken = index === meaningfulTokens.length - 1;
            const isBlockTag = currentToken.type === 'block_start' || currentToken.type === 'block_end';
            const previousToken = isFirstToken ? null : meaningfulTokens[index - 1];
            const nextToken = isLastToken ? null : meaningfulTokens[index + 1];

            let prefix = ''; // Whitespace/newline to add before the token

            // Determine if a newline is needed before this token
            if (!isFirstToken) {
                if (isBlockTag) {
                    prefix = '\n'; // Block tags always start on a new line
                } else if (previousToken && (previousToken.type === 'block_start' || previousToken.type === 'block_end')) {
                    prefix = '\n'; // Content after a block tag starts on a new line
                } else if (currentToken.type === 'simple_tag' && previousToken && previousToken.type === 'raw_text' && previousToken.text.includes('\n')) {
                    // If the raw text before a simple tag contained a newline, preserve that structure
                     needsInitialIndent = true; // Need to re-apply indent after newline
                 } else if (currentToken.type === 'text' && previousToken && previousToken.type === 'raw_text' && previousToken.text.includes('\n')) {
                     needsInitialIndent = true;
                 }
            }

            // Adjust indent level for reconstruction *before* processing end tags
            if (currentToken.type === 'block_end') {
                reconstructionIndentLevel = Math.max(0, reconstructionIndentLevel - 1);
            }

            let indentToApply = '';
            if (prefix.includes('\n') || (isFirstToken && needsInitialIndent)) {
                indentToApply = indentChar.repeat(reconstructionIndentLevel);
                needsInitialIndent = false; // Indent applied
            }

            let tokenContent: string;

            // Get and clean token content
            if (currentToken.type === 'block_start' || currentToken.type === 'block_end' || currentToken.type === 'simple_tag') {
                tokenContent = currentToken.text;
            } else if (currentToken.type === 'text') {
                tokenContent = currentToken.text;
                // Trim start only if it's preceded by a newline (or is the first token)
                if (prefix.includes('\n') || (isFirstToken && indentToApply)) {
                    tokenContent = tokenContent.trimStart();
                }
                // Trim end if it's followed by a newline-inducing token or is the last token
                let nextIsNewline = false;
                if (nextToken) {
                    if (nextToken.type === 'block_start' || nextToken.type === 'block_end') nextIsNewline = true;
                    if (nextToken.type === 'raw_text' && nextToken.text.startsWith('\n')) nextIsNewline = true;
                }
                if (nextIsNewline || isLastToken) {
                    tokenContent = tokenContent.trimEnd();
                }
                if (tokenContent.length === 0 && !prefix.includes('\n')) continue; // Skip empty, non-newline text
            } else if (currentToken.type === 'raw_text') {
                 tokenContent = currentToken.text;
                 // If raw text contains a newline, reset indent needs for the next token
                 if (tokenContent.includes('\n')) {
                     needsInitialIndent = true;
                     indentToApply = ''; // Don't indent the raw newline itself
                     prefix = ''; // Don't add extra newline before raw text containing one
                 }
                 // Don't add raw text if it's just whitespace and adjacent to block tags or newlines
                 const prevNeedsNewline = previousToken && (previousToken.type === 'block_start' || previousToken.type === 'block_end');
                 const nextNeedsNewline = nextToken && (nextToken.type === 'block_start' || nextToken.type === 'block_end' || (nextToken.type === 'raw_text' && nextToken.text.startsWith('\n')));
                 if (tokenContent.trim().length === 0 && (prevNeedsNewline || nextNeedsNewline || prefix.includes('\n'))) {
                     // If it's just whitespace surrounded by things that cause newlines, skip it
                     // unless it contains a newline itself
                     if (!tokenContent.includes('\n')) continue;
                 }

                 if (tokenContent.length === 0) continue; // Skip empty raw text
             } else {
                 continue; // Should not happen
            }

            reconstructedLine += prefix + indentToApply + tokenContent;

            // Adjust indent level for reconstruction *after* processing start tags
            if (currentToken.type === 'block_start') {
                reconstructionIndentLevel++;
            }
        }
         // --- End of complex tokenization/reconstruction logic ---

        // Check if the reconstructed line is different from the original
        // We compare the core content (ignoring initial indent) and the indent separately
        const finalTrimmedLine = reconstructedLine.trim();
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
    }

    return {
        formattedText: formattedLineContent,
        nextState: { indentLevel: nextIndentLevel, inPureBlock: nextInPureBlock }
    };
}

export function calculateInitialFormattingState(
    document: vscode.TextDocument,
    targetLine: number,
    options: vscode.FormattingOptions
): FormattingState {
    let state: FormattingState = { indentLevel: 0, inPureBlock: 0 };

    for (let i = 0; i < targetLine; i++) {
        const line = document.lineAt(i);
        // We only need to calculate the state change, not the formatted text
        const { nextState } = formatLine(line, state, options);
        state = nextState;
    }

    return state;
}
