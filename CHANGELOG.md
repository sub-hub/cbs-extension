# Changelog

All notable changes to the RisuAI CBS Editor are listed here.

## [Unreleased]

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
