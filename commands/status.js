const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show detailed Minecraft server status'),

  async execute(
    interaction,
    { fetchMinecraftData, minecraftServerIp }
  ) {
    await interaction.deferReply();

    try {
      const data = await fetchMinecraftData();

      if (!data.online) {
        await interaction.editReply({
          content: '🔴 The Minecraft server is currently offline.',
        });
        return;
      }

      let playerList = '';
      if (data.players.list && data.players.list.length > 0) {
        playerList = `\n**Players Online:** ${data.players.list.join(', ')}`;
      }

      await interaction.editReply({
        content:
          '## 🟢 NoodleBox Server Status\n' +
          '**Status:** Online\n' +
          `**Address:** \`${minecraftServerIp}\`\n` +
          `**Players:** ${data.players.online} / ${data.players.max}` +
          playerList +
          `\n**Version:** ${data.version}`,
      });
    } catch (error) {
      console.error('Status command failed:', error);

      await interaction.editReply({
        content: 'Failed to retrieve server status (API timeout or error).',
      });
    }
  },
};
