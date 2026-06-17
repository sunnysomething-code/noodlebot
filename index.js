require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

const cron = require('node-cron');
const net = require('net');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// AI State Path
const AI_STATE_PATH = path.join(__dirname, 'ai_state.json');

// Conversational Memory
const conversationMemory = new Map();

function updateMemory(channelId, role, text, username = null) {
  if (!conversationMemory.has(channelId)) {
    conversationMemory.set(channelId, []);
  }
  const memory = conversationMemory.get(channelId);
  const content = (role === 'user' && username) ? (username + ": " + text) : text;
  memory.push({ role, parts: [{ text: content }] });
  if (memory.length > 50) memory.shift();
}

// CONFIG
const CHANNEL_ID = '1492756482373058650';
const MESSAGE_CHANNEL_ID = '1362246373960847550';
const LOG_CHANNEL_ID = '1485118762196799590';

const MINECRAFT_SERVER_IP = 'noodlebox-sequel.my.pebble.host';
const MC_CHANNELS = {
  STATUS: '1514579570177736874',
  PLAYERS: '1514579403814862859',
  LATENCY: '1514580677809410078'
};

const OWNER_IDS = [
  '871973279924093028',
  '1274565145149837469',
  '917921977816195072'
];

// Helper for AI state
function getAIState() {
  if (!fs.existsSync(AI_STATE_PATH)) {
    return { enabled: false };
  }
  try {
    return JSON.parse(fs.readFileSync(AI_STATE_PATH, 'utf8'));
  } catch (err) {
    return { enabled: false };
  }
}

function setAIState(enabled) {
  fs.writeFileSync(AI_STATE_PATH, JSON.stringify({ enabled }, null, 2));
}

// Calculate current Brisbane day
function getCurrentDay() {
  const now = new Date();

  const brisbaneDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  const today = new Date(brisbaneDate + "T00:00:00+10:00");
  const start = new Date('2026-03-21T00:00:00+10:00');

  return Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
}

// Log commands
async function logCommand(interaction) {
  try {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

    if (!logChannel) return;

    const options = interaction.options.data
      .map(option => {
        if (option.user) return "@" + option.user.username;
        if (option.channel) return "#" + option.channel.name;
        return option.value;
      })
      .join(' ');

    const commandText = ("/" + interaction.commandName + " " + options).trim();

    await logChannel.send(
      "<@" + interaction.user.id + ">\\n" + commandText
    );

  } catch (err) {
    console.error('Command log failed:', err);
  }
}

// Update day channel
async function updateChannel(sendMessage = true) {
  const day = getCurrentDay();

  // Rename voice channel
  const voiceChannel = await client.channels.fetch(CHANNEL_ID);

  if (voiceChannel) {
    await voiceChannel.setName("Day: " + day);
  }

  // Send daily message
  if (sendMessage) {
    const textChannel = await client.channels.fetch(MESSAGE_CHANNEL_ID);

    if (textChannel) {
      await textChannel.send("📅 Today is **Day " + day + "**");
    }
  }

  console.log("Updated to Day: " + day);
}

// Helper to get TCP latency
async function getLatency(host, port = 25565) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection(port, host, () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve(latency);
    });

    socket.setTimeout(5000);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });
  });
}

// Robust fetch for Minecraft API
async function fetchMinecraftData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://api.mcsrvstat.us/2/" + MINECRAFT_SERVER_IP, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("API returned status " + response.status);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('API returned non-JSON response');
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Update Minecraft status
async function updateMinecraftStats() {
  try {
    const data = await fetchMinecraftData();

    const statusChannel = await client.channels.fetch(MC_CHANNELS.STATUS);
    const playersChannel = await client.channels.fetch(MC_CHANNELS.PLAYERS);
    const latencyChannel = await client.channels.fetch(MC_CHANNELS.LATENCY);

    if (data.online) {
      if (statusChannel) await statusChannel.setName("Status: Online");
      if (playersChannel) await playersChannel.setName("Players:  " + data.players.online + " / " + data.players.max);
      
      const port = data.port || 25565;
      const latency = await getLatency(MINECRAFT_SERVER_IP, port);
      const pingDisplay = latency !== null ? (latency + "ms") : 'Online';
      if (latencyChannel) await latencyChannel.setName("Latency: " + pingDisplay);
      
    } else {
      if (statusChannel) await statusChannel.setName('Status: Offline');
      if (playersChannel) await playersChannel.setName('Players:  0 / 0');
      if (latencyChannel) await latencyChannel.setName('Latency: N/A');
    }
    console.log('Minecraft status updated');
  } catch (err) {
    console.error('Failed to update Minecraft stats:', err);
    // On failure, set channels to offline/error state to avoid stale data
    const statusChannel = await client.channels.fetch(MC_CHANNELS.STATUS).catch(() => null);
    if (statusChannel) await statusChannel.setName('Status: Error/Offline').catch(() => null);
  }
}

