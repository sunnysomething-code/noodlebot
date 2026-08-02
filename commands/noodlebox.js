const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('noodlebox')
    .setDescription('Information about the NoodleBox server'),

  async execute(interaction) {
    await interaction.reply({
      content:
        '# 🍜 NoodleBox\n\n' +
        'NoodleBox is a modded Minecraft server created as a fun server for friends; with mods from magic to mechanics, with a little something for anyone.\n\n' +
        'The server, created and currently run by Liam, began more humble, with only a few friends and barely any mods, but grew to be very modded with many players and is currently on Season 3 of its existence.\n\n' +
        'The current season began on March 21st 2026 running Forge 1.20.1.',
    });
  },
};
