require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const cron = require('node-cron');
const net = require('net');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// CONFIG – updated channel IDs (no AI, no latency)
const CHANNEL_ID = '1531589371130810409'; // Day voice channel
const MESSAGE_CHANNEL_ID = '1362246373960847550';
const LOG_CHANNEL_ID = '1485118762196799590';
const MINECRAFT_SERVER_IP = 'noodlebox-sequel.my.pebble.host';
const MC_CHANNELS = {
  STATUS: '1531589294899331082',
  PLAYERS: '1531589332446478426'
  // LATENCY channel removed per request
};
const OWNER_IDS = ['871973279924093028', '1274565145149837469', '917921977816195072', '367796500182597643'];

// Calculate current Brisbane day
function getCurrentDay() {
  const now = new Date();
  const brisbaneDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const today = new Date(brisbaneDate + 'T00:00:00+10:00');
  const start = new Date('2026-03-21T00:00:00+10:00');
  return Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
}

// Log commands async function logCommand(interaction) {
  try {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!logChannel) return;
    const options = interaction.options.data
      .map(option => {
        if (option.user) return '@' + option.user.username;
        if (option.channel) return '#' + option.channel.name;
        return option.value;
      })
      .join(' ');
    const commandText = '/' + interaction.commandName + ' ' + options;
    await logChannel.send('\n' + commandText.trim());
  } catch (err) {
    console.error('Command log failed:', err);
  }
}

// Update day channel async function updateChannel(sendMessage = true) {
  const day = getCurrentDay();
  const voiceChannel = await client.channels.fetch(CHANNEL_ID);
  if (voiceChannel) await voiceChannel.setName('Day: ' + day);
  if (sendMessage) {
    const textChannel = await client.channels.fetch(MESSAGE_CHANNEL_ID);
    if (textChannel) await textChannel.send('📅 Today is **Day ' + day + '**');
  }
  console.log('Updated to Day:', day);
}

// Helper to get TCP latency async function getLatency(host, port = 25565) {
  return new Promise(resolve => {
    const start = Date.now();
    const socket = net.createConnection(port, host, () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve(latency);
    });
    socket.setTimeout(5000);
    socket.on('timeout', () => { socket.destroy(); resolve(null); });
    socket.on('error', () => { socket.destroy(); resolve(null); });
  });
}

// Robust fetch for Minecraft API async function fetchMinecraftData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.mcsrvstat.us/2/' + MINECRAFT_SERVER_IP, { signal: controller.signal });
    if (!response.ok) throw new Error('API returned status ' + response.status);
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) throw new Error('API returned non-JSON response');
    return await response.json();
  } finally { clearTimeout(timeoutId); }
}

// Update Minecraft status async function updateMinecraftStats() {
  try {
    const data = await fetchMinecraftData();
    const statusChannel = await client.channels.fetch(MC_CHANNELS.STATUS);
    const playersChannel = await client.channels.fetch(MC_CHANNELS.PLAYERS);
    if (data.online) {
      if (statusChannel) await statusChannel.setName('Status: Online');
      if (playersChannel) await playersChannel.setName('Players: ' + data.players.online + ' / ' + data.players.max);
    } else {
      if (statusChannel) await statusChannel.setName('Status: Offline');
      if (playersChannel) await playersChannel.setName('Players: 0 / 0');
    }
    console.log('Minecraft status updated');
  } catch (err) {
    console.error('Failed to update Minecraft stats:', err);
    const statusChannel = await client.channels.fetch(MC_CHANNELS.STATUS).catch(() => null);
    if (statusChannel) await statusChannel.setName('Status: Error/Offline').catch(() => null);
  }
}

