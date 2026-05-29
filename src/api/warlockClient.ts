
export class WarlockClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = process.env.WARLOCK_API_URL || 'http://127.0.0.1:8080';
    this.token = process.env.WARLOCK_API_TOKEN || '';
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Sends a control command (start/stop/enable/disable)
   */
  public async controlService(guid: string, host: string, service: string, action: string) {
    const url = `${this.baseUrl}/api/service/control/${guid}/${host}/${service}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ action })
    });

    if (!res.ok) {
      throw new Error(`Failed to control service: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  }

  /**
   * Sends a custom command to the service
   */
  public async customCommand(guid: string, host: string, service: string, command: string) {
    const url = `${this.baseUrl}/api/service/cmd/${guid}/${host}/${service}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ command })
    });

    if (!res.ok) {
      throw new Error(`Failed to run custom command: ${res.status} ${res.statusText}`);
    }
    return await res.text();
  }

  /**
   * Fetches service details (which includes status)
   */
  public async getServiceDetails(guid: string, host: string, service: string) {
    const url = `${this.baseUrl}/api/service/${guid}/${host}/${service}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch service details: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  }
}
