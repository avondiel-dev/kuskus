/// <reference path="../node_modules/@kusto/language-service-next/Kusto.Language.Bridge.d.ts" />
/// <reference path="./typings/MissingFromBridge.d.ts" />
/// <reference path="./typings/refs.d.ts" />
import './bridge.min';
import './Kusto.Language.Bridge.min';

import {
    createConnection,
    TextDocuments,
    TextDocument,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    TextDocumentPositionParams,
    Hover,
    TextEdit,
    DocumentFormattingParams,
    Position
} from 'vscode-languageserver';

import { getClient as getKustoClient, TokenResponse, getFirstOrDefaultClient } from './kustoConnection';
import { getSymbolsOnCluster, getSymbolsOnTable } from './kustoSymbols';
import { formatCodeScript } from './kustoFormat';
import { getVSCodeCompletionItemsAtPosition } from './kustoCompletion';
import { createCustomGlobalState, mergeGlobalStates, CustomTableConfig, CustomFunctionConfig } from './customSymbols';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

// Create a collection of Kusto code services, one for each document
type documentURI = string;
let kustoGlobalState: Kusto.Language.GlobalState = Kusto.Language.GlobalState.Default;
let kustoCodeScripts: Map<documentURI, Kusto.Language.Editor.CodeScript> = new Map();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
    let capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );

    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            completionProvider: {
                resolveProvider: true
            },
            hoverProvider: true,
            documentFormattingProvider: true,
        }
    };
});

connection.onInitialized(async () => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }

    // Load custom symbols from configuration
    try {
        connection.console.log('[Kuskus] Starting to load custom symbols...');
        await loadCustomSymbols();
        connection.console.log('[Kuskus] Custom symbols loading complete');
    } catch (error) {
        connection.console.error(`[Kuskus] Failed to load custom symbols on initialization: ${error}`);
        // Don't crash - continue without custom symbols
    }
});

connection.onRequest('kuskus.loadSymbols', async ({ clusterUri, tenantId, database }: { clusterUri: string, tenantId: string, database: string }) => {
	let kustoClient = getKustoClient(clusterUri, tenantId, (tokenResponse: TokenResponse) => {
		connection.sendRequest('kuskus.loadSymbols.auth', { clusterUri, tenantId, database, verificationUrl: tokenResponse.verificationUrl, verificationCode: tokenResponse.userCode });
	});

	try {
		kustoGlobalState = await getSymbolsOnCluster(kustoClient, database);
		connection.sendNotification('kuskus.loadSymbols.auth.complete.success', { clusterUri, tenantId, database });
		connection.sendNotification('kuskus.loadSymbols.success', { clusterUri, database });
		kustoCodeScripts.forEach((value, key) => {
			kustoCodeScripts.set(key, value.WithGlobals(kustoGlobalState));
		});
	} catch {
		connection.sendNotification('kuskus.loadSymbols.auth.complete.error', { clusterUri, tenantId, database });
	}
});

connection.onRequest('kuskus.loadTable', async ( tableName : string) => {
	
	let clusterUri: string = "";
	let kustoClient = null;
	 ( {clusterUri, kustoClient} = getFirstOrDefaultClient());
	 let database: string = kustoGlobalState.Database.Name;
	
	try {
		kustoGlobalState = await getSymbolsOnTable(kustoClient, database, tableName, kustoGlobalState);
		connection.sendNotification('kuskus.loadSymbols.auth.complete.success', { clusterUri, database });
		connection.sendNotification('kuskus.loadSymbols.success', { clusterUri, database });
		kustoCodeScripts.forEach((value, key) => {
			kustoCodeScripts.set(key, value.WithGlobals(kustoGlobalState));
		});
	} catch {
		connection.sendNotification('kuskus.loadSymbols.auth.complete.error', { clusterUri, database });
	}
})

