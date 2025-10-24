/**
 * Custom Symbols Loader
 *
 * Converts VS Code configuration (customTables, customProperties, customFunctions)
 * into Kusto Language Symbols for IntelliSense support.
 */

import "../node_modules/@kusto/language-service-next/bridge";
import "../node_modules/@kusto/language-service-next/Kusto.Language.Bridge";

/**
 * Interface matching kuskus.customTables configuration
 */
export interface CustomTableConfig {
    name: string;
    description?: string;
    columns: Array<{
        name: string;
        type: string;
        description?: string;
    }>;
}

/**
 * Interface matching kuskus.customFunctions configuration
 */
export interface CustomFunctionConfig {
    name: string;
    description?: string;
    returnType: string;
}

/**
 * Interface matching kuskus.customProperties configuration
 */
export interface CustomPropertiesConfig {
    [tableDotColumn: string]: string[];
}

/**
 * Maps type string to Kusto ScalarType
 */
function getTypeSymbol(type: string): any {
    const typeLower = type.toLowerCase();

    // Map common type names to Kusto types
    const typeMap: { [key: string]: any } = {
        'string': Kusto.Language.Symbols.ScalarTypes.String,
        'int': Kusto.Language.Symbols.ScalarTypes.Int,
        'long': Kusto.Language.Symbols.ScalarTypes.Long,
        'real': Kusto.Language.Symbols.ScalarTypes.Real,
        'double': Kusto.Language.Symbols.ScalarTypes.Real,
        'bool': Kusto.Language.Symbols.ScalarTypes.Bool,
        'boolean': Kusto.Language.Symbols.ScalarTypes.Bool,
        'datetime': Kusto.Language.Symbols.ScalarTypes.DateTime,
        'date': Kusto.Language.Symbols.ScalarTypes.DateTime,
        'timespan': Kusto.Language.Symbols.ScalarTypes.TimeSpan,
        'dynamic': Kusto.Language.Symbols.ScalarTypes.Dynamic,
        'guid': Kusto.Language.Symbols.ScalarTypes.Guid,
        'decimal': Kusto.Language.Symbols.ScalarTypes.Decimal,
    };

    return typeMap[typeLower] || Kusto.Language.Symbols.ScalarTypes.String;
}

/**
 * Creates a ColumnSymbol from column configuration
 */
function createColumnSymbol(columnConfig: { name: string; type: string; description?: string }): any {
    return new Kusto.Language.Symbols.ColumnSymbol(
        columnConfig.name,
        getTypeSymbol(columnConfig.type)
    );
}

/**
 * Creates a TableSymbol from table configuration
 */
function createTableSymbol(tableConfig: CustomTableConfig): any {
    const columns = tableConfig.columns.map(col => createColumnSymbol(col));

    return new Kusto.Language.Symbols.TableSymbol.$ctor3(
        tableConfig.name,
        columns
    );
}

/**
 * Creates a FunctionSymbol from function configuration
 */
function createFunctionSymbol(functionConfig: CustomFunctionConfig): any {
    // Create a simple signature with no parameters
    // Format: functionName(): returnType
    const signature = new Kusto.Language.Symbols.Signature.$ctor4(
        Kusto.Language.Symbols.ReturnTypeKind.Common,
        [] // empty parameters array
    );

    return new Kusto.Language.Symbols.FunctionSymbol.$ctor6(
        functionConfig.name,
        [signature]
    );
}

/**
 * Converts custom configuration to Kusto GlobalState
 */
export function createCustomGlobalState(
    customTables: CustomTableConfig[] = [],
    customFunctions: CustomFunctionConfig[] = [],
    databaseName: string = "CustomDatabase"
): any {
    const symbols: any[] = [];

    // Create table symbols
    for (const tableConfig of customTables) {
        try {
            const tableSymbol = createTableSymbol(tableConfig);
            symbols.push(tableSymbol);
        } catch (error) {
            console.error(`Failed to create table symbol for ${tableConfig.name}:`, error);
        }
    }

    // Create function symbols
    for (const functionConfig of customFunctions) {
        try {
            const functionSymbol = createFunctionSymbol(functionConfig);
            symbols.push(functionSymbol);
        } catch (error) {
            console.error(`Failed to create function symbol for ${functionConfig.name}:`, error);
        }
    }

    // Create database symbol with all tables and functions
    const databaseSymbol = new Kusto.Language.Symbols.DatabaseSymbol.ctor(
        databaseName,
        symbols
    );

    // Create global state with the database
    return Kusto.Language.GlobalState.Default.WithDatabase(databaseSymbol);
}

/**
 * Merges custom global state with existing cluster-loaded state
 */
export function mergeGlobalStates(
    existingState: any,
    customState: any
): any {
    if (!existingState || !existingState.Database) {
        return customState;
    }

    if (!customState || !customState.Database) {
        return existingState;
    }

    // Get members from both databases
    const existingMembers = existingState.Database.Members || [];
    const customMembers = customState.Database.Members || [];

    // Merge members (custom symbols override existing ones with the same name)
    const memberMap = new Map();

    // Add existing members first
    for (const member of existingMembers) {
        if (member && member.Name) {
            memberMap.set(member.Name, member);
        }
    }

    // Add/override with custom members
    for (const member of customMembers) {
        if (member && member.Name) {
            memberMap.set(member.Name, member);
        }
    }

    // Create merged database
    const mergedSymbols = Array.from(memberMap.values());
    const mergedDatabase = new Kusto.Language.Symbols.DatabaseSymbol.ctor(
        existingState.Database.Name || "Database",
        mergedSymbols
    );

    return existingState.WithDatabase(mergedDatabase);
}
