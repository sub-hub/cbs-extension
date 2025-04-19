import * as vscode from 'vscode';
import { cbsCommandsData, findCommandInfo, extractCommandIdentifierFromPrefix, countParametersInCurrentTag } from './cbsData'; // Removed unused CbsCommandInfo, CbsParameterInfo
import { CbsLinter } from './cbsLinter';
import { formatLine, calculateInitialFormattingState, FormattingState } from './cbsFormatter'; // Import formatter logic

interface VariableLocation {
    name: string;
    location: vscode.Location;
    isDefinition: boolean;
}

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

export function activate(context: vscode.ExtensionContext) {

  cbsLinter = new CbsLinter();
  cbsLinter.activate(context);

  const hoverProvider = vscode.languages.registerHoverProvider('cbs', {
    provideHover(document, position, token) {
      if (!isInsideCbsTag(document, position)) {
          return undefined;
      }

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
       if (!isInsideCbsTag(document, position)) {
        return undefined;
       }

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
            let isValidTrigger = false;

            // Check for TriggerCharacter
            if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && ['[', '{'].includes(context.triggerCharacter ?? '')) {
                isValidTrigger = true;
            }
            // Check for Invoke after '[' or '{'
            else if (context.triggerKind === vscode.CompletionTriggerKind.Invoke && position.character > 0) {
                const charBefore = document.getText(new vscode.Range(position.translate(0, -1), position));
                if (['[', '{'].includes(charBefore)) {
                    isValidTrigger = true;
                }
            }

            if (!isValidTrigger) {
                return undefined;
            }

            // If the trigger is valid, we always want to delete the preceding character
            const deleteRange = new vscode.Range(position.translate(0, -1), position);
            const deleteTriggerEdit = vscode.TextEdit.delete(deleteRange);

            const insertRange = new vscode.Range(position, position); // Insert at the original cursor position

            const commandCompletionItems: vscode.CompletionItem[] = [];

            cbsCommandsData.forEach(cmdInfo => {
                const item = new vscode.CompletionItem(cmdInfo.name, vscode.CompletionItemKind.Keyword);
                item.documentation = new vscode.MarkdownString(typeof cmdInfo.description === 'string' ? cmdInfo.description : cmdInfo.description.value);

                item.range = insertRange; // Use the original position for insertion range
                item.additionalTextEdits = [deleteTriggerEdit]; // Always include the deletion edit

                if (cmdInfo.parameters && cmdInfo.parameters.length > 0) {
                    // Check if it's a prefix command to use the correct separator
                    const separator = cmdInfo.isPrefixCommand ? ':' : '::';
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

                        if (cmdInfo.parameters && cmdInfo.parameters.length > 0) {
                            // Check if it's a prefix command for the original command to use the correct separator
                            const separator = cmdInfo.isPrefixCommand ? ':' : '::';
                            // Use the primary command name in the snippet, but the correct separator
                            aliasItem.insertText = new vscode.SnippetString(`{{${cmdInfo.name}${separator}$\{1\}}}`);
                        } else {
                            // Use the primary command name for consistency when no params
                            aliasItem.insertText = `{{${cmdInfo.name}}}`;
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
    },
    '[', '{'
  );

  // --- Document Formatting Provider (Full Document) ---
  const documentFormattingProvider = vscode.languages.registerDocumentFormattingEditProvider('cbs', {
    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
      const edits: vscode.TextEdit[] = [];
      let currentState: FormattingState = { indentLevel: 0, inPureBlock: 0 };

      for (let i = 0; i < document.lineCount; i++) {
        if (token.isCancellationRequested) {
          return edits; // Return partial edits if cancelled
        }

        const line = document.lineAt(i);
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
          const edits: vscode.TextEdit[] = [];
          // Calculate the initial state just before the range starts
          let currentState = calculateInitialFormattingState(document, range.start.line, options);

          // Iterate through lines within the selected range
          for (let i = range.start.line; i <= range.end.line; i++) {
              if (token.isCancellationRequested) {
                  return edits; // Return partial edits if cancelled
              }

              const line = document.lineAt(i);
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
    hoverProvider,
    signatureHelpProvider,
    commandCompletionProvider,
    documentFormattingProvider, // Register new full document formatter
    rangeFormattingProvider,    // Register range formatter
    vscode.languages.registerDefinitionProvider('cbs', new CbsDefinitionProvider(cbsLinter)),
    vscode.languages.registerReferenceProvider('cbs', new CbsReferenceProvider(cbsLinter))
  );
}

export function deactivate() {
    if (cbsLinter) {
        cbsLinter.dispose();
    }
}
