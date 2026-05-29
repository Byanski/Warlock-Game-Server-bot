export class PalworldClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(ip: string, port: number, adminPassword: string) {
    this.baseUrl = `http://${ip}:${port}/v1/api`;
    const token = Buffer.from(`admin:${adminPassword}`).toString('base64');
    this.authHeader = `Basic ${token}`;
  }

  private async request(endpoint: string, method: string = 'POST', body?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`Palworld REST API Error: ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      return text ? JSON.parse(text) : { success: true };
    } catch (err: any) {
      throw new Error(`Failed to contact Palworld REST API: ${err.message}`);
    }
  }

  public async info() {
    return this.request('/info', 'GET');
  }

  public async metrics() {
    return this.request('/metrics', 'GET');
  }

  public async settings() {
    return this.request('/settings', 'GET');
  }

  public async announce(message: string) {
    return this.request('/announce', 'POST', { message });
  }

  public async kick(userid: string, message?: string) {
    return this.request('/kick', 'POST', { userid, message });
  }

  public async ban(userid: string, message?: string) {
    return this.request('/ban', 'POST', { userid, message });
  }

  public async unban(userid: string) {
    return this.request('/unban', 'POST', { userid });
  }

  public async save() {
    return this.request('/save', 'POST');
  }

  public async shutdown(waittime: number = 60, message?: string) {
    return this.request('/shutdown', 'POST', { waittime, message });
  }

  public async forceStop() {
    return this.request('/force_stop', 'POST');
  }

  public async getPlayers() {
    return this.request('/players', 'GET');
  }
}
