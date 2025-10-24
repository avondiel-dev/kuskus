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
    // If no custom state, return existing state
    if (!customState || !customState.Database) {
        console.log('[CustomSymbols] No custom state, using existing state only');
        return existingState;
    }

    // Check if existingState has a real database (not just the Default state or our CustomDatabase)
    const hasExistingDatabase = existingState &&
                                existingState.Database &&
                                existingState.Database.Name &&
                                existingState.Database.Name !== 'Default' &&
                                existingState.Database.Name !== 'CustomDatabase';

    // If no existing database, just return custom state
    if (!hasExistingDatabase) {
        console.log('[CustomSymbols] No existing database (or CustomDatabase), using custom state only');
        return customState;
    }

    console.log(`[CustomSymbols] Merging custom symbols with existing database: ${existingState.Database.Name}`);

    // Get all symbols from custom state's database
    const customDb = customState.Database;
    const customSymbols: any[] = [];

    // Try to get symbols from the database
    try {
        // The database has tables and functions as separate collections
        // Let's just use AddSymbols with an empty array and then add our custom database
        // Or simpler: just return the custom state since we want these symbols available

        // For now, if there's an existing database from a cluster, keep it
        // and just add our custom symbols to it
        const allSymbols: any[] = [];

        // Collect all members from custom database
        if (customDb.Tables) {
            const tables = customDb.Tables;
            for (let i = 0; i < tables.length; i++) {
                allSymbols.push(tables[i]);
            }
        }

        if (customDb.Functions) {
            const functions = customDb.Functions;
            for (let i = 0; i < functions.length; i++) {
                allSymbols.push(functions[i]);
            }
        }

        console.log(`[CustomSymbols] Adding ${allSymbols.length} custom symbols to existing database`);

        // Use AddSymbols to add our custom symbols to the existing database
        const mergedDatabase = existingState.Database.AddSymbols(allSymbols);
        return existingState.WithDatabase(mergedDatabase);
    } catch (error) {
        console.error('[CustomSymbols] Error merging databases:', error);
        console.log('[CustomSymbols] Falling back to custom state only');
        return customState;
    }
}
