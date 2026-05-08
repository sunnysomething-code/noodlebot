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

// CONFIG
const CHANNEL_ID = '1492756482373058650';
const MESSAGE_CHANNEL_ID = '1362246373960847550';
const OWNER_IDS = [
  '871973279924093028',
  '1274565145149837469'
];

// Start date: Day 1
const startDate = new Date('2026-03-21');

// Calculate real current day
function getCurrentDay() {
  const now = new Date();
  const diffTime = now - startDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// Main update function
async function updateChannel(sendMessage = true) {
  const day = getCurrentDay();

  const voiceChannel = await client.channels.fetch(CHANNEL_ID);
  if (voiceChannel) {
    await voiceChannel.setName(`Day: ${day}`);
  }

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
    .setDescription('Restricted to bot owner'),

  new SlashCommandBuilder()
    .setName('day')
    .setDescription('Show current day'),

  new SlashCommandBuilder()
  .setName('noodlebox')
  .setDescription('Information about the NoodleBox server'),

  new SlashCommandBuilder()
    .setName('setday')
    .setDescription('Restricted to bot owner')
    .addIntegerOption(option =>
      option.setName('number')
        .setDescription('Day number')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('send')
    .setDescription('Restricted to bot owner')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to send')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('sendchannel')
    .setDescription('Restricted to bot owner')
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
    console.error('Command registration failed:', err);
  }

  // Run once on startup, but don't send daily message
  try {
    await updateChannel(false);
  } catch (err) {
    console.error('Startup update failed:', err);
  }

  // Daily update at midnight Brisbane time
  cron.schedule('0 0 * * *', async () => {
    try {
      await updateChannel(true);
    } catch (err) {
      console.error('Daily update failed:', err);
    }
  }, {
    timezone: 'Australia/Brisbane'
  });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // /day is public
  if (interaction.commandName === 'day') {
    const day = getCurrentDay();

    return interaction.reply({
      content: `📅 Current day is **${day}**`
    });
  }

  // /noodlebox is public
if (interaction.commandName === 'noodlebox') {
  return interaction.reply({
    content:
`# 🍜 NoodleBox

NoodleBox is a modded Minecraft server created as a fun server for friends; with mods from magic to mechanics, with a little something for anyone.

The server, created and currently run by Liam, began more humble, with only a few friends and barely any mods, but grew to be very modded with many players and is currently on Season 3 of its existence.

The current season began on March 21st 2026 running Forge 1.20.1.`
  });
}

  // All other commands are owner-only
  if (!OWNER_IDS.includes(interaction.user.id)) {
    return interaction.reply({
      content: 'You cannot use this command.',
      ephemeral: true
    });
  }

  // /update
  if (interaction.commandName === 'update') {
    try {
      await updateChannel(true);

      return interaction.reply({
        content: 'Updated!',
        ephemeral: true
      });
    } catch (err) {
      console.error('Manual update failed:', err);

      return interaction.reply({
        content: 'Failed to update.',
        ephemeral: true
      });
    }
  }

  // /setday temporary override
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
      console.error('Setday failed:', err);

      return interaction.reply({
        content: 'Failed to set day.',
        ephemeral: true
      });
    }
  }

  // /send sends in current channel
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

  // /sendchannel sends in selected channel
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

client.login(process.env.TOKEN);
