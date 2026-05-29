import fetch from 'node-fetch';
import makeFetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import * as speakeasy from 'speakeasy';

export class WarlockClient {
  private baseUrl: string;
  private jar: CookieJar;
  private fetchWithCookies: any;
  private isAuthenticated: boolean = false;

  constructor() {
    this.baseUrl = process.env.WARLOCK_API_URL || 'http://127.0.0.1:8080';
    this.jar = new CookieJar();
    // Wrap global fetch to automatically handle Set-Cookie and Cookie headers
    this.fetchWithCookies = makeFetchCookie(fetch as unknown as any, this.jar);
  }

  public async authenticate() {
    const username = (process.env.WARLOCK_USERNAME || '').trim();
    const password = (process.env.WARLOCK_PASSWORD || '').trim();
    const secret = (process.env.WARLOCK_2FA_SECRET || '').trim();

    if (!username || !password) {
      throw new Error('WARLOCK_USERNAME or WARLOCK_PASSWORD is not set.');
    }

    console.log('[WarlockClient] Fetching login page to grab CSRF token...');
    let getRes;
    try {
      getRes = await this.fetchWithCookies(`${this.baseUrl}/login`, { method: 'GET' });
    } catch (err: any) {
      console.error('[WarlockClient] Network error during GET /login:', err);
      throw err;
    }
    const html = await getRes.text();
    
    const $ = cheerio.load(html);
    const csrfToken = $('input[name="_csrf"]').val() as string;

    if (!csrfToken) {
      throw new Error('Could not extract CSRF token from login page.');
    }

    let authcode = '';
    if (secret) {
      authcode = speakeasy.totp({
        secret: secret,
        encoding: 'base32'
      });
    }

    console.log('[WarlockClient] Submitting login form...');
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    if (authcode) params.append('authcode', authcode);
    params.append('_csrf', csrfToken);

    const postRes = await this.fetchWithCookies(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString(),
      redirect: 'manual'
    });

    console.log(`[WarlockClient] Login response: ${postRes.status} Location: ${postRes.headers.get('location')} URL: ${postRes.url}`);

    const loc = postRes.headers.get('location') || '';
    if (postRes.status === 302 && !loc.includes('/login')) {
      console.log('[WarlockClient] Authentication successful. Redirected to:', loc);
      this.isAuthenticated = true;
    } else {
      if (postRes.url.includes('/dashboard') || postRes.url.includes('/2fa-setup') || postRes.url === this.baseUrl + '/') {
         console.log('[WarlockClient] Authentication successful.');
         this.isAuthenticated = true;
      } else {
         console.log('[WarlockClient] Authentication failed.');
         this.isAuthenticated = false;
         throw new Error('Authentication failed (invalid credentials or 2FA).');
      }
    }
  }

  private async ensureAuthenticated() {
    if (!this.isAuthenticated) {
      await this.authenticate();
    }
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  private async request(url: string, options: any) {
    await this.ensureAuthenticated();
    let res = await this.fetchWithCookies(url, options);

    // Detect session expiration and redirect to login
    if (res.url.includes('/login') || res.status === 401 || res.status === 403) {
      console.log('[WarlockClient] Session expired or unauthorized. Re-authenticating...');
      this.isAuthenticated = false;
      await this.authenticate();
      res = await this.fetchWithCookies(url, options); // Retry once
    }

    if (!res.ok && !res.url.includes('/login')) {
      throw new Error(`Failed request to ${url}: ${res.status} ${res.statusText}`);
    }
    return res;
  }

  public async controlService(guid: string, host: string, service: string, action: string) {
    const url = `${this.baseUrl}/api/service/control/${guid}/${host}/${service}`;
    const res = await this.request(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ action })
    });
    return await res.json();
  }

  public async customCommand(guid: string, host: string, service: string, command: string) {
    const url = `${this.baseUrl}/api/service/cmd/${guid}/${host}/${service}`;
    const res = await this.request(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ command })
    });
    return await res.text();
  }

  public async getServiceDetails(guid: string, host: string, service: string) {
    const url = `${this.baseUrl}/api/service/${guid}/${host}/${service}`;
    const res = await this.request(url, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  public async getServiceConfigs(guid: string, host: string, service: string) {
    const url = `${this.baseUrl}/api/service/configs/${guid}/${host}/${service}`;
    const res = await this.request(url, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  public async getAllServices() {
    const url = `${this.baseUrl}/api/services`;
    const res = await this.request(url, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return await res.json();
  }
}
