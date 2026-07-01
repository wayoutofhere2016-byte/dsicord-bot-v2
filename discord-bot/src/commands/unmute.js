const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove the Muted role from a member')
    .addUserOption(opt => opt.setName('member').setDescription('Member to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('member');
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });

    const settings = getSettings(interaction.guild.id);
    const mutedRoleId = settings.muted_role_id || process.env.MUTED_ROLE_ID;
    const role = interaction.guild.roles.cache.get(mutedRoleId);
    if (!role) return interaction.reply({ content: 'Configured Muted role no longer exists.', ephemeral: true });

    await member.roles.remove(role, `Unmuted by ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('Member Unmuted')
      .addFields(
        { name: 'Member', value: `${target.tag} (${target.id})` },
        { name: 'Moderator', value: `${interaction.user.tag}` }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
