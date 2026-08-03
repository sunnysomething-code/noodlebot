const { LOG_CHANNEL_ID } = require('../config');

const LEWIS_ID = '871973279924093028';

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
    const userLabel =
      interaction.user.id === LEWIS_ID
        ? 'Lewis'
        : `<@${interaction.user.id}>`;

    await logChannel.send({
      content: `${userLabel}\n${commandText}`,
      allowedMentions: {
        users:
          interaction.user.id === LEWIS_ID
            ? []
            : [interaction.user.id],
      },
    });
  } catch (error) {
    console.error('Command log failed:', error);
  }
}

module.exports = logCommand;
