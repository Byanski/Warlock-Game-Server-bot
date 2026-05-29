import * as fs from 'fs';
import * as path from 'path';

export interface CommandDefinition {
  description: string;
  requires_args: boolean;
  args_regex?: string;
  type?: 'control' | 'custom';
  action?: string;
  command?: string;
}

export interface GameDefinition {
  guid: string;
  service_name: string;
  commands: Record<string, CommandDefinition>;
}

export interface GameCommandsSchema {
  [gameName: string]: GameDefinition;
}

export class SchemaLoader {
  private schema: GameCommandsSchema = {};

  constructor(private schemaPath: string) {}

  public load(): GameCommandsSchema {
    try {
      const data = fs.readFileSync(this.schemaPath, 'utf8');
      this.schema = JSON.parse(data) as GameCommandsSchema;
      console.log(`[SchemaLoader] Successfully loaded ${Object.keys(this.schema).length} game configurations.`);
      return this.schema;
    } catch (error) {
      console.error(`[SchemaLoader] Failed to load schema from ${this.schemaPath}:`, error);
      throw error;
    }
  }

  public getSchema(): GameCommandsSchema {
    return this.schema;
  }
}
