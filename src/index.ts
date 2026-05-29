import * as dotenv from 'dotenv';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { File } from 'buffer';

if (!globalThis.File) {
  (globalThis as any).File = File;
}
import * as path from 'path';
import { SchemaLoader } from './schema/loader';
import { CommandHandler } from './execution/commandHandler';
import { StatusPoller } from './monitoring/statusPoller';
import { Client, GatewayDispatchEvents, GatewayIntentBits } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { WebSocketManager } from '@discordjs/ws';

dotenv.config();

console.log('[App] Starting Bot for Warlock...');

// 1. Load the dynamic route configuration
const schemaPath = path.join(__dirname, '..', 'game_commands.json');
const schemaLoader = new SchemaLoader(schemaPath);
schemaLoader.load();

// 2. Initialize the Command Handler
const commandHandler = new CommandHandler(schemaLoader);

interface Platform {
  name: string;
  token: string;
  statusChannelId: string;
  isDiscord?: boolean;
}

const platforms: Platform[] = [];

if (process.env.FLUXER_TOKEN) {
  platforms.push({
    name: 'Fluxer',
    token: process.env.FLUXER_TOKEN,
    statusChannelId: process.env.STATUS_CHANNEL_ID || ''
  });
}

if (process.env.DISCORD_TOKEN) {
  platforms.push({
    name: 'Discord',
    token: process.env.DISCORD_TOKEN,
    statusChannelId: process.env.DISCORD_STATUS_CHANNEL_ID || '',
    isDiscord: true
  });
}

// Helper function to send messages to platforms via REST
async function sendMessage(platform: Platform, channelId: string, payload: any) {
  try {
    const url = platform.isDiscord 
      ? `https://discord.com/api/v10/channels/${channelId}/messages` 
      : `https://api.fluxer.app/v1/channels/${channelId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${platform.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[${platform.name} API] Failed to send message: ${res.status} ${errText}`);
    } else {
      console.log(`[${platform.name} API] Message sent successfully to ${channelId}.`);
    }
  } catch (error) {
    console.error(`[${platform.name} API] Error sending message:`, error);
  }
}

// 3. Start the Status Poller
const poller = new StatusPoller(async (channelId_ignored, embedPayload) => {
  for (const p of platforms) {
    if (p.statusChannelId) {
      await sendMessage(p, p.statusChannelId, embedPayload);
    }
  }
});

// Start polling for all loaded game configurations
const schema = schemaLoader.getSchema();
for (const gameName in schema) {
  const gameConfig = schema[gameName];
  if (gameConfig) {
    poller.startPolling(gameName, gameConfig.guid, gameConfig.service_name, 'ignored', 60000);
  }
}

function connectGateway(platform: Platform) {
  const restOptions: any = { version: platform.isDiscord ? '10' : '1' };
  if (!platform.isDiscord) {
    restOptions.api = 'https://api.fluxer.app';
  }
  
  const rest = new REST(restOptions).setToken(platform.token);
  const gateway = new WebSocketManager({
    intents: platform.isDiscord ? (GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent) : 0,
    rest,
    token: platform.token,
    version: platform.isDiscord ? '10' : '1',
  });
  
  const client = new Client({ rest, gateway });

  client.on(GatewayDispatchEvents.MessageCreate, async ({ data: message }) => {
    try {
      if (message.author?.bot) return;

      const adminRoleId = process.env.ADMIN_ROLE_ID;
      if (message.content.startsWith('!w ') && adminRoleId) {
        const hasRole = message.member?.roles?.includes(adminRoleId);
        if (!hasRole) {
          await sendMessage(platform, message.channel_id, { content: '❌ You do not have permission to execute Warlock commands.' });
          return;
        }
      }

      const responseText = await commandHandler.handleMessage(message.content);
      
      if (responseText) {
        await sendMessage(platform, message.channel_id, { content: responseText });
      }
    } catch (err) {
      console.error(`[${platform.name} Gateway] Message processing error:`, err);
    }
  });

  client.on(GatewayDispatchEvents.Ready, ({ data }) => {
    console.log(`[${platform.name} Gateway] Ready as @${data.user.username}#${data.user.discriminator ?? '0000'}.`);
  });

  gateway.connect();
}

if (platforms.length === 0) {
  console.warn('[App] No platform tokens provided! Please set FLUXER_TOKEN or DISCORD_TOKEN in .env.');
}

for (const p of platforms) {
  connectGateway(p);
}

console.log('[App] Bot successfully initialized.');