// The example settings
interface Settings {
	diagnosticsEnabled: boolean;
	customTables?: CustomTableConfig[];
	customFunctions?: CustomFunctionConfig[];
	customProperties?: { [key: string]: string[] };
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: Settings = { 
	diagnosticsEnabled: false
};
let globalSettings: Settings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<Settings>> = new Map();

connection.onDidChangeConfiguration(async change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <Settings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Reload custom symbols when configuration changes
	await loadCustomSymbols();

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<Settings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'kuskusLanguageServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

async function getCustomConfiguration(section: string): Promise<any> {
	if (!hasConfigurationCapability) {
		return undefined;
	}
	try {
		return await connection.workspace.getConfiguration({
			section: section
		});
	} catch (error) {
		connection.console.error(`Failed to get configuration for ${section}: ${error}`);
		return undefined;
	}
}

async function loadCustomSymbols(): Promise<void> {
	try {
		connection.console.log('[Kuskus] Getting custom configuration...');

		// Get custom configuration from VS Code settings
		const customTables = await getCustomConfiguration('kuskus.customTables') || [];
		const customFunctions = await getCustomConfiguration('kuskus.customFunctions') || [];

		connection.console.log(`[Kuskus] Found ${customTables.length} custom tables and ${customFunctions.length} custom functions in config`);

		if (customTables.length === 0 && customFunctions.length === 0) {
			connection.console.log('[Kuskus] No custom tables or functions configured');
			return;
		}

		connection.console.log(`[Kuskus] Creating custom global state...`);

		// Create custom global state
		const customState = createCustomGlobalState(customTables, customFunctions, 'CustomDatabase');

		connection.console.log(`[Kuskus] Merging with existing global state...`);

		// Merge with existing global state
		kustoGlobalState = mergeGlobalStates(kustoGlobalState, customState);

		connection.console.log(`[Kuskus] Updating code scripts...`);

		// Update all code scripts with new global state
		kustoCodeScripts.forEach((value, key) => {
			if (value) {
				kustoCodeScripts.set(key, value.WithGlobals(kustoGlobalState));
			}
		});

		connection.console.log('[Kuskus] Custom symbols loaded successfully');
	} catch (error) {
		connection.console.error(`[Kuskus] Failed to load custom symbols: ${error}`);
		if (error instanceof Error) {
			connection.console.error(`[Kuskus] Error stack: ${error.stack}`);
		}
		throw error; // Re-throw to see if this is causing the crash
	}
}

// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    if (!kustoCodeScripts.has(change.document.uri)) {
        kustoCodeScripts.set(change.document.uri, _getCodeScriptForDocumentOrNewCodeScript(change.document));
    } else {
        const beforeChange = _getCodeScriptForDocumentOrNewCodeScript(change.document);
        kustoCodeScripts.set(change.document.uri, beforeChange.WithText(change.document.getText()));
    }
    validateTextDocument(change.document);
});

function _getCodeScriptForDocumentOrNewCodeScript(document: TextDocument) : Kusto.Language.Editor.CodeScript {
    return (
        kustoCodeScripts.get(document.uri) || 
        Kusto.Language.Editor.CodeScript.From$1(document.getText(), kustoGlobalState)
    );
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const settings = await getDocumentSettings(textDocument.uri);
	if (!settings.diagnosticsEnabled) {
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
		return;
	}

	const kustoCodeScript = _getCodeScriptForDocumentOrNewCodeScript(textDocument);
	let documentDiagnostics: Diagnostic[] = [];

	const blocks = kustoCodeScript.Blocks;
	for (let i=0; i < blocks.Count; i++) {
		let block = blocks._items[i];
		let diagnostics = block.Service.GetDiagnostics();
		for (let j=0; j < diagnostics.Count; j++) {
			let diagnostic = diagnostics.Items._items[j];
			documentDiagnostics.push({
				severity: DiagnosticSeverity.Error,
				range: {
				  start: textDocument.positionAt(diagnostic.Start),
				  end: textDocument.positionAt(diagnostic.End)
				},
				message: diagnostic.Message
			})
		}
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: documentDiagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        // The pass parameter contains the position of the text document in
        // which code complete got requested. For the example we ignore this
        // info and always provide the same completion items.

        const kustoCodeScript = kustoCodeScripts.get(_textDocumentPosition.textDocument.uri);
        if (kustoCodeScript === undefined) {
            return [];
        }

        try {
            return getVSCodeCompletionItemsAtPosition(kustoCodeScript, _textDocumentPosition.position.line + 1, _textDocumentPosition.position.character + 1)
        } catch (e) {
            connection.console.error(String(e));
            return [];
        }
    }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return item;
    }
);

connection.onHover(
    (params: TextDocumentPositionParams): Hover | null => {
        const kustoCodeScript = kustoCodeScripts.get(params.textDocument.uri);
        if (kustoCodeScript !== undefined) {
            let position = {v:-1};
            let positionValid = kustoCodeScript.TryGetTextPosition(params.position.line + 1, params.position.character + 1, position);
            const kustoCodeBlock = kustoCodeScript.GetBlockAtPosition(position.v);
            const quickInfo = kustoCodeBlock.Service.GetQuickInfo(position.v);

            return {contents: quickInfo.Text};
        }
        return null;
    }
)

connection.onDocumentFormatting(
    (params: DocumentFormattingParams): TextEdit[] | null => {
        const kustoCodeScript = kustoCodeScripts.get(params.textDocument.uri);
        if (kustoCodeScript === undefined) {
            return null;
        }

        let formatted: string = formatCodeScript(kustoCodeScript);
        let changes:TextEdit[] = [TextEdit.replace({
            start: {line: 0, character: 0},
            end: {line: Number.MAX_VALUE, character: Number.MAX_VALUE}
        }, formatted)];
        return changes;
    }
)

/*
connection.onDidOpenTextDocument((params) => {
    // A text document got opened in VSCode.
    // params.uri uniquely identifies the document. For documents store on disk this is a file URI.
    // params.text the initial full content of the document.
    connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
    // The content of a text document did change in VSCode.
    // params.uri uniquely identifies the document.
    // params.contentChanges describe the content changes to the document.
    connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
    // A text document got closed in VSCode.
    // params.uri uniquely identifies the document.
    connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
