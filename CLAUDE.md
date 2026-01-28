# CLAUDE.md - Project Context for Claude Code

## Project Overview

Kuskus is a VS Code extension providing KQL (Kusto Query Language) support:
- Syntax highlighting
- Language server features
- Color themes

This is a fork of [rosshamish/kuskus](https://github.com/rosshamish/kuskus) with planned improvements.

## Repository Structure

```
kuskus/
├── kusto-syntax-highlighting/  # TextMate grammar for KQL
├── kusto-language-server/      # Language server implementation
├── kusto-color-themes/         # VS Code color themes for KQL
├── kusto-extensions-pack/      # Extension pack bundling all components
├── .github/                    # GitHub workflows
├── README.md                   # Main documentation
└── CUSTOM_SYMBOLS_README.md    # Custom symbols documentation
```

## Components

| Component | Purpose |
|-----------|---------|
| `kusto-syntax-highlighting` | TextMate grammar for .kql and .csl files |
| `kusto-language-server` | LSP implementation for KQL |
| `kusto-color-themes` | Kuskus Kusto Dark theme |
| `kusto-extensions-pack` | Bundles all extensions together |

## Development

Each component is a separate VS Code extension that can be built individually:

```bash
cd kusto-syntax-highlighting
npm install
vsce package
```

## Planned Improvements

- Better support for Azure Resource Graph tables
- Custom table/function definitions via settings
- Improved autocomplete for dynamic properties
- Support for Azure Log Analytics specific tables

## Related Projects

- **dvag-kusto** - KQL query collection using this extension
- **gokql** - CLI tool for executing KQL queries

## Git Remotes

- `origin`: https://github.com/avondiel-dev/kuskus.git (fork)
- `upstream`: https://github.com/rosshamish/kuskus.git (original)
