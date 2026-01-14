import * as vscode from 'vscode';
import { findCommandInfo, findAllCommandInfo, CbsCommandInfo } from './cbsData';

/**
 * Provides Inlay Hints for CBS language files.
 * Shows parameter names, block closing hints, math symbols, and data previews.
 */
export class CbsInlayHintsProvider implements vscode.InlayHintsProvider {
    // Pre-compiled regex for performance
    private static readonly BLOCK_NAME_REGEX = /^#([\w-]+)/;
    
    /**
     * Provides inlay hints for a document.
     */
    public provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.InlayHint[]> {
        const hints: vscode.InlayHint[] = [];
        const config = vscode.workspace.getConfiguration('cbs.inlayHints');
        
        // Get settings
        const showParameterNames = config.get<boolean>('parameterNames.enabled', true);
        const showBlockEnd = config.get<boolean>('blockEnd.enabled', true);
        const showMathSymbols = config.get<boolean>('mathSymbols.enabled', true);
        const showDataPreview = config.get<boolean>('dataPreview.enabled', true);
        
        // Early return if all hints disabled
        if (!showParameterNames && !showBlockEnd && !showMathSymbols && !showDataPreview) {
            return hints;
        }
        
        const text = document.getText(range);
        const rangeOffset = document.offsetAt(range.start);
        
        // Track block stack for closing hints
        const blockStack: Array<{ name: string; condition: string; position: vscode.Position }> = [];
        
        // Parse CBS tags
        let index = 0;
        while (index < text.length) {
            // Look for opening {{
            if (text.substring(index, index + 2) === '{{') {
                const tagStart = index;
                
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
                
                if (braceCount === 0) {
                    // Extract tag content (optimized - single substring call)
                    const tagContent = text.substring(tagStart + 2, endIndex - 2).trim();
                    
                    // Calculate absolute positions
                    const absoluteTagStart = rangeOffset + tagStart;
                    const absoluteTagEnd = rangeOffset + endIndex;
                    
                    // Process the tag based on first character
                    const firstChar = tagContent.charCodeAt(0);
                    
                    if (firstChar === 35) { // '#' - Block start tag
                        if (showBlockEnd) {
                            this.processBlockStart(tagContent, document, absoluteTagStart, blockStack);
                        }
                    } else if (firstChar === 47) { // '/' - Block end tag
                        if (showBlockEnd) {
                            const blockHints = this.processBlockEnd(tagContent, document, absoluteTagEnd, blockStack);
                            hints.push(...blockHints);
                        }
                    } else if (!tagContent.startsWith('?') && tagContent !== ':else') {
                        // Regular command tag (skip calc/? and :else)
                        const commandHints = this.processCommand(
                            tagContent,
                            document,
                            absoluteTagStart,
                            showParameterNames,
                            showMathSymbols,
                            showDataPreview
                        );
                        hints.push(...commandHints);
                    }
                }
                
                index = endIndex;
            } else {
                index++;
            }
        }
        
        return hints;
    }
    
    /**
     * Process a block start tag and add it to the block stack.
     */
    private processBlockStart(
        tagContent: string,
        document: vscode.TextDocument,
        absoluteTagStart: number,
        blockStack: Array<{ name: string; condition: string; position: vscode.Position }>
    ): void {
        // Extract block name using pre-compiled regex
        const blockMatch = CbsInlayHintsProvider.BLOCK_NAME_REGEX.exec(tagContent);
        if (!blockMatch) return;
        
        const blockName = blockMatch[1];
        const blockNameEnd = blockMatch[0].length; // Length of "#blockname"
        
        // Extract condition efficiently
        let condition = '';
        if (blockNameEnd < tagContent.length) {
            const remainder = tagContent.substring(blockNameEnd);
            // Check for :: separator
            if (remainder.charCodeAt(0) === 58 && remainder.charCodeAt(1) === 58) { // '::'
                condition = remainder.substring(2).trim();
            } else {
                // Take everything after block name (handles space-separated style)
                condition = remainder.trim();
            }
        }
        
        blockStack.push({
            name: blockName,
            condition,
            position: document.positionAt(absoluteTagStart)
        });
    }
    
    /**
     * Process a block end tag and generate closing hints.
     */
    private processBlockEnd(
        tagContent: string,
        document: vscode.TextDocument,
        absoluteTagEnd: number,
        blockStack: Array<{ name: string; condition: string; position: vscode.Position }>
    ): vscode.InlayHint[] {
        // Pop the last block from stack
        const openBlock = blockStack.pop();
        if (!openBlock) return [];
        
        // Create hint showing which block is being closed
        const hint = new vscode.InlayHint(
            document.positionAt(absoluteTagEnd),
            openBlock.condition ? ` ${openBlock.condition}` : '',
            vscode.InlayHintKind.Type
        );
        hint.paddingLeft = true;
        
        // Build tooltip efficiently
        hint.tooltip = openBlock.condition
            ? `Closes {{#${openBlock.name}}} block from line ${openBlock.position.line + 1}\n\nCondition: ${openBlock.condition}`
            : `Closes {{#${openBlock.name}}} block from line ${openBlock.position.line + 1}`;
        
        return [hint];
    }
    
