/**
 * Custom Symbols Loader
 *
 * Converts VS Code configuration (customTables, customProperties, customFunctions)
 * into Kusto Language Symbols for IntelliSense support.
 *
 * Note: Kusto.Language bridge is loaded in server.ts, no need to import it here
 */

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
    // Check if Kusto.Language is available
    if (typeof Kusto === 'undefined' || !Kusto.Language || !Kusto.Language.Symbols) {
        throw new Error('Kusto.Language bridge is not loaded');
    }

    const symbols: any[] = [];

    // Create table symbols
    for (const tableConfig of customTables) {
        try {
            console.log(`[CustomSymbols] Creating table symbol for: ${tableConfig.name}`);
            const tableSymbol = createTableSymbol(tableConfig);
            symbols.push(tableSymbol);
            console.log(`[CustomSymbols] Successfully created table symbol: ${tableConfig.name}`);
        } catch (error) {
            console.error(`[CustomSymbols] Failed to create table symbol for ${tableConfig.name}:`, error);
            // Continue with other symbols
        }
    }

    // Create function symbols
    for (const functionConfig of customFunctions) {
        try {
            console.log(`[CustomSymbols] Creating function symbol for: ${functionConfig.name}`);
            const functionSymbol = createFunctionSymbol(functionConfig);
            symbols.push(functionSymbol);
            console.log(`[CustomSymbols] Successfully created function symbol: ${functionConfig.name}`);
        } catch (error) {
            console.error(`[CustomSymbols] Failed to create function symbol for ${functionConfig.name}:`, error);
            // Continue with other symbols
        }
    }

    console.log(`[CustomSymbols] Created ${symbols.length} symbols total`);

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