// Slash commands
const commands = [

  new SlashCommandBuilder()
    .setName('day')
    .setDescription('Show current day'),

  new SlashCommandBuilder()
    .setName('noodlebox')
    .setDescription('Information about the NoodleBox server'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show detailed Minecraft server status'),

  new SlashCommandBuilder()
    .setName('update')
    .setDescription('Force update the day channel and Minecraft status'),

  new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Toggle AI mode (Owner-only)'),

  new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send a message in this channel')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to send')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('sendchannel')
    .setDescription('Send a message in another channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to send')
        .setRequired(true)
    )

].map(command => command.toJSON());

// Bot startup
client.once('clientReady', async () => {
  console.log("Logged in as " + client.user.tag);

  const rest = new REST({ version: '10' })
    .setToken(process.env.TOKEN);

  // Register slash commands
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('Slash commands registered');

  } catch (err) {
    console.error('Command registration failed:', err);
  }

  // Startup updates
  try {
    await updateChannel(false);
    await updateMinecraftStats();

  } catch (err) {
    console.error('Startup update failed:', err);
  }

  // Daily midnight update
  cron.schedule('0 0 * * *', async () => {

    try {
      await updateChannel(true);

    } catch (err) {
      console.error('Daily update failed:', err);
    }

  }, {
    timezone: 'Australia/Brisbane'
  });

  // Minecraft status update every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await updateMinecraftStats();
    } catch (err) {
      console.error('Minecraft cron update failed:', err);
    }
  });
});

// Commands
client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  // Log all commands
  await logCommand(interaction);

  // PUBLIC COMMANDS

  // /day
  if (interaction.commandName === 'day') {

    const day = getCurrentDay();

    return interaction.reply({
      content: "📅 Current day is **Day " + day + "**"
    });
  }

  // /noodlebox
  if (interaction.commandName === 'noodlebox') {

    return interaction.reply({
      content:
"# 🍜 NoodleBox\\n\\nNoodleBox is a modded Minecraft server created as a fun server for friends; with mods from magic to mechanics, with a little something for anyone.\\n\\nThe server, created and currently run by Liam, began more humble, with only a few friends and barely any mods, but grew to be very modded with many players and is currently on Season 3 of its existence.\\n\\nThe current season began on March 21st 2026 running Forge 1.20.1."
    });
  }

  // /status
  if (interaction.commandName === 'status') {

    try {
      await interaction.deferReply();
      
      const data = await fetchMinecraftData();

      if (!data.online) {
        return interaction.editReply({
          content: '🔴 The Minecraft server is currently offline.'
        });
      }

      const port = data.port || 25565;
      const latency = await getLatency(MINECRAFT_SERVER_IP, port);
      const pingDisplay = latency !== null ? (latency + "ms") : 'Online';

      let playerList = '';
      if (data.players.list && data.players.list.length > 0) {
        playerList = "\\n**Players Online:** " + data.players.list.join(', ');
      }

      return interaction.editReply({
        content: 
"## 🟢 NoodleBox Server Status\\n**Status:** Online\\n**Address:** \`" + MINECRAFT_SERVER_IP + "\`\\n**Players:** " + data.players.online + " / " + data.players.max + playerList + "\\n**Latency:** " + pingDisplay + "\\n**Version:** " + data.version
      });

    } catch (err) {
      console.error('Status command failed:', err);
      return interaction.editReply({
        content: 'Failed to retrieve server status (API timeout or error).'
      });
    }
  }

  // OWNER-ONLY COMMANDS

  if (!OWNER_IDS.includes(interaction.user.id)) {

    return interaction.reply({
      content: 'You cannot use this command.',
      ephemeral: true
    });
  }

  // /ai
  if (interaction.commandName === 'ai') {
    const state = getAIState();
    const newState = !state.enabled;
    setAIState(newState);
    return interaction.reply({
      content: "AI mode is now **" + (newState ? 'enabled' : 'disabled') + "**. ",
      ephemeral: true
    });
  }

  // /update
  if (interaction.commandName === 'update') {

    try {
      await interaction.deferReply({ ephemeral: true });
      await updateChannel(false);
      await updateMinecraftStats();

      return interaction.editReply({
        content: 'Bot channels and Minecraft status updated!'
      });

    } catch (err) {

      console.error('Manual update failed:', err);

      return interaction.editReply({
        content: 'Failed to update.'
      });
    }
  }

  // /send
  if (interaction.commandName === 'send') {

    const message = interaction.options.getString('message');

    try {

      await interaction.channel.send(message);

      return interaction.reply({
        content: 'Message sent!',
        ephemeral: true
      });

    } catch (err) {

      console.error('Send failed:', err);

      return interaction.reply({
        content: 'Failed to send message.',
        ephemeral: true
      });
    }
  }

  // /sendchannel
  if (interaction.commandName === 'sendchannel') {

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    try {

      await channel.send(message);

      return interaction.reply({
        content: 'Message sent!',
        ephemeral: true
      });

    } catch (err) {

      console.error('Sendchannel failed:', err);

      return interaction.reply({
        content: 'Failed to send message.',
        ephemeral: true
      });
    }
  }

});

