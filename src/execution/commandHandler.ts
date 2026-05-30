import { WarlockClient } from '../api/warlockClient';
import { StatusPoller } from '../monitoring/statusPoller';

export interface CommandCallbacks {
  reply: (payload: any) => Promise<string | undefined>;
  editReply: (messageId: string, payload: any) => Promise<void>;
  deleteReply: (messageId: string) => Promise<void>;
  deleteCommandMessage?: () => Promise<void>;
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

    if (apiCommand === 'help' && callbacks) {
      let helpMsg = '';
      if (gameName.includes('minecraft')) {
        helpMsg = `**Minecraft RCON Commands Help:**\n` +
          `Because Minecraft uses standard RCON, you can run **any** vanilla or modded console command!\n\n` +
          `**Examples:**\n` +
          `\`!w minecraft list\` - List all online players\n` +
          `\`!w minecraft say <message>\` - Broadcast a message\n` +
          `\`!w minecraft time set day\` - Set the time to day\n` +
          `\`!w minecraft weather clear\` - Clear the weather\n` +
          `\`!w minecraft kick <player> [reason]\` - Kick a player\n` +
          `\`!w minecraft ban <player> [reason]\` - Ban a player\n` +
          `\`!w minecraft pardon <player>\` - Unban a player\n` +
          `\`!w minecraft whitelist add <player>\` - Add a player to the whitelist`;
      } else if (gameName.includes('ark')) {
        helpMsg = `**Ark Survival Ascended RCON Commands Help:**\n` +
          `Ark uses standard RCON, meaning you can pass commands directly to the console!\n\n` +
          `**Examples:**\n` +
          `\`!w ark listplayers\` - List online players\n` +
          `\`!w ark broadcast <message>\` - Send a message to all players\n` +
          `\`!w ark saveworld\` - Force a world save\n` +
          `\`!w ark kickplayer <steamid>\` - Kick a player\n` +
          `\`!w ark banplayer <steamid>\` - Ban a player\n` +
          `For a full list of commands: https://ark.wiki.gg/wiki/Console_commands`;
      } else if (gameName.includes('zomboid') || gameName.includes('pz')) {
        helpMsg = `**Project Zomboid RCON Commands Help:**\n` +
          `Project Zomboid uses standard RCON, meaning you can pass commands directly to the console!\n\n` +
          `**Examples:**\n` +
          `\`!w zomboid players\` - List online players\n` +
          `\`!w zomboid servermsg <message>\` - Broadcast a server message\n` +
          `\`!w zomboid save\` - Force a save\n` +
          `\`!w zomboid kickuser <username>\` - Kick a player\n` +
          `For details: https://zomboid-javadoc.com/41.78/`;
      } else if (gameName.includes('hytale')) {
        helpMsg = `**Hytale Commands Help:**\n` +
          `\`!w hytale status\` - View server status\n` +
          `\`!w hytale players\` - List active players\n` +
          `\`!w hytale kick <player>\` - Kick a player\n` +
          `\`!w hytale ban <player>\` - Ban a player\n` +
          `*(Bot integration coming soon)*`;
      } else if (gameName.includes('valheim')) {
        helpMsg = `**Valheim Commands Help:**\n` +
          `\`!w valheim save\` - Force save the world\n` +
          `\`!w valheim kick <player>\` - Kick a player\n` +
          `\`!w valheim ban <player>\` - Ban a player\n` +
          `\`!w valheim unban <player>\` - Unban a player\n` +
          `\`!w valheim ping\` - Ping the server\n` +
          `\`!w valheim info\` - Print system info\n` +
          `*(Bot integration coming soon)*`;
      } else if (gameName.includes('vein')) {
        helpMsg = `**VEIN Commands Help:**\n` +
          `\`!w vein status\` - View server status\n` +
          `\`!w vein characters\` - List characters\n` +
          `\`!w vein players\` - List all players\n` +
          `\`!w vein time\` - Get current game time\n` +
          `\`!w vein weather\` - Get current weather\n` +
          `*(Bot integration coming soon)*`;
      } else if (gameName.includes('palworld')) {
        helpMsg = `**Palworld Commands Help:**\n` +
          `\`!w palworld announce <message>\` - Broadcast a message to the server\n` +
          `\`!w palworld kick <uid> [message]\` - Kick a player\n` +
          `\`!w palworld ban <uid> [message]\` - Ban a player\n` +
          `\`!w palworld unban <uid>\` - Unban a player\n` +
          `\`!w palworld save\` - Force save the world\n` +
          `\`!w palworld shutdown <seconds> [message]\` - Shutdown the server gracefully\n` +
          `\`!w palworld force_stop\` - Immediately terminate the server\n` +
          `\`!w palworld players\` - List all active players and their UIDs\n` +
          `\`!w palworld metrics\` (or \`serverfps\`) - View server metrics and performance\n` +
          `\`!w palworld info\` - View server information\n` +
          `\`!w palworld settings\` - View game settings`;
      }

      if (helpMsg) {
        const serviceDef = poller.getServiceByName(gameName);
        if (!serviceDef) {
          helpMsg = `❌ **Game \`${gameName}\` is not active on Warlock.**\n*(Wait a moment if you just started it, but here are the commands for reference:)*\n\n` + helpMsg;
        }
        await callbacks.reply({ content: helpMsg });
        return null;
      }
    }

