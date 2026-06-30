const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateSettings, getSettings } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcomedm')
    .setDescription('Set the custom DM message sent to new members when they join')
    .addStringOption(opt =>
      opt.setName('message')
        .setDescription('Use {user} for mention, {username} for name, {server} for server name')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    updateSettings(interaction.guild.id, { welcome_dm_message: message });

    const preview = message
      .replaceAll('{user}', interaction.user.toString())
      .replaceAll('{username}', interaction.user.username)
      .replaceAll('{server}', interaction.guild.name);

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('Welcome DM Updated')
      .setDescription('Preview of the message new members will receive:')
      .addFields({ name: 'Preview', value: preview });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
