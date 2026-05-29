# Warlock Game Server Bot

This is a production-grade tracking and management bot designed for **Discord** and **Fluxer**, integrating directly with the [Warlock Game Server Manager](https://github.com/BitsNBytes25/Warlock).

Instead of running local subprocesses, this bot communicates directly with Warlock's REST API. It offers dynamic command mapping, secure REST execution, and rich time-series metric charting for Discord and Fluxer interfaces.

## Features

- **Dual Platform Support:** Natively interfaces with both Discord and Fluxer simultaneously.
- **Persistent Live Dashboard:** Generates beautiful dark-mode charts of game server metrics using `quickchart-js`. The dashboard updates live every 30 seconds by editing a single persistent message, preventing channel spam. 
- **Auto-Recovery:** If the dashboard message is ever accidentally deleted, the bot will automatically regenerate it on its next polling cycle.
- **Dynamic Command Feedback:** Emits temporary status messages during admin operations (e.g. "Server is starting...") that automatically update and clean themselves up.
- **Dynamic Configuration Schema:** Manage supported games, commands, and regex validations without touching code via `game_commands.json`.
- **Docker Ready:** Built to run on any host flawlessly without dependency headaches. State is maintained across restarts via a mapped volume.

## Configuration

Copy the environment template to begin:

```bash
cp .env.example .env
```

Edit your `.env` file to include your API credentials. You can enable Discord, Fluxer, or both by providing the respective tokens:

```env
# Warlock API Settings
WARLOCK_API_URL=http://192.168.1.50:8080
WARLOCK_API_TOKEN=your_auth_token_here
WARLOCK_TARGET_HOST=local

# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_STATUS_CHANNEL_ID=your_discord_channel_id_here
DISCORD_ADMIN_ROLE_ID=your_discord_admin_role_id_here

# Fluxer Bot Configuration
FLUXER_TOKEN=your_bot_token_here
STATUS_CHANNEL_ID=your_fluxer_channel_id_here
ADMIN_ROLE_ID=your_fluxer_admin_role_id_here
```

## Running the Bot

### Using Docker (Recommended)

The easiest way to run the bot is via Docker Compose. This ensures all dependencies are containerized and persistent state is managed properly.

```bash
docker-compose up -d --build
```

You can view the logs with:
```bash
docker-compose logs -f
```

*Note: The `game_commands.json` file and the `data/` folder are mounted as volumes. Your live dashboard will survive container rebuilds!*

### Running Locally (Node.js)

If you prefer to run it manually using Node.js 18+:

```bash
# Install dependencies
npm install

# Build the TypeScript project
npm run build

# Start the bot
npm start
```

## Commands

Authorized administrators can control game servers directly from chat using the syntax:
`!w <game_name> <command> [arguments]`

Examples:
- `!w windrose start`
- `!w windrose stop`
- `!w windrose kick SomePlayer`

## Adding Game Commands

To add new games or modify existing commands, edit `game_commands.json`. 

Each game needs its `guid` (found in the Warlock `Apps.yaml`) and `service_name`. Commands can either be of type `control` (to invoke start/stop APIs) or `custom` (to send console commands). 

Example structure:
```json
"windrose": {
  "guid": "b5453ff4-e65e-3975-a9db-3ec4c12cb911",
  "service_name": "windrose",
  "commands": {
    "start": {
      "description": "Start the windrose server",
      "requires_args": false,
      "type": "control",
      "action": "start"
    },
    "kick": {
      "description": "Kick a player",
      "requires_args": true,
      "args_regex": "^[a-zA-Z0-9_]{3,16}$",
      "type": "custom",
      "command": "kick {args}"
    }
  }
}
```