    if ((gameName === 'start' || gameName === 'stop') && apiCommand === 'all') {
      const action = gameName; // 'start' or 'stop'
      const allServices = poller.getAllKnownServices();
      
      if (allServices.length === 0) {
        return `❌ No active instances found.`;
      }
      
      if (callbacks) {
        const overrideState = action === 'start' ? 'Starting...' : 'Stopping...';
        const msgId = await callbacks.reply({ content: `⏳ ${overrideState} all ${allServices.length} servers...` });
        
        for (const svc of allServices) {
          try {
            poller.setOverrideStatus(svc.name, overrideState);
            await this.client.controlService(svc.guid, svc.host, svc.service, action);
          } catch (err) {
            console.error(`Failed to ${action} ${svc.name}:`, err);
          }
        }
        
        if (msgId) {
          const finalState = action === 'start' ? 'running' : 'stopped';
          await callbacks.editReply(msgId, { content: `✅ All ${allServices.length} servers are now ${finalState}.` });
          
          setTimeout(async () => {
            try {
              await callbacks.deleteReply(msgId);
              if (callbacks.deleteCommandMessage) {
                await callbacks.deleteCommandMessage();
              }
            } catch (e) {}
          }, 7000);
        }
        return null;
      }
      
      for (const svc of allServices) {
        await this.client.controlService(svc.guid, svc.host, svc.service, action);
      }
      return `✅ All servers are now ${action === 'start' ? 'running' : 'stopped'}.`;
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
              if (callbacks.deleteCommandMessage) {
                await callbacks.deleteCommandMessage();
              }
            }, 7000);
          }
        }
        return null; // Return null since we handled replies manually
      } else {
        // Intercept Palworld specific commands if the service is Palworld
        const isPalworld = service.toLowerCase().includes('palworld');
        const palworldCommands = ['announce', 'kick', 'ban', 'unban', 'save', 'shutdown', 'force_stop', 'players', 'info', 'metrics', 'settings', 'serverfps', 'help'];

        if (isPalworld && palworldCommands.includes(apiCommand)) {
          if (callbacks) {
            const msgId = await callbacks.reply({ content: `⏳ Executing Palworld API command \`${apiCommand} ${args}\`...` });
            
            try {
              // 1. Fetch config to get Admin Password and REST API Port dynamically
              const configs = await this.client.getServiceConfigs(guid, host, service);
              
              const adminPasswordConfig = configs.configs?.find((c: any) => c.option === 'Admin Password');
              const adminPassword = adminPasswordConfig?.value || '';

              const restPortConfig = configs.configs?.find((c: any) => c.option === 'REST API Port');
              const restPort = restPortConfig?.value || 8212;

              // 2. Initialize PalworldClient
              const { PalworldClient } = require('../api/palworldClient');
              const detailsData = await this.client.getServiceDetails(guid, host, service);
              const serverIp = detailsData.service?.ip || '127.0.0.1';

              const pwClient = new PalworldClient(serverIp, restPort, adminPassword);

              // 3. Execute command
              let result: any;
              switch (apiCommand) {
                case 'announce': result = await pwClient.announce(args); break;
                case 'kick': result = await pwClient.kick(args.split(' ')[0], args.split(' ').slice(1).join(' ')); break;
                case 'ban': result = await pwClient.ban(args.split(' ')[0], args.split(' ').slice(1).join(' ')); break;
                case 'unban': result = await pwClient.unban(args.split(' ')[0]); break;
                case 'save': 
                  await pwClient.save(); 
                  result = { message: '✅ Game successfully saved.' }; 
                  break;
                case 'shutdown': result = await pwClient.shutdown(60, args); break;
                case 'force_stop': result = await pwClient.forceStop(); break;
                case 'players': result = await pwClient.getPlayers(); break;
                case 'info': result = await pwClient.info(); break;
                case 'metrics': 
                case 'serverfps':
                  result = await pwClient.metrics(); 
                  break;
                case 'settings': result = await pwClient.settings(); break;
              }

              if (msgId) {
                await callbacks.editReply(msgId, { content: `✅ Palworld API response:\n\`\`\`json\n${JSON.stringify(result, null, 2).slice(0, 1900)}\n\`\`\`` });
              }
            } catch (err: any) {
              if (msgId) {
                await callbacks.editReply(msgId, { content: `❌ Palworld API error: ${err.message}` });
              }
            }
          }
          return null;
        }

        // Game-specific Interceptors
        const srv = service.toLowerCase();
        const isMinecraft = srv.includes('minecraft');
        const isArk = srv.includes('ark');
        const isZomboid = srv.includes('zomboid') || srv.includes('pz');
        const isHytale = srv.includes('hytale');
        const isValheim = srv.includes('valheim');
        const isVein = srv.includes('vein');

        // Help-only games (No direct bot API integration yet)
        if (isHytale) {
          if (callbacks && apiCommand === 'help') {
            return null; // Handled at top
          }
        }

        // RCON-based games
        if (isMinecraft || isArk || isZomboid || isValheim) {
          if (callbacks) {
            if (apiCommand === 'help') {
              return null; // Handled at top
            }

            const rawCommand = `${apiCommand} ${args}`.trim();
            const gameTitle = isMinecraft ? 'Minecraft' : (isArk ? 'Ark' : (isZomboid ? 'Project Zomboid' : 'Valheim'));
            const msgId = await callbacks.reply({ content: `⏳ Executing ${gameTitle} RCON command \`${rawCommand}\`...` });
            
            try {
              // 1. Fetch config to get RCON Password and Port dynamically
              const configs = await this.client.getServiceConfigs(guid, host, service);
              
              const rconPasswordConfig = configs.configs?.find((c: any) => c.option === 'RCON Password');
              const rconPassword = rconPasswordConfig?.value || '';

              const rconPortConfig = configs.configs?.find((c: any) => c.option === 'RCON Port');
              const rconPort = rconPortConfig?.value || (isMinecraft ? 25575 : (isArk ? 27020 : (isValheim ? 2458 : 27015)));

              // 2. Initialize GenericRconClient
              const { GenericRconClient } = require('../api/rconClient');
              const detailsData = await this.client.getServiceDetails(guid, host, service);
              const serverIp = detailsData.service?.ip || '127.0.0.1';

              const rconClient = new GenericRconClient(serverIp, rconPort, rconPassword);

              // 3. Execute command
              const result = await rconClient.executeCommand(rawCommand);

              if (msgId) {
                await callbacks.editReply(msgId, { content: `✅ ${gameTitle} RCON response:\n\`\`\`\n${result.slice(0, 1900)}\n\`\`\`` });
              }
            } catch (err: any) {
              if (msgId) {
                await callbacks.editReply(msgId, { content: `❌ ${gameTitle} RCON error: ${err.message}` });
              }
            }
          }
          return null;
        }

        // VEIN HTTP API
        if (isVein) {
          if (callbacks) {
            if (apiCommand === 'help') {
              return null; // Handled at top
            }

            const msgId = await callbacks.reply({ content: `⏳ Executing VEIN API command \`${apiCommand}\`...` });
            
            try {
              // 1. Fetch config to get HTTP Port dynamically
              const configs = await this.client.getServiceConfigs(guid, host, service);
              
              const httpPortConfig = configs.configs?.find((c: any) => c.option === 'HTTP Port' || c.option === 'HTTPPort' || c.option === 'Port');
              const httpPort = httpPortConfig?.value ? parseInt(httpPortConfig.value) : 8080;

              // 2. Fetch details to get server IP
              const detailsData = await this.client.getServiceDetails(guid, host, service);
              const serverIp = detailsData.service?.ip || '127.0.0.1';

              // 3. Initialize VeinClient
              const { VeinClient } = require('../api/veinClient');
              const veinClient = new VeinClient(serverIp, httpPort);

              // 3. Execute command
              const result = await veinClient.execute(apiCommand, args);

              if (msgId) {
                await callbacks.editReply(msgId, { content: `✅ VEIN API response:\n\`\`\`json\n${JSON.stringify(result, null, 2).slice(0, 1900)}\n\`\`\`` });
              }
            } catch (err: any) {
              if (msgId) {
                await callbacks.editReply(msgId, { content: `❌ VEIN API error: ${err.message}` });
              }
            }
          }
          return null;
        }

        // It's a custom command (e.g. broadcast)
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
