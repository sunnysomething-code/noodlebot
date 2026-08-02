const { LOG_CHANNEL_ID } = require('../config');

async function logCommand(client, interaction) {
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
  } catch (error) {
    console.error('Command log failed:', error);
  }
}

module.exports = logCommand;
