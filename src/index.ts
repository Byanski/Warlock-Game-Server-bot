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
import { Client, GatewayDispatchEvents } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { WebSocketManager } from '@discordjs/ws';

dotenv.config();

const FLUXER_API_BASE = 'https://api.fluxer.app/v1';
const TOKEN = process.env.FLUXER_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CHANNEL_ID = process.env.STATUS_CHANNEL_ID || '1234567890'; // Target channel for status updates

console.log('[App] Starting Fluxer Bot for Warlock...');

// 1. Load the dynamic route configuration
const schemaPath = path.join(__dirname, '..', 'game_commands.json');
const schemaLoader = new SchemaLoader(schemaPath);
schemaLoader.load();

// 2. Initialize the Command Handler
const commandHandler = new CommandHandler(schemaLoader);

// Helper function to send messages to Fluxer via REST
async function sendMessage(channelId: string, payload: any) {
  try {
    const res = await fetch(`${FLUXER_API_BASE}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[API] Failed to send message: ${res.status} ${errText}`);
    } else {
      console.log(`[API] Message sent successfully to ${channelId}.`);
    }
  } catch (error) {
    console.error(`[API] Error sending message:`, error);
  }
}

// 3. Start the Status Poller
const poller = new StatusPoller(async (channelId, embedPayload) => {
  await sendMessage(channelId, embedPayload);
});

// Start polling for all loaded game configurations
const schema = schemaLoader.getSchema();
for (const gameName in schema) {
  const gameConfig = schema[gameName];
  poller.startPolling(gameName, gameConfig.guid, gameConfig.service_name, CHANNEL_ID, 60000);
}

function connectGateway() {
  const rest = new REST({ api: 'https://api.fluxer.app', version: '1' }).setToken(TOKEN);
  const gateway = new WebSocketManager({
    intents: 0,
    rest,
    token: TOKEN,
    version: '1',
  });
  const client = new Client({ rest, gateway });

  client.on(GatewayDispatchEvents.MessageCreate, async ({ data: message }) => {
    try {
      if (message.author?.bot) return;

      const adminRoleId = process.env.ADMIN_ROLE_ID;
      if (message.content.startsWith('!w ') && adminRoleId) {
        const hasRole = message.member?.roles?.includes(adminRoleId);
        if (!hasRole) {
          await sendMessage(message.channel_id, { content: '❌ You do not have permission to execute Warlock commands.' });
          return;
        }
      }

      const responseText = await commandHandler.handleMessage(message.content);
      
      if (responseText) {
        await sendMessage(message.channel_id, { content: responseText });
      }
    } catch (err) {
      console.error('[Gateway] Message processing error:', err);
    }
  });

  client.on(GatewayDispatchEvents.Ready, ({ data }) => {
    console.log(`[Gateway] Fluxer Gateway ready as @${data.user.username}#${data.user.discriminator ?? '0000'}.`);
  });

  gateway.connect();
}

connectGateway();
console.log('[App] Bot successfully initialized.');
