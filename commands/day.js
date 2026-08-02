const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('day')
    .setDescription('Show current day'),

  async execute(interaction, { getCurrentDay }) {
    const day = getCurrentDay();

    await interaction.reply({
      content: `📅 Current day is **Day ${day}**`,
    });
  },
};
