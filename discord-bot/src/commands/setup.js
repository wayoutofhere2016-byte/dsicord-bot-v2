const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { updateSettings } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Automatically create and configure the Verified and Muted roles for the bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const results = [];

    // ---- Verified Role ----
    let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
    if (!verifiedRole) {
      verifiedRole = await guild.roles.create({
        name: 'Verified',
        color: 0x2ECC71,
        reason: 'Auto-created by bot /setup',
        permissions: []
      });
      results.push('✅ Created **Verified** role');
    } else {
      results.push('ℹ️ **Verified** role already existed — using it');
    }

    // ---- Muted Role ----
    let mutedRole = guild.roles.cache.find(r => r.name === 'Muted');
    if (!mutedRole) {
      mutedRole = await guild.roles.create({
        name: 'Muted',
        color: 0x95A5A6,
        reason: 'Auto-created by bot /setup',
        permissions: []
      });
      results.push('✅ Created **Muted** role');
    } else {
      results.push('ℹ️ **Muted** role already existed — using it');
    }

    // ---- Apply Muted permission overwrites to every text channel & category ----
    let channelCount = 0;
    const channels = await guild.channels.fetch();
    for (const [, channel] of channels) {
      if (
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildForum ||
        channel.type === ChannelType.GuildCategory
      ) {
        await channel.permissionOverwrites.edit(mutedRole, {
          SendMessages: false,
          SendMessagesInThreads: false,
          AddReactions: false,
          Speak: false
        }).catch(() => {}); // skip channels the bot lacks permission to edit
        channelCount++;
      }
    }
    results.push(`🔇 Applied Muted deny-perms to **${channelCount}** channels`);

    // ---- Save both role IDs to database ----
    updateSettings(guild.id, {
      verified_role_id: verifiedRole.id,
      muted_role_id: mutedRole.id
    });
    results.push('💾 Saved role IDs to bot settings');

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ Setup Complete')
      .setDescription(results.join('\n'))
      .addFields(
        { name: 'Verified Role', value: `<@&${verifiedRole.id}>`, inline: true },
        { name: 'Muted Role', value: `<@&${mutedRole.id}>`, inline: true }
      )
      .setFooter({ text: 'You can now use /verifysetup and /ticketpanel' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