    /**
     * Process a regular command and generate parameter/math/preview hints.
     */
    private processCommand(
        tagContent: string,
        document: vscode.TextDocument,
        absoluteTagStart: number,
        showParameterNames: boolean,
        showMathSymbols: boolean,
        showDataPreview: boolean
    ): vscode.InlayHint[] {
        const hints: vscode.InlayHint[] = [];
        
        // Parse command name and parameters
        let commandName: string;
        let params: string[] = [];
        let isPrefixCommand = false;
        
        // Check for :: separator first
        const doubleSepIdx = this.findTopLevelSeparator(tagContent, '::');
        
        if (doubleSepIdx !== -1) {
            // Standard :: separator
            commandName = tagContent.substring(0, doubleSepIdx).trim();
            const paramsString = tagContent.substring(doubleSepIdx + 2);
            params = this.splitCbsParamsSmart(paramsString);
        } else {
            // Check for single : (prefix command)
            const singleSepIdx = this.findTopLevelSeparator(tagContent, ':');
            
            if (singleSepIdx !== -1) {
                isPrefixCommand = true;
                commandName = tagContent.substring(0, singleSepIdx).trim();
                const paramString = tagContent.substring(singleSepIdx + 1);
                params = [paramString]; // Treat as single parameter
            } else {
                // No separator - command only
                commandName = tagContent.trim();
            }
        }
        
        // Find command info
        const commandInfos = findAllCommandInfo(commandName);
        if (commandInfos.length === 0) return hints;
        
        // Use the first matching command info for hints
        const commandInfo = commandInfos[0];
        
        // Generate parameter name hints
        if (showParameterNames && !isPrefixCommand && params.length > 0 && commandInfo.parameters) {
            const paramHints = this.generateParameterHints(
                commandName,
                commandInfo,
                params,
                tagContent,
                document,
                absoluteTagStart
            );
            hints.push(...paramHints);
        }
        
        // Calculate position after the closing }} of the current tag
        // absoluteTagStart points to {{, so tag length is tagContent.length + 4 (for {{ and }})
        const absoluteTagEnd = absoluteTagStart + tagContent.length + 4;
        
        // Generate math symbol hints
        if (showMathSymbols) {
            const mathHint = this.generateMathSymbolHint(
                commandName,
                params,
                document,
                absoluteTagEnd
            );
            if (mathHint) hints.push(mathHint);
        }
        
        // Generate data preview hints
        if (showDataPreview) {
            const previewHint = this.generateDataPreviewHint(
                commandName,
                params,
                document,
                absoluteTagEnd
            );
            if (previewHint) hints.push(previewHint);
        }
        
        return hints;
    }
    
    /**
     * Generate parameter name hints for a command.
     */
    private generateParameterHints(
        commandName: string,
        commandInfo: CbsCommandInfo,
        params: string[],
        tagContent: string,
        document: vscode.TextDocument,
        absoluteTagStart: number
    ): vscode.InlayHint[] {
        const hints: vscode.InlayHint[] = [];
        
        if (!commandInfo.parameters) return hints;
        
        // Find position of each :: separator and add hints before parameters
        let searchOffset = commandName.length; // Start after command name
        let paramIndex = 0;
        
        // Find the first :: after command name
        while (paramIndex < params.length && paramIndex < commandInfo.parameters.length) {
            const separatorPos = tagContent.indexOf('::', searchOffset);
            if (separatorPos === -1) break;
            
            // Position hint right after the ::
            const hintOffset = absoluteTagStart + 2 + separatorPos + 2; // +2 for {{, +2 for ::
            const hintPosition = document.positionAt(hintOffset);
            
            const paramInfo = commandInfo.parameters[paramIndex];
            let labelText = paramInfo.label;
            
            // Extract just the name without type annotations
            // E.g., "A (array)" -> "array", "B (index)" -> "index"
            const match = labelText.match(/\(([^)]+)\)/);
            if (match) {
                labelText = match[1];
            } else {
                // Remove prefix like "A ", "B ", etc.
                labelText = labelText.replace(/^[A-Z]\s+/, '');
            }
            
            const hint = new vscode.InlayHint(
                hintPosition,
                `(${labelText}) `,
                vscode.InlayHintKind.Parameter
            );
            hint.paddingRight = true;
            
            if (paramInfo.documentation) {
                hint.tooltip = typeof paramInfo.documentation === 'string' 
                    ? paramInfo.documentation 
                    : paramInfo.documentation;
            }
            
            hints.push(hint);
            
            // Move search offset past this parameter for next iteration
            searchOffset = separatorPos + 2 + params[paramIndex].length;
            paramIndex++;
        }
        
