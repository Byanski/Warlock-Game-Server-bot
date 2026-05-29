import { Rcon } from 'rcon-client';

export class GenericRconClient {
  private rconParams: any;

  constructor(ip: string, port: number, password: string) {
    this.rconParams = {
      host: ip,
      port: port,
      password: password,
      timeout: 5000
    };
  }

  public async executeCommand(command: string): Promise<string> {
    let rcon: Rcon | null = null;
    try {
      rcon = await Rcon.connect(this.rconParams);
      const response = await rcon.send(command);
      return response || 'Command executed successfully (no output).';
    } catch (err: any) {
      throw new Error(`RCON connection failed: ${err.message}`);
    } finally {
      if (rcon) {
        rcon.end();
      }
    }
  }
}
