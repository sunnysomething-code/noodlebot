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
const LOG_CHANNEL_ID = '1485118762196799590';

const OWNER_IDS = [
  '871973279924093028',
  '1274565145149837469',
  '917921977816195072'
];

// Calculate current Brisbane day
function getCurrentDay() {
  const now = new Date();

  const brisbaneDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  const today = new Date(`${brisbaneDate}T00:00:00+10:00`);
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
        if (option.user) return `@${option.user.username}`;
        if (option.channel) return `#${option.channel.name}`;
        return option.value;
      })
      .join(' ');

    const commandText = `/${interaction.commandName} ${options}`.trim();

    await logChannel.send(
      `<@${interaction.user.id}>\n${commandText}`
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
    .setName('day')
    .setDescription('Show current day'),

  new SlashCommandBuilder()
    .setName('noodlebox')
    .setDescription('Information about the NoodleBox server'),

  new SlashCommandBuilder()
    .setName('update')
    .setDescription('Force update the day channel'),

  new SlashCommandBuilder()
    .setName('setday')
    .setDescription('Temporarily set the day')
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
  console.log(`Logged in as ${client.user.tag}`);

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

  // Startup update
  try {
    await updateChannel(false);

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
      content: `📅 Current day is **Day ${day}**`
    });
  }

  // /noodlebox
  if (interaction.commandName === 'noodlebox') {

    return interaction.reply({
      content:
`# 🍜 NoodleBox

NoodleBox is a modded Minecraft server created as a fun server for friends; with mods from magic to mechanics, with a little something for anyone.

The server, created and currently run by Liam, began more humble, with only a few friends and barely any mods, but grew to be very modded with many players and is currently on Season 3 of its existence.

The current season began on March 21st 2026 running Forge 1.20.1.`
    });
  }

  // OWNER-ONLY COMMANDS

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

      console.error('Setday failed:', err);

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

// Login
client.login(process.env.TOKEN);
