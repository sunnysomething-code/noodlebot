const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('page')
    .setDescription('Shows links to NoodleBox webpages'),

  async execute(interaction) {
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🧑‍🤝‍🧑 Players')
        .setStyle(ButtonStyle.Link)
        .setURL('https://noodlebox.cc/players'),
      new ButtonBuilder()
        .setLabel('📷 Gallery')
        .setStyle(ButtonStyle.Link)
        .setURL('https://noodlebox.cc/gallery'),
      new ButtonBuilder()
        .setLabel('🏙️ Societies')
        .setStyle(ButtonStyle.Link)
        .setURL('https://noodlebox.cc/societies'),
      new ButtonBuilder()
        .setLabel('🗺️ Roadmap')
        .setStyle(ButtonStyle.Link)
        .setURL('https://noodlebox.cc/roadmap')
    );

    await interaction.reply({
      content: 'Go to direct webpage:',
      components: [buttons],
    });
  },
};
