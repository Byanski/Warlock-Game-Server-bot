import { SchemaLoader } from '../schema/loader';
import { WarlockClient } from '../api/warlockClient';

export class CommandHandler {
  private client: WarlockClient;

  constructor(private schemaLoader: SchemaLoader) {
    this.client = new WarlockClient();
  }

  /**
   * Parses and securely routes a command string like: !w windrose "kick SomePlayer"
   * @param messageContent The raw text from the Fluxer message
   */
  public async handleMessage(messageContent: string): Promise<string | null> {
    const prefix = '!w ';
    if (!messageContent.startsWith(prefix)) return null;

    const body = messageContent.slice(prefix.length).trim();
    
    // Parse: <game_name> <api_command> [arguments]
    const parts = body.split(' ');
    if (parts.length < 2) {
      return '❌ Invalid syntax. Use: `!w <game_name> <command> [args]`';
    }

    const gameName = parts[0];
    const apiCommand = parts[1];
    const args = parts.slice(2).join(' ');

    const schema = this.schemaLoader.getSchema();

    if (!schema[gameName]) {
      return `❌ Game \`${gameName}\` is not registered in the Warlock config.`;
    }

    const gameSchema = schema[gameName];
    if (!gameSchema) {
      return `❌ Game \`${gameName}\` is not properly configured.`;
    }
    const gameDef = gameSchema.commands[apiCommand];
    if (!gameDef) {
      return `❌ Command \`${apiCommand}\` is not registered for \`${gameName}\`.`;
    }

    if (gameDef.requires_args && !args) {
      return `❌ Command \`${apiCommand}\` requires arguments.`;
    }

    if (gameDef.requires_args && gameDef.args_regex) {
      const regex = new RegExp(gameDef.args_regex);
      if (!regex.test(args)) {
        return `❌ Invalid arguments provided for \`${apiCommand}\`. Failed security validation.`;
      }
    }

    const guid = gameSchema.guid;
    const serviceName = gameSchema.service_name;
    const hostId = process.env.WARLOCK_TARGET_HOST || 'local'; // Using a designated host ID

    try {
      if (gameDef.type === 'control') {
        const action = gameDef.action as string;
        await this.client.controlService(guid, hostId, serviceName, action);
        return `✅ **Success:** Sent \`${action}\` command to ${gameName}.`;
      } else if (gameDef.type === 'custom') {
        const commandTemplate = gameDef.command as string;
        const cmdStr = commandTemplate.replace('{args}', args);
        const result = await this.client.customCommand(guid, hostId, serviceName, cmdStr);
        let response = `✅ **Execution Success for \`${gameName} ${apiCommand}\`**\n\`\`\`text\n`;
        response += result.trim() ? result.trim() : 'Command executed.';
        response += '\n```';
        return response;
      }
      
      return `❌ Unknown command type in schema.`;
    } catch (e: any) {
      return `❌ **Execution Failed**\n\`\`\`text\n${e.message}\n\`\`\``;
    }
  }
}
