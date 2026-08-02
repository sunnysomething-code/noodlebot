const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('update')
    .setDescription('Force update the day channel and Minecraft status'),

  ownerOnly: true,

  async execute(interaction, { updateChannel, updateMinecraftStats }) {
    await interaction.deferReply({ ephemeral: true });

    try {
      await updateChannel(false);
      await updateMinecraftStats();

      await interaction.editReply({
        content: 'Updated!',
      });
    } catch (error) {
      console.error('Manual update failed:', error);

      await interaction.editReply({
        content: 'Failed to update.',
      });
    }
  },
};
