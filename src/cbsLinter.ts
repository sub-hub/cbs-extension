import * as vscode from 'vscode';
// Import the new findAllCommandInfo function
import { cbsCommandsData, findCommandInfo, findAllCommandInfo, CbsCommandInfo } from './cbsData'; // Assuming cbsData exports necessary types

// --- Interfaces ---
interface VariableLocation {
    name: string;
    location: vscode.Location;
    isDefinition: boolean;
    // Add scope information if needed later
}

// --- Regular Expressions (Moved from extension.ts) ---
const varDefinitionRegex = /\{\{(?:setvar|settempvar)::([a-zA-Z0-9_]+)::/gi;
const varReferenceGetRegex = /\{\{(?:getvar|gettempvar|getglobalvar)::([a-zA-Z0-9_]+)\}\}/gi;
const varReferenceDollarRegex = /\{\{(?:\?|calc)::.*?\$([a-zA-Z0-9_]+).*?\}\}/gi;
const blockStartRegex = /\{\{#([\w-]+)/;
const pureBlockStartRegex = /\{\{#(if-pure|pure_display)/; // Add other pure blocks if needed
const blockEndRegex = /\{\{\/(?:[\w-]+)?\}\}|\{\{\/\}\}/; // Matches {{/command}} or {{/}}

/**
 * Manages CBS language diagnostics and linting logic.
 */
export class CbsLinter {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private debounceTimer: NodeJS.Timeout | undefined;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('cbsLinting');
    }

    /**
     * Activates the linter, setting up event listeners.
     * @param context The extension context.
     */
    public activate(context: vscode.ExtensionContext): void {
        // Initial linting for already open files
        if (vscode.window.activeTextEditor) {
            if (this.isCbsDocument(vscode.window.activeTextEditor.document)) {
                this.updateDiagnostics(vscode.window.activeTextEditor.document);
            }
        }

        context.subscriptions.push(
            // Lint when a file is opened
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor && this.isCbsDocument(editor.document)) {
                    this.updateDiagnostics(editor.document);
                }
            }),

            // Lint when a file is saved
            vscode.workspace.onDidSaveTextDocument(document => {
                if (this.isCbsDocument(document)) {
                    this.updateDiagnostics(document);
                }
            }),

            // Lint on change (debounced)
            vscode.workspace.onDidChangeTextDocument(event => {
                if (this.isCbsDocument(event.document)) {
                    if (this.debounceTimer) {
                        clearTimeout(this.debounceTimer);
                    }
                    this.debounceTimer = setTimeout(() => {
                        this.updateDiagnostics(event.document);
                    }, 500); // 500ms debounce
                }
            }),

            // Clear diagnostics when a file is closed
            vscode.workspace.onDidCloseTextDocument(document => {
                this.diagnosticCollection.delete(document.uri);
            }),

            // Dispose the collection on deactivation
            this.diagnosticCollection
        );
    }

    /**
     * Disposes the diagnostic collection.
     */
    public dispose(): void {
        this.diagnosticCollection.dispose();
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }

    /**
     * Checks if a document is a CBS language file.
     * @param document The document to check.
     */
    private isCbsDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'cbs';
    }

    /**
     * Updates the diagnostics for a given document.
     * @param document The document to lint.
     */
    public updateDiagnostics(document: vscode.TextDocument): void {
        if (!this.isCbsDocument(document)) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];

        // --- Call individual checker functions ---
        diagnostics.push(...this.checkBlockMismatch(document));
        diagnostics.push(...this.checkCommandUsage(document));
        diagnostics.push(...this.checkVariableUsage(document));
        diagnostics.push(...this.checkGeneralSyntax(document));
        // --- Add more checks as needed ---

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    // =========================================================================
    // --- Individual Checker Functions (Implementations needed) ---
    // =========================================================================

    /**
     * Checks for mismatched block tags (e.g., {{#if}} without {{/if}}).
     * @param document The document to check.
     * @returns An array of diagnostics for mismatched blocks.
     */
    private checkBlockMismatch(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const blockStack: { name: string; range: vscode.Range; line: number }[] = [];
        const text = document.getText();
        
        // Parse through the entire text to handle multi-line tags
        let index = 0;
        let line = 0;
        let lineStart = 0;
        
        while (index < text.length) {
            // Track line numbers
            if (text[index] === '\n') {
                line++;
                lineStart = index + 1;
            }
            
            // Look for opening {{
            if (text.substring(index, index + 2) === '{{') {
                // Find the closing }}
                let braceCount = 1;
                let endIndex = index + 2;
                
                while (endIndex < text.length && braceCount > 0) {
                    if (text.substring(endIndex, endIndex + 2) === '{{') {
                        braceCount++;
                        endIndex += 2;
                    } else if (text.substring(endIndex, endIndex + 2) === '}}') {
                        braceCount--;
                        if (braceCount === 0) {
                            endIndex += 2;
                            break;
                        }
                        endIndex += 2;
                    } else {
                        endIndex++;
                    }
                }
                
                // Extract the tag content
                const fullTag = text.substring(index, endIndex);
                const tagContent = fullTag.substring(2, fullTag.length - 2).trim();
                
                // Calculate position
                const startLine = line;
                const startChar = index - lineStart;
                const endLine = line + (fullTag.match(/\n/g) || []).length;
                const endChar = endLine === startLine ? startChar + fullTag.length : fullTag.length - fullTag.lastIndexOf('\n') - 1;
                
                const startPos = new vscode.Position(startLine, startChar);
                const endPos = new vscode.Position(endLine, endChar);
                const range = new vscode.Range(startPos, endPos);
                
                // Check if it's a block start tag
                if (tagContent.startsWith('#')) {
                    // Extract block name (e.g., "when" from "#when::condition" or "if" from "#if true")
                    const blockMatch = tagContent.match(/^#([\w-]+)/);
                    if (blockMatch) {
                        const blockName = blockMatch[1];
                        blockStack.push({ name: blockName, range: range, line: startLine });
                    }
                }
                // Check if it's a block end tag
                else if (tagContent.startsWith('/')) {
                    // In RisuAI, any {{/...}} closes a block
                    const openTag = blockStack.pop();
                    
                    if (!openTag) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Unexpected closing tag '${fullTag.trim()}'. No matching opening tag found.`,
                            vscode.DiagnosticSeverity.Error
                        ));
                    }
                }
                
                index = endIndex;
            } else {
                index++;
            }
        }
        
        // Any remaining tags on the stack are unclosed
        blockStack.forEach(unclosedTag => {
            diagnostics.push(new vscode.Diagnostic(
                unclosedTag.range,
                `Unclosed block tag '{{#${unclosedTag.name}}}' on line ${unclosedTag.line + 1}. No matching closing tag found.`,
                vscode.DiagnosticSeverity.Error
            ));
        });

        return diagnostics;
    }

    /**
     * Checks for incorrect command usage (parameter count, unknown commands).
     * @param document The document to check.
     * @returns An array of diagnostics for command usage errors.
     */
    // Helper to find the first top-level occurrence of a separator (e.g., '::')
    private findTopLevelSeparator(text: string, separator: string): number {
        let braceLevel = 0;
        for (let i = 0; i <= text.length - separator.length; i++) {
            if (text.substring(i, i + 2) === '{{') {
                braceLevel++;
                i++; // consume '{{'
            } else if (text.substring(i, i + 2) === '}}') {
                braceLevel--;
                i++; // consume '}}'
            } else if (braceLevel === 0 && text.substring(i, i + separator.length) === separator) {
                return i;
            }
        }
        return -1;
    }

    // Helper to split parameters string respecting nested braces for '::'
    private splitCbsParamsSmart(paramString: string): string[] {
        const params: string[] = [];
        if (!paramString.trim()) return params;

        let currentParamStartIndex = 0;
        let braceLevel = 0;
        for (let i = 0; i < paramString.length; i++) {
            if (paramString.substring(i, i + 2) === '{{') {
                braceLevel++;
                i++; 
            } else if (paramString.substring(i, i + 2) === '}}') {
                braceLevel--;
                i++; 
            } else if (paramString.substring(i, i + 2) === '::' && braceLevel === 0) {
                params.push(paramString.substring(currentParamStartIndex, i));
                currentParamStartIndex = i + 2; // Move past '::'
                i++; 
            }
        }
        params.push(paramString.substring(currentParamStartIndex)); // Add the last parameter
        return params;
    }
    

    private lintRecursive(
        tagContentWithBraces: string,
        document: vscode.TextDocument,
        rangeForThisTag: vscode.Range,
        parentDocumentOffsetForTag: number,
        currentDepth: number = 0
    ): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const MAX_RECURSION_DEPTH = 10;

        if (currentDepth > MAX_RECURSION_DEPTH) {
            diagnostics.push(new vscode.Diagnostic(rangeForThisTag, `Excessive tag nesting depth (${currentDepth}). Linting stopped for this branch.`, vscode.DiagnosticSeverity.Warning));
            return diagnostics;
        }

        const tagContent = tagContentWithBraces.slice(2, -2).trim();

        if (!tagContent || tagContent.startsWith('/') || tagContent.startsWith('?')) {
            return diagnostics; // Skip empty, end tags, and calc/question mark tags from this level of command processing
        }

        // Skip :else special keyword (not a command)
        if (tagContent === ':else') {
            return diagnostics;
        }

        let commandName: string;
        let paramsString: string = ""; // Raw string of all parameters
        let paramsArray: string[];    // Parameters split, maintaining original spacing from paramsString
        let isBlockTag = false;
        let isPrefixCommand = false;

        if (tagContent.startsWith('#')) {
            isBlockTag = true;
            // Check for '::' separator first (e.g., {{#when::condition::and::condition2}})
            const doubleSeparatorIdx = this.findTopLevelSeparator(tagContent, '::');
            if (doubleSeparatorIdx !== -1) {
                commandName = tagContent.substring(0, doubleSeparatorIdx);
                paramsString = tagContent.substring(doubleSeparatorIdx + 2);
                paramsArray = this.splitCbsParamsSmart(paramsString);
            } else {
                // Fall back to space-based parsing (e.g., {{#each array item}})
                const firstSpaceIdx = tagContent.indexOf(' ');
                if (firstSpaceIdx !== -1) {
                    commandName = tagContent.substring(0, firstSpaceIdx);
                    paramsString = tagContent.substring(firstSpaceIdx + 1); // Retain original spacing for offset calculations
                } else { // Block tag with no parameters (e.g., {{#pure}})
                    commandName = tagContent;
                    paramsString = "";
                }
                paramsArray = this.splitCbsParamsSmart(paramsString);
            }
        } else { // Regular command
            isBlockTag = false;
            
            // Check for prefix command syntax (single ':' not followed by another ':')
            // First, try to find '::' 
            const doubleSeparatorIdx = this.findTopLevelSeparator(tagContent, '::');
            
            if (doubleSeparatorIdx !== -1) {
                // Standard '::' separator
                commandName = tagContent.substring(0, doubleSeparatorIdx);
                paramsString = tagContent.substring(doubleSeparatorIdx + 2);
                paramsArray = this.splitCbsParamsSmart(paramsString);
            } else {
                // No '::' found, try single ':'
                const prefixSeparatorIdx = this.findTopLevelSeparator(tagContent, ':');
                
                if (prefixSeparatorIdx !== -1) {
                    // Prefix command with single ':'
                    isPrefixCommand = true;
                    commandName = tagContent.substring(0, prefixSeparatorIdx);
                    paramsString = tagContent.substring(prefixSeparatorIdx + 1); // Skip single ':'
                    // For prefix commands, don't split by '::' - treat rest as single parameter
                    paramsArray = [paramsString]; // Simplified: treat as single param
                } else {
                    // No separator - command only
                    commandName = tagContent;
                    paramsString = "";
                    paramsArray = [];
                }
            }
        }
        
        const numParamsProvided = paramsArray.length;

        // Validate command and parameter count for non-block tags
        if (!isBlockTag) {
            const commandInfos = findAllCommandInfo(commandName);
            if (commandInfos.length === 0) {
                // Allow known variable manipulation commands even if not in cbsCommandsData explicitly for this check
                if (!['setvar', 'settempvar', 'getvar', 'gettempvar', 'getglobalvar'].includes(commandName)) {
                    diagnostics.push(new vscode.Diagnostic(rangeForThisTag, `Unknown command '${commandName}'.`, vscode.DiagnosticSeverity.Error));
                }
            } else {
                // Check for deprecated commands
                for (const commandInfo of commandInfos) {
                    if (commandInfo.deprecated) {
                        const message = commandInfo.deprecated.replacement 
                            ? `Command '${commandName}' is deprecated. ${commandInfo.deprecated.message} Use '${commandInfo.deprecated.replacement}' instead.`
                            : `Command '${commandName}' is deprecated. ${commandInfo.deprecated.message}`;
                        diagnostics.push(new vscode.Diagnostic(
                            rangeForThisTag,
                            message,
                            vscode.DiagnosticSeverity.Warning
                        ));
                        break; // Only show one deprecation warning per command
                    }
                }

                let isValidUsage = false;
                for (const commandInfo of commandInfos) {
                    // For prefix commands, skip strict parameter count validation
                    // since they often have flexible syntax (e.g., roll:6 or roll:2d10)
                    if (isPrefixCommand && commandInfo.isPrefixCommand) {
                        isValidUsage = true;
                        break;
                    }
                    
                    const requiredParams = commandInfo.parameters?.filter(p => !p.label.includes('optional') && !p.label.startsWith('[') && !p.label.endsWith('?]')).length ?? 0;
                    const totalExpectedParams = commandInfo.parameters?.length ?? 0;
                    const allowsVariableParams = commandInfo.signatureLabel.includes('...');

                    if (allowsVariableParams) {
                        if (numParamsProvided >= requiredParams) {
                            isValidUsage = true;
                            break;
                        }
                    } else { 
                        if (numParamsProvided >= requiredParams && numParamsProvided <= totalExpectedParams) {
                            isValidUsage = true;
                            break;
                        }
                    }
                }
                if (!isValidUsage) {
                    const possibleSignatures = commandInfos.map(ci => `{{${ci.signatureLabel}}}`).join(' or ');
                    diagnostics.push(new vscode.Diagnostic(
                        rangeForThisTag,
                        `Incorrect parameter count for command '${commandName}'. Provided ${numParamsProvided} parameter(s). Valid signature(s): ${possibleSignatures}`,
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            }
        }
        // Check for deprecated block commands
        else if (isBlockTag) {
            const blockCommandName = commandName; // Already includes # prefix
            const commandInfos = findAllCommandInfo(blockCommandName);
            for (const commandInfo of commandInfos) {
                if (commandInfo.deprecated) {
                    const message = commandInfo.deprecated.replacement 
                        ? `Block '${blockCommandName}' is deprecated. ${commandInfo.deprecated.message} Use '${commandInfo.deprecated.replacement}' instead.`
                        : `Block '${blockCommandName}' is deprecated. ${commandInfo.deprecated.message}`;
                    diagnostics.push(new vscode.Diagnostic(
                        rangeForThisTag,
                        message,
                        vscode.DiagnosticSeverity.Warning
                    ));
                    break; // Only show one deprecation warning per block
                }
            }
        }

        // Calculate the offset of where paramsString begins within tagContentWithBraces
        const tagContentStartOffsetInFullTag = tagContentWithBraces.indexOf(tagContent); // e.g. 2 for {{tagContent}}
        let paramsStringActualStartOffsetInFullTag = tagContentStartOffsetInFullTag + tagContent.length; // Default to end if no paramsString

        if (paramsString) {
            const offsetOfParamsInTagContent = tagContent.indexOf(paramsString);
            if (offsetOfParamsInTagContent !== -1) {
                 paramsStringActualStartOffsetInFullTag = tagContentStartOffsetInFullTag + offsetOfParamsInTagContent;
            }
        }
        
        // Iterate through parameters for recursive linting
        let currentSearchOffsetInParamsString = 0; // Tracks search position within paramsString

        for (let i = 0; i < paramsArray.length; i++) {
            const paramStrUntrimmed = paramsArray[i]; // Parameter as returned by splitCbsParamsSmart (may have spaces)
            
            const paramActualStartInParamsString = paramsString.indexOf(paramStrUntrimmed, currentSearchOffsetInParamsString);
            if (paramActualStartInParamsString === -1) {
                // This indicates a mismatch between paramsArray and paramsString, should not happen.
                // Consider logging an internal error or skipping this parameter.
                break; 
            }

            const paramToRecurseOn = paramStrUntrimmed.trim(); // Trim for {{...}} check and for content extraction

            if (paramToRecurseOn.startsWith('{{') && paramToRecurseOn.endsWith('}}')) {
                const paramContentForRecurse = paramToRecurseOn.slice(2, -2).trim(); // Content inside {{...}}
                if (paramContentForRecurse) { // Avoid linting empty {{}}
                    // Calculate absolute document offset for this parameter tag
                    const absoluteStartOffsetOfParam = parentDocumentOffsetForTag + paramsStringActualStartOffsetInFullTag + paramActualStartInParamsString;
                    
                    const paramRange = new vscode.Range(
                        document.positionAt(absoluteStartOffsetOfParam),
                        // Use untrimmed length for the range to cover original spacing
                        document.positionAt(absoluteStartOffsetOfParam + paramStrUntrimmed.length) 
                    );
                    diagnostics.push(...this.lintRecursive(paramToRecurseOn, document, paramRange, absoluteStartOffsetOfParam, currentDepth + 1));
                }
            }
            // Advance search offset for the next parameter within paramsString
            currentSearchOffsetInParamsString = paramActualStartInParamsString + paramStrUntrimmed.length;
        }
        return diagnostics;
    }

    private checkCommandUsage(document: vscode.TextDocument): vscode.Diagnostic[] {
        const allDiagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        let braceLevel = 0;
        let currentTagStartIndex = -1;

        for (let i = 0; i < text.length - 1; i++) {
            if (text.substring(i, i + 2) === '{{') {
                if (braceLevel === 0) {
                    currentTagStartIndex = i;
                }
                braceLevel++;
                i++; // Move past the second '{'
            } else if (text.substring(i, i + 2) === '}}') {
                if (braceLevel > 0) { // Only decrement if we are inside a tag
                    braceLevel--;
                    if (braceLevel === 0 && currentTagStartIndex !== -1) {
                        // Found a complete top-level tag
                        const tagContentWithBraces = text.substring(currentTagStartIndex, i + 2);
                        const startPos = document.positionAt(currentTagStartIndex);
                        const endPos = document.positionAt(i + 2);
                        const range = new vscode.Range(startPos, endPos);

                        // Initial call to lintRecursive starts with depth 0
                        allDiagnostics.push(...this.lintRecursive(tagContentWithBraces, document, range, currentTagStartIndex, 0));
                        currentTagStartIndex = -1; // Reset for the next top-level tag
                    }
                }
                // If braceLevel is 0 here, it's an unmatched '}}', checkGeneralSyntax handles this.
                i++; // Move past the second '}'
            }
        }
        // Unclosed tags at the end of the file are handled by checkGeneralSyntax (for '{{')
        // and checkBlockMismatch (for '{{#blockName}').
        return allDiagnostics;
    }

    /**
     * Checks for usage of undefined variables.
     * @param document The document to check.
     * @returns An array of diagnostics for variable usage errors.
     */
    private checkVariableUsage(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const locations = this.parseDocumentForVariables(document); // Use the internal helper
        const definedVars = new Set<string>();

        // First pass: Collect all definitions
        locations.forEach(loc => {
            if (loc.isDefinition) {
                definedVars.add(loc.name);
            }
        });

        // Second pass: Check references
        locations.forEach(loc => {
            if (!loc.isDefinition) {
                // skip toggle variables
                if(loc.name.includes('toggle_')){
                    return;
                }
                // Simple check: Is the variable defined *anywhere* in the file?
                // TODO: Implement scope checking (e.g., temp vars only valid after definition)
                if (!definedVars.has(loc.name)) {
                    // Check if it's a known global/implicit variable if necessary
                    // For now, assume all undefined vars are errors
                    diagnostics.push(new vscode.Diagnostic(
                        loc.location.range,
                        `Variable '${loc.name}' is used but not defined (with setvar/settempvar).`,
                        vscode.DiagnosticSeverity.Warning // Warning because globals might exist
                    ));
                }
            }
        });


        return diagnostics;
    }

    /**
     * Checks for general syntax errors (e.g., malformed tags).
     * @param document The document to check.
     * @returns An array of diagnostics for general syntax errors.
     */
    private checkGeneralSyntax(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const openBraceStack: { pos: number }[] = []; // Stack to store starting positions of {{

        let i = 0;
        while (i < text.length) {
            const openBracePos = text.indexOf('{{', i);
            const closeBracePos = text.indexOf('}}', i);

            if (openBracePos === -1 && closeBracePos === -1) {
                break; // No more braces
            }

            // Determine which brace comes next
            if (openBracePos !== -1 && (closeBracePos === -1 || openBracePos < closeBracePos)) {
                // Found an opening brace {{
                openBraceStack.push({ pos: openBracePos });
                i = openBracePos + 2; // Move past {{
            } else if (closeBracePos !== -1) {
                // Found a closing brace }}
                if (openBraceStack.length === 0) {
                    // Unmatched closing brace
                    const startPos = document.positionAt(closeBracePos);
                    const endPos = document.positionAt(closeBracePos + 2);
                    const range = new vscode.Range(startPos, endPos);
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        "Unexpected closing braces '}}'.",
                        vscode.DiagnosticSeverity.Error
                    ));
                } else {
                    // Matched a closing brace
                    const openTag = openBraceStack.pop();
                    if (openTag) {
                        const openStart = openTag.pos;
                        const closeEnd = closeBracePos + 2;
                        // Check content only for the just closed tag
                        const content = text.substring(openStart + 2, closeBracePos).trim();

                        if (!content) {
                            const startPos = document.positionAt(openStart);
                            const endPos = document.positionAt(closeEnd);
                            const range = new vscode.Range(startPos, endPos);
                            diagnostics.push(new vscode.Diagnostic(
                                range,
                                "Empty CBS tag '{{}}'.",
                                vscode.DiagnosticSeverity.Warning
                            ));
                        } else if (/\s:\s/.test(content) && !content.startsWith('?')) { // Check for ' : ' separator (allow in {{? ...}})
                            const startPos = document.positionAt(openStart);
                            const endPos = document.positionAt(closeEnd);
                            const range = new vscode.Range(startPos, endPos);
                            diagnostics.push(new vscode.Diagnostic(
                                range,
                                "Invalid separator ' : ' found. Use '::' instead.",
                                vscode.DiagnosticSeverity.Error
                            ));
                        }
                        // Nested brace check removed - stack handles matching.
                    }
                }
                i = closeBracePos + 2; // Move past }}
            } else {
                 // Should not happen if openBracePos was -1 initially, but safety break
                 break;
            }
        }

        // Check for any unclosed opening braces left on the stack
        openBraceStack.forEach(openTag => {
            const startPos = document.positionAt(openTag.pos);
            const endPos = document.positionAt(openTag.pos + 2); // Highlight just the {{
            const range = new vscode.Range(startPos, endPos);
            diagnostics.push(new vscode.Diagnostic(
                range,
                "Unclosed opening braces '{{'.",
                vscode.DiagnosticSeverity.Error
            ));
        });

        return diagnostics;
    }


    // =========================================================================
    // --- Helper Functions (Moved/Adapted from extension.ts) ---
    // =========================================================================

    /**
     * Parses the document to find all variable definitions and references.
     * (Adapted from extension.ts)
     * @param document The document to parse.
     * @returns An array of variable locations.
     */
    // Make public so Definition/Reference providers can use it
    public parseDocumentForVariables(document: vscode.TextDocument): VariableLocation[] {
        const locations: VariableLocation[] = [];
        const text = document.getText();
        let match;

        // Reset regex states
        varDefinitionRegex.lastIndex = 0;
        varReferenceGetRegex.lastIndex = 0;
        varReferenceDollarRegex.lastIndex = 0;

        // Find Definitions
        while ((match = varDefinitionRegex.exec(text)) !== null) {
            const varName = match[1];
            const matchStartIndex = match.index;
            const prefixLength = match[0].indexOf(varName, match[0].indexOf('::') + 2);
            if (prefixLength === -1) continue; // Should not happen with this regex, but safeguard
            const startPos = document.positionAt(matchStartIndex + prefixLength);
            const endPos = document.positionAt(matchStartIndex + prefixLength + varName.length);
            const range = new vscode.Range(startPos, endPos);
            locations.push({ name: varName, location: new vscode.Location(document.uri, range), isDefinition: true });
        }

        // Find References (getvar, etc.)
        while ((match = varReferenceGetRegex.exec(text)) !== null) {
            const varName = match[1];
            const matchStartIndex = match.index;
            const prefixLength = match[0].indexOf(varName, match[0].indexOf('::') + 2);
             if (prefixLength === -1) continue;
            const startPos = document.positionAt(matchStartIndex + prefixLength);
            const endPos = document.positionAt(matchStartIndex + prefixLength + varName.length);
            const range = new vscode.Range(startPos, endPos);
            locations.push({ name: varName, location: new vscode.Location(document.uri, range), isDefinition: false });
        }

         // Find References ($var inside calc/?)
         while ((match = varReferenceDollarRegex.exec(text)) !== null) {
             const fullMatchText = match[0];
             const fullMatchStartIndex = match.index;
             const varName = match[1];

             let varIndexInMatch = -1;
             let currentSearchIndex = 0;
             while((varIndexInMatch = fullMatchText.indexOf('$' + varName, currentSearchIndex)) !== -1) {
                 const startPos = document.positionAt(fullMatchStartIndex + varIndexInMatch + 1); // +1 to skip '$'
                 const endPos = document.positionAt(fullMatchStartIndex + varIndexInMatch + 1 + varName.length);
                 const range = new vscode.Range(startPos, endPos);
                 if (!locations.some(loc => loc.location.range.isEqual(range) && loc.name === varName && !loc.isDefinition)) {
                     locations.push({ name: varName, location: new vscode.Location(document.uri, range), isDefinition: false });
                 }
                 currentSearchIndex = varIndexInMatch + 1;
                 // Let's find all occurrences within the block for linting purposes
                 // break; // Removed break to find all $var instances
             }
         }

        return locations;
    }

}
