import { WarlockClient } from '../api/warlockClient';
import { ChartGenerator } from './charts';

export interface ServiceInstance {
  guid: string;
  host: string;
  service: string;
  name: string;
}

export class StatusPoller {
  private history: Record<string, { time: string, count: number }[]> = {};
  private failures: Record<string, number> = {};
  private lastStatus: Record<string, string> = {};
  private lastPlayerCount: Record<string, number> = {};
  private overrideStatus: Record<string, string | null> = {};
  public client: WarlockClient;
  
  // Cache of all discovered services (gameName -> identifiers)
  private serviceCache: Record<string, ServiceInstance> = {};

  constructor(private postEmbedCallback: (gameName: string, embedPayload: any) => Promise<void>) {
    this.client = new WarlockClient();
  }

  public setOverrideStatus(gameName: string, status: string | null) {
    this.overrideStatus[gameName] = status;
    this.lastStatus[gameName] = ''; 
  }

  public getServiceByName(name: string): ServiceInstance | undefined {
    if (!name) return undefined;
    const lowerName = name.toLowerCase();
    
    if (this.serviceCache[lowerName]) {
      return this.serviceCache[lowerName];
    }
    
    // Fuzzy search
    for (const key of Object.keys(this.serviceCache)) {
      if (key.includes(lowerName)) {
        return this.serviceCache[key];
      }
      
      const svc = this.serviceCache[key];
      if (svc && svc.name && svc.name.toLowerCase().includes(lowerName)) {
        return svc;
      }
    }
    
    return undefined;
  }

  public async pollAllServices(intervalMs: number = 30000) {
    try {
      // console.log(`[StatusPoller] Fetching all services from Warlock API...`);
      const response = await this.client.getAllServices();
      
      if (!response || !response.success || !Array.isArray(response.services)) {
        throw new Error('Failed to fetch services or invalid response format.');
      }

      for (const serviceObj of response.services) {
        const gameName = serviceObj.service.toLowerCase();
        
        // Cache the identifiers for command handling
        this.serviceCache[gameName] = {
          guid: serviceObj.guid,
          host: serviceObj.host,
          service: serviceObj.service,
          name: gameName
        };

        await this.processServiceStatus(gameName, serviceObj);
      }

    } catch (err: any) {
      console.error('[StatusPoller] Error fetching services from Warlock API:', err.message);
    } finally {
      setTimeout(() => {
        this.pollAllServices(intervalMs);
      }, intervalMs);
    }
  }

  private async processServiceStatus(gameName: string, serviceData: any) {
    try {
      let metrics: any = {};
      try {
        metrics = await this.client.getServiceDetails(serviceData.guid, serviceData.host, serviceData.service);
      } catch (err: any) {
        console.error(`[StatusPoller] Failed to get metrics for ${gameName}:`, err.message);
      }
      
      // The API often returns the metrics directly or nested in .service
      const details = metrics.service ? metrics.service : metrics;

      let status = details.status || 'UNKNOWN';
      let isRecovering = false;
      const prevFailures = this.failures[gameName] || 0;
      
      if (prevFailures > 0) {
        isRecovering = true;
        console.log(`[StatusPoller] Connection to Warlock restored for ${gameName}.`);
      }
      this.failures[gameName] = 0; // Reset failures

      if (this.overrideStatus[gameName]) {
        status = this.overrideStatus[gameName]!;
      }

      let playerCount = 0;
      if (status === 'running' || status === 'ONLINE') {
        if (details.player_count !== undefined) {
          playerCount = details.player_count;
        } else if (details.players && Array.isArray(details.players)) {
          playerCount = details.players.length;
        }
      }

      if (!this.history[gameName]) {
        this.history[gameName] = [];
      }
      const now = new Date();
      const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      const hist = this.history[gameName];
      if (hist) {
        hist.push({ time: timeStr, count: playerCount });
      }
      
      if (hist && hist.length > 15) {
        hist.shift();
      }

      const justFailed = prevFailures === 1;
      
      let showGraph = false;
      try {
        const stateFile = require('path').join(__dirname, '..', '..', 'data', 'graphState.json');
        if (require('fs').existsSync(stateFile)) {
          const state = JSON.parse(require('fs').readFileSync(stateFile, 'utf8'));
          if (state.showGlobalGraph === true) {
            showGraph = true;
          }
        } else {
          // Default to reading from warlock config if global state isn't set
          const configs = await this.client.getServiceConfigs(serviceData.guid, serviceData.host, serviceData.service);
          const graphConfig = configs.configs?.find((c: any) => c.option === 'Show Graph' || c.option === 'ShowGraph');
          if (graphConfig && (graphConfig.value === 'true' || graphConfig.value === 'yes' || graphConfig.value === '1' || graphConfig.value === 'on')) {
            showGraph = true;
          }
        }
      } catch (err) {
        // Ignore errors fetching config
      }

      let chartUrl: string | undefined = undefined;
      if (showGraph) {
        const labels = (hist || []).map(h => h.time);
        const dataPoints = (hist || []).map(h => h.count);
        chartUrl = ChartGenerator.generatePlayerChart(labels, dataPoints, serviceData.name || gameName);
      }

      let titleStr = `🎮 ${(serviceData.name || gameName).toUpperCase()} Server Status`;
      if (justFailed) titleStr += ` [API DISCONNECTED]`;
      if (isRecovering) titleStr += ` [API RESTORED]`;

      let descriptionText = `**Status:** ${status === 'running' || status === 'ONLINE' ? '🟢 Online' : (status === 'OFFLINE' ? '🔴 Offline' : `🟡 ${status}`)}\n`;

      if (status === 'running' || status === 'ONLINE') {
         const ipPort = serviceData.ip ? `${serviceData.ip}:${serviceData.port || ''}` : 'Unknown';
         const players = details.player_count !== undefined ? `${details.player_count}/${serviceData.max_players || '?'}` : '0';
         const memory = details.memory_usage ? (details.memory_usage > 1024 ? `${(details.memory_usage / 1024).toFixed(2)} GB` : `${details.memory_usage} MB`) : 'N/A';
         const cpu = details.cpu_usage !== undefined ? `${details.cpu_usage}%` : 'N/A';
         const responseTime = details.response_time || 'N/A';

         descriptionText += `\n**🔌 Connect:** \`${ipPort}\``;
         descriptionText += `\n**👥 Players:** \`${players}\`  |  **⏱️ Ping:** \`${responseTime}\``;
         descriptionText += `\n**🧠 RAM:** \`${memory}\`  |  **⚙️ CPU:** \`${cpu}\``;
      }
      
      let embedColor = status === 'ONLINE' || status === 'running' ? 0x57F287 : 0xED4245;
      const themeColor = process.env.THEME_COLOR || process.env.EMBED_COLOR;
      if (themeColor) {
        embedColor = parseInt(themeColor.replace('#', ''), 16) || embedColor;
      }

      const embedPayload = {
        embeds: [{
          title: titleStr,
          description: descriptionText,
          color: embedColor,
          image: chartUrl ? { url: chartUrl } : undefined,
          footer: { text: 'Warlock Monitor' },
          timestamp: new Date().toISOString()
        }]
      };

      await this.postEmbedCallback(gameName, embedPayload);

    } catch (err) {
      console.error(`[StatusPoller] Error processing status for ${gameName}:`, err);
    }
  }

  public startPolling(intervalMs: number = 30000) {
    this.pollAllServices(intervalMs);
  }
}
