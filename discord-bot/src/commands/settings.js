const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { updateSettings, getSettings } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure bot settings for this server')
    .addRoleOption(opt => opt.setName('verified_role').setDescription('Role given on verification').setRequired(false))
    .addRoleOption(opt => opt.setName('muted_role').setDescription('Role used for /mute').setRequired(false))
    .addChannelOption(opt =>
      opt.setName('ticket_category')
        .setDescription('Category where ticket channels are created')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addRoleOption(opt => opt.setName('ticket_staff_role').setDescription('Staff role that can see tickets').setRequired(false))
    .addChannelOption(opt =>
      opt.setName('transcript_log_channel')
        .setDescription('Channel where closed ticket transcripts are logged')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const verifiedRole = interaction.options.getRole('verified_role');
    const mutedRole = interaction.options.getRole('muted_role');
    const ticketCategory = interaction.options.getChannel('ticket_category');
    const staffRole = interaction.options.getRole('ticket_staff_role');
    const logChannel = interaction.options.getChannel('transcript_log_channel');

    const updates = {};
    if (verifiedRole) updates.verified_role_id = verifiedRole.id;
    if (mutedRole) updates.muted_role_id = mutedRole.id;
    if (ticketCategory) updates.ticket_category_id = ticketCategory.id;
    if (logChannel) updates.transcript_log_channel_id = logChannel.id;

    if (staffRole) {
      const current = getSettings(interaction.guild.id).ticket_staff_role_ids;
      const ids = current ? current.split(',').filter(Boolean) : [];
      if (!ids.includes(staffRole.id)) ids.push(staffRole.id);
      updates.ticket_staff_role_ids = ids.join(',');
    }

    if (Object.keys(updates).length > 0) {
      updateSettings(interaction.guild.id, updates);
    }

    const settings = getSettings(interaction.guild.id);
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Current Settings')
      .addFields(
        { name: 'Verified Role', value: settings.verified_role_id ? `<@&${settings.verified_role_id}>` : 'Not set' },
        { name: 'Muted Role', value: settings.muted_role_id ? `<@&${settings.muted_role_id}>` : 'Not set' },
        { name: 'Ticket Category', value: settings.ticket_category_id ? `<#${settings.ticket_category_id}>` : 'Not set' },
        { name: 'Ticket Staff Roles', value: settings.ticket_staff_role_ids ? settings.ticket_staff_role_ids.split(',').map(id => `<@&${id}>`).join(', ') : 'Not set' },
        { name: 'Transcript Log Channel', value: settings.transcript_log_channel_id ? `<#${settings.transcript_log_channel_id}>` : 'Not set' }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
