const mineflayer = require('mineflayer');
const axios = require('axios');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const serverHost = config.server.host;
const serverPort = config.server.port;
const botUsername = config.bot.username;
const botPassword = config.bot.password;
const discordWebhookURL = config.discord.webhookUrl;
const minecraftVersion = config.minecraftVersion;
const keepAliveInterval = 5 * 60 * 1000;

console.log(`Connecting to server ${serverHost}:${serverPort} as ${botUsername}...`);

let bot = mineflayer.createBot({
  host: serverHost,
  port: serverPort,
  username: botUsername,
  version: minecraftVersion,
  offline: true,
  auth: 'offline',
});

bot.once('spawn', () => {
  console.log(`${bot.username} has successfully connected to the server.`);
  
  // Wait 5 seconds after spawn before sending the /login command
  setTimeout(() => {
    console.log('Sending /login command...');
    bot.chat(`/login ${botPassword}`);
    
    // After login, wait for 2 more seconds and make the bot walk 14 blocks forward
    setTimeout(() => {
      console.log('Walking 14 blocks forward...');
      walk14Blocks();
    }, 2000);  // Wait 2 seconds after login command
  }, 5000);  // 5 seconds delay after spawn

  setInterval(sendKeepAlive, keepAliveInterval);
  logPlayers();
  monitorPlayers();
});

bot.on('chat', (username, message) => {
  if (username === bot.username) return;

  console.log(`Chat message from ${username}: ${message}`);

  if (message.includes('Please verify') || message.includes('wait for verification')) {
    console.log('Server requires verification, login command might not be enough.');
  }
});

bot.on('error', (err) => {
  console.error('Error while connecting:', err);
});

function walk14Blocks() {
  let blocksToWalk = 14;

  const interval = setInterval(() => {
    if (blocksToWalk <= 0) {
      console.log('Walked 14 blocks. Stopping.');
      clearInterval(interval);
      return;
    }

    bot.setControlState('forward', true);  // Make the bot walk forward
    blocksToWalk--;

    setTimeout(() => {
      bot.setControlState('forward', false);  // Stop the bot after each block
    }, 1000);  // Walk for 1 second per block (roughly)

  }, 1000);  // Interval to check walking every second
}

function logPlayers() {
  console.log('Current players on the server:');
  Object.values(bot.players).forEach(player => {
    console.log(player.username);
  });
}

function monitorPlayers() {
  const trackedPlayers = new Set();

  setInterval(() => {
    const currentPlayers = new Set();
    Object.values(bot.players).forEach(player => {
      currentPlayers.add(player.username);
    });
    console.log('Current players:', currentPlayers);

    currentPlayers.forEach(player => {
      if (!trackedPlayers.has(player)) {
        console.log(`${player} has joined the server.`);
        sendToDiscord(`${player} has joined the server.`);
      }
    });

    trackedPlayers.forEach(player => {
      if (!currentPlayers.has(player)) {
        console.log(`${player} has left the server.`);
        sendToDiscord(`${player} has left the server.`);
      }
    });

    trackedPlayers.clear();
    currentPlayers.forEach(player => trackedPlayers.add(player));

  }, 5000);
}

async function sendToDiscord(message) {
  try {
    const payload = { content: message };
    const response = await axios.post(discordWebhookURL, payload);
    if (response.status === 204) {
      console.log('Message sent to Discord successfully.');
    } else {
      console.error('Failed to send message to Discord:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending message to Discord:', error);
  }
}

function sendKeepAlive() {
  try {
    console.log('Sending keep-alive ping...');
    bot.chat('ping');
  } catch (error) {
    console.error('Error sending keep-alive message:', error);
  }
}

bot.on('playerJoined', (player) => {
  console.log(`${player.username} has joined the server.`);
  sendToDiscord(`${player.username} has joined the server.`);
});

bot.on('playerLeft', (player) => {
  console.log(`${player.username} has left the server.`);
  sendToDiscord(`${player.username} has left the server.`);
});

bot.on('end', () => {
  console.log(`${bot.username} has disconnected.`);
  reconnectBot();
});

function reconnectBot() {
  console.log('Attempting to reconnect...');
  setTimeout(() => {
    bot = mineflayer.createBot({
      host: serverHost,
      port: serverPort,
      username: botUsername,
      version: minecraftVersion,
      offline: true,
      auth: 'offline',
    });
  }, 7500);
}
