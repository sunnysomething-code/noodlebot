require('dotenv').config();

const {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const {
  MINECRAFT_SERVER_IP,
  OWNER_IDS,
} = require('./config');
const { createDayService } = require('./services/dayService');
const {
  createMinecraftService,
} = require('./services/minecraftService');
const logCommand = require('./utils/logCommand');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if (!command.data || typeof command.execute !== 'function') {
    console.warn(`Skipped invalid command file: ${file}`);
    continue;
  }

  client.commands.set(command.data.name, command);
}

const slashCommands = [...client.commands.values()].map(command =>
  command.data.toJSON()
);

const dayService = createDayService(client);
const minecraftService = createMinecraftService(client);

const commandContext = {
  ...dayService,
  ...minecraftService,
  minecraftServerIp: MINECRAFT_SERVER_IP,
};

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: slashCommands }
    );

    console.log('Slash commands registered');
  } catch (error) {
    console.error('Command registration failed:', error);
  }

  try {
    await dayService.updateChannel(false);
    await minecraftService.updateMinecraftStats();
  } catch (error) {
    console.error('Startup update failed:', error);
  }

  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        await dayService.updateChannel(true);
      } catch (error) {
        console.error('Daily update failed:', error);
      }
    },
    { timezone: 'Australia/Brisbane' }
  );

  cron.schedule('*/5 * * * *', async () => {
    try {
      await minecraftService.updateMinecraftStats();
    } catch (error) {
      console.error('Minecraft cron update failed:', error);
    }
  });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  await logCommand(client, interaction);

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`No handler found for /${interaction.commandName}`);
    return;
  }

  if (command.ownerOnly && !OWNER_IDS.includes(interaction.user.id)) {
    await interaction.reply({
      content: 'You cannot use this command.',
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction, commandContext);
  } catch (error) {
    console.error(`Command /${interaction.commandName} failed:`, error);

    const content = 'There was an error while running this command.';

    if (interaction.deferred) {
      await interaction.editReply({ content }).catch(() => null);
    } else if (interaction.replied) {
      await interaction
        .followUp({ content, ephemeral: true })
        .catch(() => null);
    } else {
      await interaction
        .reply({ content, ephemeral: true })
        .catch(() => null);
    }
  }
});

client.login(process.env.TOKEN);
