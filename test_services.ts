import { WarlockClient } from './dist/api/warlockClient.js';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function listServices() {
  const client = new WarlockClient();
  try {
    await client.authenticate();
    const res = await (client as any).request('https://warlock.droogle.tech/api/services', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    console.log(await res.text());
  } catch (err) {
    console.error("Error:", err);
  }
}
listServices();
