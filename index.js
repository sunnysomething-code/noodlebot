const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

const cron = require('node-cron');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// CONFIG (CHANGE THESE)
const CHANNEL_ID = '1492756482373058650';
const MESSAGE_CHANNEL_ID = '1362246373960847550';
const OWNER_ID = '871973279924093028';

// Start date (Day 1)
const startDate = new Date('2026-03-21');

// Main update function
async function updateChannel(client, sendMessage = true) {
  const now = new Date();
  const diffTime = now - startDate;

  const day = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Rename voice channel
  const voiceChannel = await client.channels.fetch(CHANNEL_ID);
  if (voiceChannel) {
    await voiceChannel.setName(`Day: ${day}`);
  }

  // Send daily message
  if (sendMessage) {
    const textChannel = await client.channels.fetch(MESSAGE_CHANNEL_ID);
    if (textChannel) {
      await textChannel.send(`📅 Today is **Day ${day}**`);
    }
  }

  console.log(`Updated to Day: ${day}`);
}

// Slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('update')
    .setDescription('Force update the day channel'),

  new SlashCommandBuilder()
    .setName('day')
    .setDescription('Show current day'),

  new SlashCommandBuilder()
    .setName('setday')
    .setDescription('Temporarily set the day (resets next day)')
    .addIntegerOption(option =>
      option.setName('number')
        .setDescription('Day number')
        .setRequired(true)
    ),

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
    .setDescription('Send a message to a specific channel')
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

].map(cmd => cmd.toJSON());

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Slash commands registered');
  } catch (err) {
    console.error(err);
  }

// Run once on startup
try {
  await updateChannel(client, false);
} catch (err) {
  console.error('Startup update failed:', err);
}

// Daily update at midnight (Brisbane)
cron.schedule('0 0 * * *', async () => {
  try {
    await updateChannel(client);
  } catch (err) {
    console.error('Daily update failed:', err);
  }
}, {
  timezone: 'Australia/Brisbane'
});

// Command handling
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // /day is public
  if (interaction.commandName === 'day') {
    const now = new Date();
    const diffTime = now - startDate;

    const day = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return interaction.reply({
      content: `📅 Current day is **${day}**`
    });
  }

  // Everything else is owner-only
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({
      content: 'You cannot use this command.',
      ephemeral: true
    });
  }

  // /update
  if (interaction.commandName === 'update') {
    await updateChannel(client);

    return interaction.reply({
      content: 'Updated!',
      ephemeral: true
    });
  }

  // /setday
  if (interaction.commandName === 'setday') {
    const number = interaction.options.getInteger('number');

    try {
      const voiceChannel = await client.channels.fetch(CHANNEL_ID);
      if (voiceChannel) {
        await voiceChannel.setName(`Day: ${number}`);
      }

      const textChannel = await client.channels.fetch(MESSAGE_CHANNEL_ID);
      if (textChannel) {
        await textChannel.send(`📅 Today is **Day ${number}**`);
      }

      return interaction.reply({
        content: `Temporarily set to Day ${number}`,
        ephemeral: true
      });
    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: 'Failed to set day.',
        ephemeral: true
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
      console.error(err);
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
      console.error(err);
      return interaction.reply({
        content: 'Failed to send message.',
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN);