// Slash commands definition
const commands = [
  new SlashCommandBuilder().setName('day').setDescription('Show current day'),
  new SlashCommandBuilder().setName('noodlebox').setDescription('Information about the NoodleBox server'),
  new SlashCommandBuilder().setName('status').setDescription('Show detailed Minecraft server status'),
  new SlashCommandBuilder().setName('update').setDescription('Force update the day channel and Minecraft status'),
  // AI command removed per request
  new SlashCommandBuilder().setName('send').setDescription('Send a message in this channel').addStringOption(option => option.setName('message').setDescription('Message to send').setRequired(true)),
  new SlashCommandBuilder().setName('sendchannel').setDescription('Send a message in another channel').addChannelOption(option => option.setName('channel').setDescription('Channel to send to').setRequired(true)).addStringOption(option => option.setName('message').setDescription('Message to send').setRequired(true))
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log('Logged in as ' + client.user.tag);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); console.log('Slash commands registered'); } catch (err) { console.error('Command registration failed:', err); }
  try { await updateChannel(false); await updateMinecraftStats(); } catch (err) { console.error('Startup update failed:', err); }
  cron.schedule('0 0 * * *', async () => { try { await updateChannel(true); } catch (err) { console.error('Daily update failed:', err); } }, { timezone: 'Australia/Brisbane' });
  cron.schedule('*/5 * * * *', async () => { try { await updateMinecraftStats(); } catch (err) { console.error('Minecraft cron update failed:', err); } });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await logCommand(interaction);
  if (interaction.commandName === 'day') { const day = getCurrentDay(); return interaction.reply({ content: '📅 Current day is **Day ' + day + '**' }); }
  if (interaction.commandName === 'noodlebox') {
    return interaction.reply({ content: '# 🍜 NoodleBox\n\nNoodleBox is a modded Minecraft server created as a fun server for friends; with mods from magic to mechanics, with a little something for anyone.\n\nThe server, created and currently run by Liam, began more humble, with only a few friends and barely any mods, but grew to be very modded with many players and is currently on Season 3 of its existence.\n\nThe current season began on March 21st 2026 running Forge 1.20.1.' });
  }
  if (interaction.commandName === 'status') {
    try {
      await interaction.deferReply();
      const data = await fetchMinecraftData();
      if (!data.online) return interaction.editReply({ content: '🔴 The Minecraft server is currently offline.' });
      let playerList = '';
      if (data.players.list && data.players.list.length > 0) playerList = '\n**Players Online:** ' + data.players.list.join(', ');
      return interaction.editReply({ content: '## 🟢 NoodleBox Server Status\n**Status:** Online\n**Address:** `' + MINECRAFT_SERVER_IP + '`\n**Players:** ' + data.players.online + ' / ' + data.players.max + playerList + '\n**Version:** ' + data.version });
    } catch (err) { console.error('Status command failed:', err); return interaction.editReply({ content: 'Failed to retrieve server status (API timeout or error).' }); }
  }
  if (!OWNER_IDS.includes(interaction.user.id)) return interaction.reply({ content: 'You cannot use this command.', ephemeral: true });
  if (interaction.commandName === 'update') {
    try { await interaction.deferReply({ ephemeral: true }); await updateChannel(false); await updateMinecraftStats(); return interaction.editReply({ content: 'Bot channels and Minecraft status updated!' }); } catch (err) { console.error('Manual update failed:', err); return interaction.editReply({ content: 'Failed to update.' }); }
  }
  if (interaction.commandName === 'send') {
    const message = interaction.options.getString('message');
    try { await interaction.channel.send(message); return interaction.reply({ content: 'Message sent!', ephemeral: true }); } catch (err) { console.error('Send failed:', err); return interaction.reply({ content: 'Failed to send message.', ephemeral: true }); }
  }
  if (interaction.commandName === 'sendchannel') {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    try { await channel.send(message); return interaction.reply({ content: 'Message sent!', ephemeral: true }); } catch (err) { console.error('Sendchannel failed:', err); return interaction.reply({ content: 'Failed to send message.', ephemeral: true }); }
  }
});

// AI message handling removed per user request
