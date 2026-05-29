import { WarlockClient } from '../api/warlockClient';
import { StatusPoller } from '../monitoring/statusPoller';

export interface CommandCallbacks {
  reply: (payload: any) => Promise<string | undefined>;
  editReply: (messageId: string, payload: any) => Promise<void>;
  deleteReply: (messageId: string) => Promise<void>;
}

export class CommandHandler {
  private client: WarlockClient;

  constructor() {
    this.client = new WarlockClient();
  }

  public async handleMessage(
    messageContent: string,
    callbacks?: CommandCallbacks,
    poller?: StatusPoller
  ): Promise<string | null> {
    const prefix = '!w ';
    if (!messageContent.startsWith(prefix)) return null;

    const body = messageContent.slice(prefix.length).trim();
    
    // Parse: <game_name> <api_command> [arguments]
    const parts = body.split(' ');
    if (parts.length < 2) {
      return '❌ Invalid syntax. Use: `!w <game_name> <command> [args]`';
    }

    const gameName = (parts[0] || '').toLowerCase();
    const apiCommand = (parts[1] || '').toLowerCase();
    const args = parts.slice(2).join(' ');

    if (!poller) {
       return `❌ Bot is still initializing, please try again.`;
    }

    const serviceDef = poller.getServiceByName(gameName);
    
    if (!serviceDef) {
      return `❌ Game \`${gameName}\` is not active on Warlock. (Wait a moment if you just started it)`;
    }

    const { guid, host, service } = serviceDef;

    try {
      if (apiCommand === 'start' || apiCommand === 'stop' || apiCommand === 'restart') {
        const overrideState = apiCommand === 'start' ? 'Starting...' : (apiCommand === 'stop' ? 'Stopping...' : 'Restarting...');
        
        if (callbacks && poller) {
          poller.setOverrideStatus(gameName, overrideState);
          
          const msgId = await callbacks.reply({ content: `⏳ Server is ${overrideState.toLowerCase()}` });
          
          await this.client.controlService(guid, host, service, apiCommand);

          if (msgId) {
            const targetStatus = apiCommand === 'stop' ? 'stopped' : 'running';
            let reachedTarget = false;
            
            for (let i = 0; i < 15; i++) { 
              await new Promise(r => setTimeout(r, 2000));
              try {
                const details = await this.client.getServiceDetails(guid, host, service);
                const currentStatus = details.service ? details.service.status : details.status;
                if (currentStatus === targetStatus || (targetStatus === 'running' && currentStatus === 'ONLINE') || (targetStatus === 'stopped' && currentStatus === 'OFFLINE')) {
                  reachedTarget = true;
                  break;
                }
              } catch (e) {
                if (targetStatus === 'stopped') {
                  reachedTarget = true;
                  break;
                }
              }
            }

            if (reachedTarget) {
              await callbacks.editReply(msgId, { content: `✅ Server is now ${targetStatus}.` });
            } else {
              await callbacks.editReply(msgId, { content: `⚠️ Command sent, but API timed out waiting for status change.` });
            }

            poller.setOverrideStatus(gameName, null);

            setTimeout(async () => {
              await callbacks.deleteReply(msgId);
            }, 7000);
          }
        }
        return null; // Return null since we handled replies manually
      } else {
        // It's a custom command (e.g. save, broadcast)
        // Send it directly to Warlock's service console
        if (callbacks) {
          const msgId = await callbacks.reply({ content: `⏳ Executing \`${apiCommand} ${args}\`...` });
          const responseText = await this.client.customCommand(guid, host, service, `${apiCommand} ${args}`.trim());
          
          let cleanOutput = responseText.replace(/<[^>]*>?/gm, '').trim();
          if (cleanOutput.length > 1900) {
            cleanOutput = cleanOutput.substring(0, 1900) + '...';
          }
          
          if (cleanOutput) {
            await callbacks.editReply(msgId!, { content: `**Output:**\n\`\`\`\n${cleanOutput}\n\`\`\`` });
          } else {
            await callbacks.editReply(msgId!, { content: `✅ Command executed successfully.` });
          }
          return null;
        }
      }
    } catch (err: any) {
      return `❌ API Error: ${err.message}`;
    }

    return null;
  }
}
