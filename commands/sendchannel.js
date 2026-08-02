const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendchannel')
    .setDescription('Send a message in another channel')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Message to send')
        .setRequired(true)
    ),

  ownerOnly: true,

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);

    try {
      await channel.send(message);

      await interaction.reply({
        content: 'Message sent!',
        ephemeral: true,
      });
    } catch (error) {
      console.error('Sendchannel failed:', error);

      await interaction.reply({
        content: 'Failed to send message.',
        ephemeral: true,
      });
    }
  },
};
