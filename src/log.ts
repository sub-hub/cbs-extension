import * as vscode from 'vscode';

/**
 * "CBS Editor" channel in the Output panel.
 * Debug messages are hidden unless the user sets the channel's log level to Debug or Trace.
 */
export const log = vscode.window.createOutputChannel('CBS Editor', { log: true });