// AI Message Handler
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const state = getAIState();
  if (!state.enabled) return;

  // 1. "Aiden" Vomit Rule
  if (message.content.toLowerCase().includes('aiden')) {
    return message.reply('🤢');
  }

  const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
  
  let isReplyToBot = false;
  if (message.reference) {
    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      isReplyToBot = repliedMessage.author.id === client.user.id;
    } catch (err) {
      console.error('Failed to fetch replied message:', err);
    }
  }

  if (isMentioned || isReplyToBot) {
    try {
      await message.channel.sendTyping();

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return message.reply("gemini api key is not configured");
      }

      const userPrompt = message.content
        .replace("<@!" + client.user.id + ">", '')
        .replace("<@" + client.user.id + ">", '')
        .trim() || "hello";

      // 2. System Prompt Overhaul
      const systemInstruction = "You are NoodleBot, a Discord bot for the NoodleBox Minecraft server created by Lewis. The server has nothing to do with food or noodles (it was set up by Liam for a group of friends, we are on Season 3 on a modded Forge 1.20.1 server). You are a lazy friend. You must ALWAYS use lowercase only, no punctuation (no periods, no commas, no exclamation marks), and keep your responses very short. Use texting slang like hru, fr, smh, etc. If someone swears at you, you are allowed to swear back and give them attitude.";

      // 3. Conversational Memory
      updateMemory(message.channel.id, 'user', userPrompt, message.member?.displayName || message.author.username);
      const history = conversationMemory.get(message.channel.id);

      // Helper for sleep/delay
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      let attempts = 0;
      const maxRetries = 3;
      let delay = 1000;
      let response;
      let data;

      while (attempts <= maxRetries) {
        try {
          response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemInstruction }] },
              contents: history
            })
          });

          data = await response.json();

          if (response.status === 503 && attempts < maxRetries) {
            console.warn("Gemini API 503 error. Retrying in " + delay + "ms... (Attempt " + (attempts + 1) + ")");
            attempts++;
            await sleep(delay);
            delay *= 2;
            continue;
          }
          break;
        } catch (fetchErr) {
          if (attempts < maxRetries) {
            console.error("Fetch error: " + fetchErr.message + ". Retrying in " + delay + "ms...");
            attempts++;
            await sleep(delay);
            delay *= 2;
            continue;
          }
          throw fetchErr;
        }
      }

      if (!data || !data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
        console.error("Gemini API Error or Block:", JSON.stringify(data));
        return message.reply("srry having trouble thinking rn");
      }
      
      const aiText = data.candidates[0].content.parts[0].text;
      
      // Update memory with bot response
      updateMemory(message.channel.id, 'model', aiText);

      if (aiText.length > 2000) {
        const chunks = aiText.match(/[\\s\\S]{1,2000}/g);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
        return;
      }

      return message.reply(aiText);

    } catch (err) {
      console.error('Gemini API error:', err);
      return message.reply("srry error processing that");
    }
  }
});

// Login
client.login(process.env.TOKEN);
