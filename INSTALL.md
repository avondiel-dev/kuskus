# Installing Kuskus (Custom Fork) in VS Code

This guide explains how to install your custom fork of Kuskus with support for custom tables, properties, and functions.

## Quick Install (Pre-built VSIX)

### 1. Install the Language Server Extension

The language server includes autocomplete, hover info, formatting, and custom symbol support.

```bash
code --install-extension ~/Dropbox/Projects/kuskus/kusto-language-server/kuskus-kusto-language-server-1.0.31.vsix
```

Or in VS Code:
1. Open Command Palette (`Cmd+Shift+P`)
2. Type "Install from VSIX"
3. Select `~/Dropbox/Projects/kuskus/kusto-language-server/kuskus-kusto-language-server-1.0.31.vsix`

### 2. Install Syntax Highlighting (Build Required)

```bash
cd ~/Dropbox/Projects/kuskus/kusto-syntax-highlighting
npm install
npx vsce package
code --install-extension kuskus-kusto-syntax-highlighting-*.vsix
```

### 3. (Optional) Install Color Theme

```bash
cd ~/Dropbox/Projects/kuskus/kusto-color-themes
npx vsce package
code --install-extension kuskus-kusto-color-themes-*.vsix
```

## Configuration

### Custom Tables (Azure Resource Graph, etc.)

Add to your `.vscode/settings.json`:

```json
{
  "kuskus.customTables": [
    {
      "name": "resources",
      "description": "Azure Resource Graph - All Azure resources",
      "columns": [
        { "name": "id", "type": "string", "description": "Resource ID" },
        { "name": "name", "type": "string", "description": "Resource name" },
        { "name": "type", "type": "string", "description": "Resource type" },
        { "name": "resourceGroup", "type": "string", "description": "Resource group" },
        { "name": "subscriptionId", "type": "string", "description": "Subscription ID" },
        { "name": "properties", "type": "dynamic", "description": "Resource properties" },
        { "name": "tags", "type": "dynamic", "description": "Resource tags" }
      ]
    }
  ]
}
```

### Custom Properties (Dynamic Column Completions)

```json
{
  "kuskus.customProperties": {
    "resources.properties": ["provisioningState", "enabled", "state"],
    "resources.tags": ["ApplicationName", "BusinessOwner", "CostCenter"]
  }
}
```

### Custom Functions

```json
{
  "kuskus.customFunctions": [
    { "name": "tolower", "description": "Converts to lowercase", "returnType": "string" },
    { "name": "tostring", "description": "Converts to string", "returnType": "string" }
  ]
}
```

### Enable Diagnostics (Optional)

Diagnostics (red squiggly underlines) are disabled by default:

```json
{
  "kuskusLanguageServer.diagnosticsEnabled": true
}
```

## Building from Source

### Prerequisites

- Node.js (v16+)
- npm
- VS Code Extension CLI: `npm install -g @vscode/vsce`

### Build All Extensions

```bash
cd ~/Dropbox/Projects/kuskus

# Build Language Server
cd kusto-language-server
npm install
npm run compile
npx vsce package
cd ..

# Build Syntax Highlighting
cd kusto-syntax-highlighting
npm install
npm run convert
npx vsce package
cd ..

# Build Color Themes
cd kusto-color-themes
npx vsce package
cd ..
```

### Install All Built Extensions

```bash
code --install-extension kusto-language-server/kuskus-kusto-language-server-*.vsix
code --install-extension kusto-syntax-highlighting/kuskus-kusto-syntax-highlighting-*.vsix
code --install-extension kusto-color-themes/kuskus-kusto-color-themes-*.vsix
```

## Uninstall Marketplace Version

If you have the original Kuskus from marketplace, uninstall it first:

```bash
code --uninstall-extension rosshamish.kuskus-extensions-pack
code --uninstall-extension rosshamish.kuskus-kusto-language-server
code --uninstall-extension rosshamish.kuskus-kusto-syntax-highlighting
code --uninstall-extension rosshamish.kuskus-kusto-color-themes
```

## Verify Installation

1. Open a `.kql` file
2. Check that syntax highlighting works
3. Try autocomplete (`Ctrl+Space`)
4. Run Command Palette → "[Kuskus] Load Symbols from Cluster" (if connected to ADX)

## Troubleshooting

- **Extension not activating**: Ensure file has `.kql`, `.csl`, or `.kusto` extension
- **Custom tables not showing**: Reload VS Code window after changing settings
- **Conflicts with marketplace version**: Uninstall marketplace extensions first
