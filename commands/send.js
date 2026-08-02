const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send a message in this channel')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Message to send')
        .setRequired(true)
    ),

  ownerOnly: true,

  async execute(interaction) {
    const message = interaction.options.getString('message', true);

    try {
      await interaction.channel.send(message);

      await interaction.reply({
        content: 'Message sent!',
        ephemeral: true,
      });
    } catch (error) {
      console.error('Send failed:', error);

      await interaction.reply({
        content: 'Failed to send message.',
        ephemeral: true,
      });
    }
  },
};
