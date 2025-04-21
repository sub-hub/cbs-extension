# CBS Editor for VS Code

Provides comprehensive language support for Curly Braced Syntax (`.cbs`) files in Visual Studio Code.

[![Version](https://img.shields.io/visual-studio-marketplace/v/mollu.cbs-editor)](https://marketplace.visualstudio.com/items?itemName=mollu.cbs-editor)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/mollu.cbs-editor)](https://marketplace.visualstudio.com/items?itemName=mollu.cbs-editor)

## Preview
**CBS Formatter:**

<img src="https://i.imgur.com/jxENFCc.gif" alt="Formatter Demo" width="600"/>

**Autocomplete Feature:**

<img src="https://i.imgur.com/LYefYf8.gif" alt="Autocomplete Demo" width="600"/>

**Real-time Error Checking:**

<img src="https://i.imgur.com/zBJBYEg.png" alt="Linting" width="600"/>

## Features

*   **Syntax Highlighting:** Clear and distinct highlighting for CBS commands, variables, strings, and structure based on the TextMate grammar in `syntaxes/cbs.tmLanguage.json`.
*   **IntelliSense:**
    *   **Command Completions:** Get suggestions for CBS commands and their aliases when you type `{{` or `[`.
    *   **Signature Help:** See parameter information for commands when typing `::` within a `{{...}}` tag.
    *   **Hover Information:** Hover over commands within `{{...}}` tags to see their description and signature.
*   **Code Navigation:**
    *   **Go to Definition (F12):** Quickly jump to the definition of CBS variables identified by the linter.
    *   **Find All References (Shift+F12):** Find where variables are used throughout your document.
*   **Code Formatting:** Automatically format your `.cbs` documents (Right-click -> Format Document or `Shift+Alt+F`). Supports smart indentation, spacing, and line breaks for CBS blocks and tags, while respecting `{{#pure_display}}` blocks.
*   **Linting & Diagnostics:** Real-time error checking and diagnostics provided by `CbsLinter` to help you write valid CBS code.
*   **Language Configuration (`language-configuration.json`):**
    *   **Bracket Matching & Auto-Closing:** Automatic handling for `{{` and `}}`.
    *   **Commenting:** Use `{{hidden_key: your comment }}` for block comments.
    *   **Code Folding:** Fold blocks defined by `{{#...}}` and `{{/...}}`.
*   **Snippets:** Provides snippets for common CBS block structures (`if`, `if-pure`, `each`, `func`, `pure_display`) accessible via prefixes like `if`, `cbsif`, `{{#if`, etc.

## Usage

1.  Install the extension from the VS Code Marketplace.
2.  Open any file with the `.cbs` extension.
3.  Utilize the features described above for an enhanced development workflow.

## Note on `.txt` File Association

By default, this extension associates both `.cbs` and `.txt` files with the CBS language features. If you prefer *not* to have CBS features applied to your plain `.txt` files, you can easily override this in your VS Code settings.

Open your `settings.json` file (File > Preferences > Settings, then click the "Open Settings (JSON)" icon in the top right) and add the following configuration:

```json
"files.associations": {
    "*.txt": "plaintext"
}
```

This tells VS Code to treat `.txt` files as plain text, overriding the extension's default setting.

## Contributing

Bug reports and feature requests are welcome! Please open an issue on the [GitHub repository](https://github.com/sub-hub/cbs-extension)

## License

[GNU General Public License version 3.0](LICENSE)
