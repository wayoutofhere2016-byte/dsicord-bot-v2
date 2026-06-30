const { SlashCommandBuilder } = require('discord.js');
const { fixSocialLink } = require('../utils/socialEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('watch')
    .setDescription('Embed a Twitter/X, YouTube, or TikTok post so it renders inline')
    .addStringOption(opt => opt.setName('link').setDescription('The post URL').setRequired(true)),

  async execute(interaction) {
    const link = interaction.options.getString('link');
    const result = fixSocialLink(link);

    if (!result) {
      return interaction.reply({ content: 'That link doesn\'t look like a supported Twitter/X, YouTube, or TikTok URL.', ephemeral: true });
    }

    // Posting the fixed link as plain content lets Discord's own embed renderer pull in the video/image.
    await interaction.reply({ content: `${interaction.user} shared: ${result}` });
  }
};
