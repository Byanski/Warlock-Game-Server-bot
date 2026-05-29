# Warlock Game Server Bot (Fluxer Edition)

This is a production-grade tracking and management bot designed for [Fluxer](https://docs.fluxer.app/), integrating directly with the [Warlock Game Server Manager](https://github.com/BitsNBytes25/Warlock).

Instead of running local subprocesses, this bot communicates directly with Warlock's REST API. It offers dynamic command mapping, secure REST execution, and rich time-series metric charting for Discord/Fluxer interfaces.

## Features

- **REST API Integration:** Natively interfaces with Warlock's built-in API.
- **Dynamic Configuration Schema:** Manage supported games, commands, and regex validations without touching code via `game_commands.json`.
- **Live Status Polling:** Generates beautiful dark-mode charts of game server player metrics using `quickchart-js`.
- **Docker Ready:** Built to run on any Linux host flawlessly without dependency headaches.

## Configuration

Copy the environment template to begin:

```bash
cp .env.example .env
```

Edit your `.env` file to include your Fluxer Bot token, your Warlock API credentials, and the target status channel ID:

```env
FLUXER_TOKEN=your_bot_token_here
STATUS_CHANNEL_ID=1234567890

WARLOCK_API_URL=http://192.168.1.50:8080
WARLOCK_API_TOKEN=your_auth_token_here
WARLOCK_TARGET_HOST=local
```

## Running the Bot

### Using Docker (Recommended)

The easiest way to run the bot is via Docker Compose. This ensures all dependencies are containerized.

```bash
docker-compose up -d --build
```

You can view the logs with:
```bash
docker-compose logs -f
```

*Note: The `game_commands.json` file is mounted as a volume. You can update the command definitions and they will be reflected without needing to rebuild the container.*

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
