import { WarlockClient } from '../api/warlockClient';
import { ChartGenerator } from './charts';

export class StatusPoller {
  private history: Record<string, { time: string, count: number }[]> = {};
  private failures: Record<string, number> = {};
  private lastStatus: Record<string, string> = {};
  private lastPlayerCount: Record<string, number> = {};
  private client: WarlockClient;

  constructor(private postEmbedCallback: (channelId: string, embedPayload: any) => Promise<void>) {
    this.client = new WarlockClient();
  }

  private scheduleNextPoll(gameName: string, guid: string, serviceName: string, targetChannelId: string, baseIntervalMs: number) {
    let interval = baseIntervalMs;
    const failCount = this.failures[gameName] || 0;
    
    if (failCount > 0) {
      // Exponential backoff: base * 2^failures, capped at 1 hour (3600000 ms)
      interval = Math.min(baseIntervalMs * Math.pow(2, failCount - 1), 3600000);
      console.log(`[StatusPoller] API Unreachable. Backing off for ${gameName}. Next poll in ${interval / 1000}s`);
    }

    setTimeout(() => {
      this.pollAndBroadcast(gameName, guid, serviceName, targetChannelId, baseIntervalMs);
    }, interval);
  }

  public async pollAndBroadcast(gameName: string, guid: string, serviceName: string, targetChannelId: string, baseIntervalMs: number) {
    try {
      console.log(`[StatusPoller] Polling status for ${gameName}...`);
      
      const hostId = process.env.WARLOCK_TARGET_HOST || 'local';
      
      let stdout = '';
      let status = 'UNKNOWN';
      let isRecovering = false;

      try {
        const details = await this.client.getServiceDetails(guid, hostId, serviceName);
        
        if (details.service) {
          status = details.service.status || 'ONLINE';
          stdout = JSON.stringify(details.service, null, 2);
        } else {
          status = details.status || 'ONLINE';
          stdout = JSON.stringify(details, null, 2);
        }
        
        const prevFailures = this.failures[gameName] || 0;
        if (prevFailures > 0) {
          isRecovering = true;
          console.log(`[StatusPoller] Connection to Warlock restored for ${gameName}.`);
        }
        this.failures[gameName] = 0; // Reset failures

      } catch (err: any) {
        console.error('[StatusPoller] Caught error for', gameName, ':', err.message, err.stack);
        status = 'OFFLINE';
        stdout = `Error: ${err.message}`;
        this.failures[gameName] = (this.failures[gameName] || 0) + 1;
      }

      const failCount = this.failures[gameName] || 0;

      // Build data for charts
      let playerCount = 0;
      if (status === 'running' || status === 'ONLINE') {
        const parsedDetails = JSON.parse(stdout);
        if (parsedDetails.player_count !== undefined) {
          playerCount = parsedDetails.player_count;
        } else {
          const playerMatch = stdout.match(/"players":\s*(\d+)/i);
          if (playerMatch && playerMatch[1]) {
            playerCount = parseInt(playerMatch[1], 10);
          }
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

      // Determine if we should broadcast
      const justFailed = failCount === 1;
      const isOffline = failCount > 0;
      
      const statusChanged = this.lastStatus[gameName] !== status;
      const playersChanged = this.lastPlayerCount[gameName] !== playerCount;
      
      this.lastStatus[gameName] = status;
      this.lastPlayerCount[gameName] = playerCount;

      if (isOffline && !justFailed) {
        console.log(`[StatusPoller] Suppressing offline broadcast for ${gameName} to prevent channel spam.`);
      } else if (!statusChanged && !playersChanged) {
        console.log(`[StatusPoller] No changes for ${gameName}. Skipping broadcast to prevent spam.`);
      } else {
        const labels = (hist || []).map(h => h.time);
        const dataPoints = (hist || []).map(h => h.count);
        const chartUrl = ChartGenerator.generatePlayerChart(labels, dataPoints, gameName);

        let titleStr = `🎮 ${gameName.toUpperCase()} Server Status`;
        if (justFailed) titleStr += ` [API DISCONNECTED]`;
        if (isRecovering) titleStr += ` [API RESTORED]`;

        const embedPayload = {
          embeds: [{
            title: titleStr,
            description: `**Status:** ${status}\n**Metrics:**\n\`\`\`json\n${stdout.substring(0, 1000)}\n\`\`\``,
            color: status === 'ONLINE' || status === 'running' ? 0x57F287 : 0xED4245,
            image: { url: chartUrl },
            footer: { text: 'Warlock Monitor' },
            timestamp: new Date().toISOString()
          }]
        };

        await this.postEmbedCallback(targetChannelId, embedPayload);
      }

    } catch (err) {
      console.error(`[StatusPoller] Critical failure in poll loop for ${gameName}:`, err);
    } finally {
      // Always schedule the next poll
      this.scheduleNextPoll(gameName, guid, serviceName, targetChannelId, baseIntervalMs);
    }
  }

  public startPolling(gameName: string, guid: string, serviceName: string, targetChannelId: string, intervalMs: number = 60000) {
    // Kick off the first poll
    this.pollAndBroadcast(gameName, guid, serviceName, targetChannelId, intervalMs);
  }
}
