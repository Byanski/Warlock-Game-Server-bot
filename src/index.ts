import * as dotenv from 'dotenv';
import * as path from 'path';
import { SchemaLoader } from './schema/loader';
import { CommandHandler } from './execution/commandHandler';
import { StatusPoller } from './monitoring/statusPoller';
import WebSocket from 'ws';

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

// We simulate polling for Windrose every 60 seconds.
const schema = schemaLoader.getSchema();
if (schema['windrose']) {
  poller.startPolling('windrose', schema['windrose'].guid, schema['windrose'].service_name, CHANNEL_ID, 60000);
}

// 4. Connect to Fluxer WebSocket Gateway (mock endpoint conceptually based on docs)
// Since Fluxer Gateway is modeled after Discord, it usually requires sending IDENTIFY.
// We'll write a conceptual WebSocket wrapper here.
function connectGateway() {
  // Using a mock gateway URL for this example since we don't have the exact gateway path
  const wsUrl = 'wss://gateway.fluxer.app/?v=1&encoding=json';
  let ws: WebSocket;
  
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.log('[Gateway] Cannot connect to mock WSS endpoint, continuing in standalone mode.');
    return;
  }

  ws.on('open', () => {
    console.log('[Gateway] Connected to Fluxer WebSocket.');
    const identifyPayload = {
      op: 2,
      d: {
        token: TOKEN,
        intents: 513, // Guilds + Guild Messages (conceptual)
        properties: {
          $os: process.platform,
          $browser: 'WarlockBot',
          $device: 'WarlockBot'
        }
      }
    };
    ws.send(JSON.stringify(identifyPayload));
  });

  ws.on('message', async (data: WebSocket.Data) => {
    try {
      const payload = JSON.parse(data.toString());
      
      // Handle heartbeats and acks conceptually...
      if (payload.op === 10) {
        // Hello event, start heartbeat
        const heartbeatInterval = payload.d.heartbeat_interval;
        setInterval(() => {
          ws.send(JSON.stringify({ op: 1, d: null }));
        }, heartbeatInterval);
      }

      // Handle message create events
      if (payload.t === 'MESSAGE_CREATE') {
        const message = payload.d;
        
        // Ignore bot messages
        if (message.author?.bot) return;

        // Check for admin role before processing command
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (message.content.startsWith('!w ') && adminRoleId) {
          const hasRole = message.member?.roles?.includes(adminRoleId);
          if (!hasRole) {
            await sendMessage(message.channel_id, { content: '❌ You do not have permission to execute Warlock commands.' });
            return;
          }
        }

        // Process command
        const responseText = await commandHandler.handleMessage(message.content);
        
        if (responseText) {
          await sendMessage(message.channel_id, { content: responseText });
        }
      }
    } catch (err) {
      console.error('[Gateway] Message processing error:', err);
    }
  });

  ws.on('close', () => {
    console.log('[Gateway] Connection closed. Reconnecting in 5s...');
    setTimeout(connectGateway, 5000);
  });
  
  ws.on('error', (err) => {
    // Expected to error out since gateway.fluxer.app is a mock
    console.log('[Gateway] Connection error (mock gateway).');
  });
}

connectGateway();
console.log('[App] Bot successfully initialized.');
