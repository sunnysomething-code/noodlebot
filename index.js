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

const CHANNEL_ID = '1492756482373058650';
const OWNER_ID = '871973279924093028';

// Day system
const startDate = new Date('2026-03-21');

// Register slash command
const commands = [
  new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send a message to a channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send to')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to send')
        .setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register command (global)
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Slash command registered');
  } catch (err) {
    console.error(err);
  }

  // Daily update
  cron.schedule('0 0 * * *', async () => {
    const now = new Date();
    const diffTime = now - startDate;
    const day = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel) {
      await channel.setName(`Day: ${day}`);
    }
  }, {
    timezone: 'Australia/Brisbane'
  });
});

// Handle command
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'send') {

    // Restrict to you only
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: 'You cannot use this command.',
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    try {
      await channel.send(message);

      await interaction.reply({
        content: 'Message sent!',
        ephemeral: true
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        content: 'Failed to send message.',
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN);
