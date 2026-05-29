import fetch from 'node-fetch';

export class VeinClient {
  private ip: string;
  private port: number;

  constructor(ip: string, port: number = 4726) {
    this.ip = ip;
    this.port = port;
  }

  private async request(endpoint: string) {
    const url = `http://${this.ip}:${this.port}${endpoint}`;
    try {
      const res = await fetch(url, { method: 'GET', timeout: 5000 });
      if (!res.ok) {
        throw new Error(`VEIN API Error: ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      return text ? JSON.parse(text) : { success: true };
    } catch (err: any) {
      throw new Error(`VEIN connection failed: ${err.message}`);
    }
  }

  async execute(command: string, args: string) {
    switch (command) {
      case 'status': return this.request('/status');
      case 'players': return this.request(args ? `/players/${args.trim()}` : '/players');
      case 'characters': return this.request(args ? `/characters/${args.trim()}` : '/characters');
      case 'time': return this.request('/time');
      case 'weather': return this.request('/weather');
      default:
        throw new Error(`Unknown VEIN command: ${command}`);
    }
  }
}
