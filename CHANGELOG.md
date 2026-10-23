# Changelog

All notable changes to the RisuAI CBS Editor are listed here.

## [Unreleased]

## [1.6.0] - 2026-10-23

Brings the extension up to date with RisuAI as of 2026-10-22 (commit `f50b5942`).

### Added
- New CBS: `authornote` (`author_note`), `bkspc`, `erase` and `declare`, and the `rollpick` alias of `rollp`.
- Ctrl+Click (Go to Definition) on a block's opening tag jumps to its closing tag, and back.
- A warning on `{{#if-pure}}`: RisuAI runs it as a plain `{{#if}}`, so whitespace is not kept. Use `{{#if_pure}}`.

### Changed
- Command names are matched the way RisuAI matches them, ignoring case, spaces, `_` and `-`. Valid tags such as `{{get_var::a}}` or `{{previous-char-chat}}` are no longer reported as unknown commands.
- The if_pure snippet now inserts `{{#if_pure}}` instead of `{{#if-pure}}`.
- The each snippet now inserts `{{#each array as item}}`.
- The when operator snippet also offers `toggle`, `vis`, `visnot`, `tis` and `tisnot`.
- Debug messages go to the "CBS Editor" channel in the Output panel instead of the extension host log. They are hidden unless the channel's log level is set to Debug.
- The package no longer includes development files.

## [1.5.1] - 2026-10-23

### Fixed
- Installing the extension no longer changes inlay hint colors in other languages. 1.5.0 overrode VS Code's built-in `editorInlayHint.*` colors, which apply to every language.

### Changed
- CBS hints are now drawn by the extension itself so they keep their colors without touching other languages. The colors can be changed with `cbs.inlayHint.parameterForeground`, `cbs.inlayHint.parameterBackground`, `cbs.inlayHint.typeForeground` and `cbs.inlayHint.typeBackground` in `workbench.colorCustomizations`.
- Long CBS hints are no longer cut off with `…`.
- Hint tooltips now show when hovering the text the hint belongs to (for example the `{{/if}}` tag or the parameter), not the hint itself.
- CBS hints follow `editor.inlayHints.enabled`. The "while pressed" modes (`onUnlessPressed`, `offUnlessPressed`) behave as always on or always off.

## [1.5.0] - 2026-01-14

### Added
- Four inlay hints, each can be turned off in settings: parameter names, block end, math symbols and data preview.

### Changed
- `when` snippets are suggested first by their plain prefix (`when`, `when-else`, `when-operator`).
- New inlay hint colors and decoration.

### Fixed
- `{{#if_pure}}` blocks can be closed with `{{/if}}`.

## [1.4.0] - 2025-12-17

### Added
- CBS definitions updated to RisuAI commit `bb55557`, including `time`, `date`, `pick`, `roll` and `rollp`.

### Changed
- A closing tag whose name does not match its opening block is reported as an error.

### Fixed
- Errors when `#when` used `::` as the separator instead of spaces.

## [1.3.1] - 2025-06-03

### Fixed
- The formatter no longer splits inline tags such as `{{user}}`, `{{char}}` and `{{bot}}`.

## [1.3.0] - 2025-05-24

### Added
- CBS definitions up to RisuAI v160.1.0.

### Changed
- Commands starting with a letter or digit are listed first in completion.

## [1.2.2] - 2025-05-10

### Added
- Linting of parameters inside block syntaxes.

### Fixed
- Linting of nested tags and nested parameters.

## [1.2.1] - 2025-05-08

### Added
- ChatML completion triggered by `<`.

## [1.2.0] - 2025-05-03

### Added
- `cbs.completion.useOriginalNameForAlias` setting.

### Fixed
- Separator inserted when completing an alias.

## [1.1.2] - 2025-04-21

### Added
- `.txt` files are associated with CBS (can be overridden, see README).

## [1.1.1] - 2025-04-20

### Fixed
- Toggle variables (`toggle_*`) are no longer reported by the linter.

## [1.1.0] - 2025-04-20

### Added
- Formatted preview with real-time update and "Go To Original Location" (`Alt+Q`).

### Fixed
- Lint and completion for `{{? }}`.

Earlier changes are in the git history.
