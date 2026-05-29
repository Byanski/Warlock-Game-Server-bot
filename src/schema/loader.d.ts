export interface CommandDefinition {
    description: string;
    requires_args: boolean;
    args_regex?: string;
    system_command: string[];
}
export interface GameDefinition {
    commands: Record<string, CommandDefinition>;
}
export interface GameCommandsSchema {
    [gameName: string]: GameDefinition;
}
export declare class SchemaLoader {
    private schemaPath;
    private schema;
    constructor(schemaPath: string);
    load(): GameCommandsSchema;
    getSchema(): GameCommandsSchema;
}
//# sourceMappingURL=loader.d.ts.map