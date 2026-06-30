const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(opt => opt.setName('member').setDescription('Member to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('member');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: 'That member could not be found in this server.', ephemeral: true });
    }
    if (!member.bannable) {
      return interaction.reply({ content: 'I cannot ban this member (check role hierarchy / my permissions).', ephemeral: true });
    }

    await member.ban({ reason });

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('Member Banned')
      .addFields(
        { name: 'Member', value: `${target.tag} (${target.id})` },
        { name: 'Moderator', value: `${interaction.user.tag}` },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
