# Custom Symbols Feature for Kuskus

This fork extends the Kuskus Kusto Language Server to support custom table, property, and function definitions from VS Code settings. This enables IntelliSense for Azure Resource Graph and other Kusto-like environments without requiring a cluster connection.

## What's New

- **Custom Tables**: Define table schemas directly in VS Code settings
- **Custom Properties**: Add IntelliSense for dynamic column properties
- **Custom Functions**: Define custom function signatures
- **Auto-loading**: Symbols load automatically on extension start and when settings change
- **Merge Support**: Custom symbols work alongside cluster-loaded symbols

## Installation

### Option 1: Install from VSIX (Recommended for Testing)

1. Build the extension:
```bash
cd /path/to/kuskus/kusto-language-server
npm install
npm run compile
```

2. Package the extension:
```bash
npx vsce package
```

3. Install in VS Code:
   - Open VS Code
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Extensions: Install from VSIX"
   - Select the generated `.vsix` file

### Option 2: Run in Development Mode

1. Clone the repository:
```bash
git clone https://github.com/dvag-axel-von-dielingen/kuskus.git
cd kuskus/kusto-language-server
git checkout feature/custom-symbols
```

2. Install dependencies and compile:
```bash
npm install
npm run compile
```

3. Open in VS Code:
```bash
code .
```

4. Press `F5` to launch the Extension Development Host

## Configuration

Add custom symbols to your `.vscode/settings.json`:

### Custom Tables

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
        { "name": "location", "type": "string", "description": "Azure region" },
        { "name": "resourceGroup", "type": "string" },
        { "name": "subscriptionId", "type": "string" },
        { "name": "properties", "type": "dynamic" },
        { "name": "tags", "type": "dynamic" }
      ]
    },
    {
      "name": "resourcecontainers",
      "description": "Azure Resource Graph - Subscriptions and resource groups",
      "columns": [
        { "name": "id", "type": "string" },
        { "name": "name", "type": "string" },
        { "name": "type", "type": "string" },
        { "name": "subscriptionId", "type": "string" },
        { "name": "tenantId", "type": "string" },
        { "name": "properties", "type": "dynamic" },
        { "name": "tags", "type": "dynamic" }
      ]
    },
    {
      "name": "ServiceHealthResources",
      "description": "Azure Resource Graph - Service Health events",
      "columns": [
        { "name": "id", "type": "string" },
        { "name": "name", "type": "string" },
        { "name": "type", "type": "string" },
        { "name": "subscriptionId", "type": "string" },
        { "name": "location", "type": "string" },
        { "name": "properties", "type": "dynamic" }
      ]
    }
  ]
}
```

### Custom Properties

Provide IntelliSense for properties within dynamic columns:

```json
{
  "kuskus.customProperties": {
    "resources.properties": [
      "provisioningState",
      "allowBlobPublicAccess",
      "InstrumentationKey",
      "enabled",
      "state"
    ],
    "resources.tags": [
      "ApplicationName",
      "BusinessOwner",
      "TechnicalOwner",
      "CostCenter",
      "Environment"
    ],
    "ServiceHealthResources.properties": [
      "ImpactStartTime",
      "ImpactMitigationTime",
      "Status",
      "Summary",
      "title",
      "service",
      "region"
    ]
  }
}
```

### Custom Functions

```json
{
  "kuskus.customFunctions": [
    { "name": "tolower", "returnType": "string", "description": "Converts to lowercase" },
    { "name": "tostring", "returnType": "string", "description": "Converts to string" },
    { "name": "toint", "returnType": "int", "description": "Converts to integer" },
    { "name": "todatetime", "returnType": "datetime", "description": "Converts to datetime" },
    { "name": "split", "returnType": "dynamic", "description": "Splits string" },
    { "name": "parse_json", "returnType": "dynamic", "description": "Parses JSON" },
    { "name": "isempty", "returnType": "bool", "description": "Checks if empty" },
    { "name": "isnotempty", "returnType": "bool", "description": "Checks if not empty" },
    { "name": "now", "returnType": "datetime", "description": "Current datetime" },
    { "name": "ago", "returnType": "datetime", "description": "Relative datetime" }
  ]
}
```

## Supported Types

When defining columns, use these Kusto type names:

- `string` - Text values
- `int` - 32-bit integer
- `long` - 64-bit integer
- `real` / `double` - Floating point numbers
- `bool` / `boolean` - True/false
- `datetime` / `date` - Date and time
- `timespan` - Duration
- `dynamic` - JSON/complex objects
- `guid` - GUID values
- `decimal` - Decimal numbers

## Usage Example

Once configured, you'll get IntelliSense in `.kql`, `.kusto`, or `.csl` files:

```kql
// Table name completion
resources
| where location == "westeurope"
| project name, type, tags.Environment

// Property completion for dynamic columns
resources
| extend provState = properties.provisioningState
| where tags.CostCenter != ""

// Function completion
resourcecontainers
| where type == "microsoft.resources/subscriptions"
| extend lowerName = tolower(name)
```

## Troubleshooting

### Symbols Not Loading

1. Check VS Code Output panel: View → Output → Select "[Kuskus] Kusto Language Server"
2. Look for messages like:
   - "Loading X custom tables and Y custom functions"
   - "Custom symbols loaded successfully"

### Reload Extension

If symbols don't appear:
1. Press `Cmd+Shift+P` / `Ctrl+Shift+P`
2. Type "Developer: Reload Window"

### Check Configuration

Ensure your settings JSON is valid:
1. Open Settings: `Cmd+,` / `Ctrl+,`
2. Click the "Open Settings (JSON)" icon in the top right
3. Verify no syntax errors

## Migrating Your Existing Configuration

If you already have custom tables defined in `.vscode/settings.json` from the original Kuskus project (they weren't working before), they'll now automatically work with this fork!

Your configuration from `/Users/axelvondielingen/Library/CloudStorage/Dropbox/Projects/dvag-kusto/.vscode/settings.json` is ready to use:
- ✅ 3 custom tables defined (`resources`, `resourcecontainers`, `ServiceHealthResources`)
- ✅ 14 custom functions defined
- ✅ Property hints for dynamic columns configured

## Development

### Project Structure

```
kusto-language-server/
├── server/
│   └── src/
│       ├── customSymbols.ts     # New: Custom symbol loader
│       ├── server.ts            # Modified: Load custom symbols
│       └── kustoSymbols.ts      # Existing: Cluster symbol loader
├── client/
│   └── src/
│       └── extension.ts         # Extension entry point
└── package.json                 # Added custom configuration schema
```

### Key Changes

1. **customSymbols.ts**: Converts VS Code configuration to Kusto symbols
2. **Configuration Schema**: Added to `package.json` for validation and IntelliSense
3. **Symbol Loading**: Automatic loading on startup and configuration changes
4. **Symbol Merging**: Custom symbols merge with cluster-loaded symbols

## Contributing

This is a fork of the original [Kuskus](https://github.com/rosshamish/kuskus) project. To contribute:

1. Fork this repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project maintains the Apache-2.0 license from the original Kuskus project.

## Acknowledgments

- Original Kuskus project by [rosshamish](https://github.com/rosshamish)
- Extended with custom symbols support for Azure Resource Graph use cases