        return hints;
    }
    
    /**
     * Generate math symbol hint for comparison/logic operators.
     */
    private generateMathSymbolHint(
        commandName: string,
        params: string[],
        document: vscode.TextDocument,
        absolutePosition: number
    ): vscode.InlayHint | null {
        const mathSymbols: { [key: string]: string } = {
            'equal': '==',
            'not_equal': '!=',
            'notequal': '!=',
            'greater': '>',
            'greater_equal': '>=',
            'greaterequal': '>=',
            'less': '<',
            'less_equal': '<=',
            'lessequal': '<=',
            'and': '&&',
            'or': '||',
            'not': '!',
        };
        
        const symbol = mathSymbols[commandName];
        if (!symbol) return null;
        
        // Create hint showing the operator symbol
        let hintText = ` (${symbol})`;
        
        const hint = new vscode.InlayHint(
            document.positionAt(absolutePosition),
            hintText,
            vscode.InlayHintKind.Type
        );
        hint.paddingLeft = true;
        
        return hint;
    }
    
    /**
     * Generate data preview hint for unicode/hex conversions.
     */
    private generateDataPreviewHint(
        commandName: string,
        params: string[],
        document: vscode.TextDocument,
        absolutePosition: number
    ): vscode.InlayHint | null {
        // Unicode decode: {{u::1F600}} -> 😀
        if ((commandName === 'u' || commandName === 'ue' || commandName === 'unicodedecodefromhex') && params.length > 0) {
            try {
                const hexValue = params[0].trim();
                const codePoint = parseInt(hexValue, 16);
                if (!isNaN(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF) {
                    const char = String.fromCodePoint(codePoint);
                    const hint = new vscode.InlayHint(
                        document.positionAt(absolutePosition - 2),
                        ` ${char}`,
                        vscode.InlayHintKind.Type
                    );
                    hint.paddingLeft = true;
                    hint.tooltip = `Unicode character U+${hexValue.toUpperCase()}`;
                    return hint;
                }
            } catch (e) {
                // Ignore invalid hex values
            }
        }
        
        // Hex to decimal: {{fromhex::FF}} -> (255)
        if (commandName === 'fromhex' && params.length > 0) {
            try {
                const hexValue = params[0].trim();
                const decimal = parseInt(hexValue, 16);
                if (!isNaN(decimal)) {
                    const hint = new vscode.InlayHint(
                        document.positionAt(absolutePosition - 2),
                        ` (${decimal})`,
                        vscode.InlayHintKind.Type
                    );
                    hint.paddingLeft = true;
                    hint.tooltip = `Hexadecimal ${hexValue} = ${decimal} in decimal`;
                    return hint;
                }
            } catch (e) {
                // Ignore invalid hex values
            }
        }
        
        // Decimal to hex: {{tohex::255}} -> (FF)
        if (commandName === 'tohex' && params.length > 0) {
            try {
                const decimalStr = params[0].trim();
                const decimal = parseInt(decimalStr, 10);
                if (!isNaN(decimal)) {
                    const hexValue = decimal.toString(16).toUpperCase();
                    const hint = new vscode.InlayHint(
                        document.positionAt(absolutePosition - 2),
                        ` (${hexValue})`,
                        vscode.InlayHintKind.Type
                    );
                    hint.paddingLeft = true;
                    hint.tooltip = `Decimal ${decimal} = 0x${hexValue} in hexadecimal`;
                    return hint;
                }
            } catch (e) {
                // Ignore invalid numbers
            }
        }
        
        return null;
    }
    
    /**
     * Find the index of a top-level separator (not inside nested {{...}}).
     */
    private findTopLevelSeparator(text: string, separator: string): number {
        let braceLevel = 0;
        for (let i = 0; i <= text.length - separator.length; i++) {
            if (text.substring(i, i + 2) === '{{') {
                braceLevel++;
                i++; // Skip next char
            } else if (text.substring(i, i + 2) === '}}') {
                braceLevel--;
                i++; // Skip next char
            } else if (braceLevel === 0 && text.substring(i, i + separator.length) === separator) {
                return i;
            }
        }
        return -1;
    }
    
    /**
     * Split parameters by :: while respecting nested {{...}}.
     */
    private splitCbsParamsSmart(paramString: string): string[] {
        const params: string[] = [];
        if (!paramString.trim()) return params;
        
        let currentParamStart = 0;
        let braceLevel = 0;
        
        for (let i = 0; i < paramString.length; i++) {
            if (paramString.substring(i, i + 2) === '{{') {
                braceLevel++;
                i++; // Skip next char
            } else if (paramString.substring(i, i + 2) === '}}') {
                braceLevel--;
                i++; // Skip next char
            } else if (paramString.substring(i, i + 2) === '::' && braceLevel === 0) {
                params.push(paramString.substring(currentParamStart, i));
                currentParamStart = i + 2; // Move past ::
                i++; // Skip next char
            }
        }
        
        // Add the last parameter
        params.push(paramString.substring(currentParamStart));
        return params;
    }
}
