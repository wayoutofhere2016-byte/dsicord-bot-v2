const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits
} = require('discord.js');
const { getSettings, db } = require('../database');
const { buildTranscript } = require('../utils/transcript');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      if (interaction.isButton()) {
        await handleButton(interaction);
        return;
      }

      if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
        return;
      }
    } catch (err) {
      console.error(err);
      const errMsg = { content: 'Something went wrong handling that interaction.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    }
  }
};

async function handleButton(interaction) {
  const id = interaction.customId;

  // ---- Verification ----
  if (id === 'verify_button') {
    const settings = getSettings(interaction.guild.id);
    const roleId = settings.verified_role_id || process.env.VERIFIED_ROLE_ID;
    const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;

    if (!role) {
      return interaction.reply({ content: 'Verification isn\'t configured yet. Ask an admin to run /settings.', ephemeral: true });
    }
    if (interaction.member.roles.cache.has(role.id)) {
      return interaction.reply({ content: 'You\'re already verified!', ephemeral: true });
    }

    await interaction.member.roles.add(role);
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('You\'re Verified!')
      .setDescription(`Welcome to **${interaction.guild.name}**. You now have full access to the server.`);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ---- Ticket: generic open button -> ask for reason via modal ----
  if (id === 'ticket_open_generic') {
    return showReasonModal(interaction, 'General');
  }

  // ---- Ticket: close button ----
  if (id === 'ticket_close') {
    return closeTicket(interaction);
  }
}

async function handleSelectMenu(interaction) {
  if (interaction.customId === 'ticket_category_select') {
    const category = interaction.values[0];
    return showReasonModal(interaction, category);
  }
}

function showReasonModal(interaction, category) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_reason_modal_${encodeURIComponent(category)}`)
    .setTitle('Open a Ticket');

  const reasonInput = new TextInputBuilder()
    .setCustomId('ticket_reason')
    .setLabel('What would you like to ask?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  return interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
  const id = interaction.customId;

  // ---- Embed builder modal ----
  if (id.startsWith('embedmodal_')) {
    const channelId = id.replace('embedmodal_', '');
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel) return interaction.reply({ content: 'That channel no longer exists.', ephemeral: true });

    const title = interaction.fields.getTextInputValue('embed_title');
    const description = interaction.fields.getTextInputValue('embed_description');
    const color = interaction.fields.getTextInputValue('embed_color');
    const image = interaction.fields.getTextInputValue('embed_image');
    const footer = interaction.fields.getTextInputValue('embed_footer');

    const embed = new EmbedBuilder().setDescription(description);
    if (title) embed.setTitle(title);
    if (footer) embed.setFooter({ text: footer });
    if (image) {
      try { embed.setImage(image); } catch { /* ignore invalid url */ }
    }
    if (color) {
      try { embed.setColor(color); } catch { embed.setColor(0x5865F2); }
    } else {
      embed.setColor(0x5865F2);
    }

    await channel.send({ embeds: [embed] });
    return interaction.reply({ content: `Embed sent in ${channel}.`, ephemeral: true });
  }

  // ---- Ticket reason modal -> create the ticket channel ----
  if (id.startsWith('ticket_reason_modal_')) {
    const category = decodeURIComponent(id.replace('ticket_reason_modal_', ''));
    const reason = interaction.fields.getTextInputValue('ticket_reason');
    return createTicketChannel(interaction, category, reason);
  }
}

async function createTicketChannel(interaction, category, reason) {
  await interaction.deferReply({ ephemeral: true });

  const settings = getSettings(interaction.guild.id);
  const categoryId = settings.ticket_category_id || process.env.TICKET_CATEGORY_ID || null;
  const staffRoleIds = (settings.ticket_staff_role_ids || process.env.TICKET_STAFF_ROLE_IDS || '')
    .split(',').filter(Boolean);

  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: interaction.client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
    }
  ];
  for (const roleId of staffRoleIds) {
    overwrites.push({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  const safeName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);

  const channel = await interaction.guild.channels.create({
    name: safeName,
    type: ChannelType.GuildText,
    parent: categoryId || undefined,
    permissionOverwrites: overwrites,
    topic: `Ticket opened by ${interaction.user.tag} | Category: ${category}`
  });

  const now = Date.now();
  db.prepare('INSERT INTO tickets (channel_id, guild_id, opener_id, category_label, reason, status, created_at, last_activity, inactivity_warned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)')
    .run(channel.id, interaction.guild.id, interaction.user.id, category, reason, 'open', now, now);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`Ticket: ${category}`)
    .addFields(
      { name: 'Opened by', value: `${interaction.user}` },
      { name: 'Reason', value: reason }
    )
    .setTimestamp();

  const closeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  );

  const staffMentions = staffRoleIds.map(id => `<@&${id}>`).join(' ');
  await channel.send({ content: `${interaction.user} ${staffMentions}`.trim(), embeds: [embed], components: [closeButton] });

  await interaction.editReply({ content: `Your ticket has been created: ${channel}` });
}

async function closeTicket(interaction) {
  await interaction.deferReply();

  const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
  const settings = getSettings(interaction.guild.id);

  const transcriptAttachment = await buildTranscript(interaction.channel);

  db.prepare('UPDATE tickets SET status = ?, closed_at = ?, closed_by = ? WHERE channel_id = ?')
    .run('closed', Date.now(), interaction.user.id, interaction.channel.id);

  const logChannelId = settings.transcript_log_channel_id || process.env.TRANSCRIPT_LOG_CHANNEL_ID;
  if (logChannelId) {
    const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('Ticket Closed')
        .addFields(
          { name: 'Channel', value: `#${interaction.channel.name}` },
          { name: 'Category', value: ticket?.category_label || 'Unknown' },
          { name: 'Opened by', value: ticket ? `<@${ticket.opener_id}>` : 'Unknown' },
          { name: 'Closed by', value: `${interaction.user}` }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed], files: [transcriptAttachment] });
    }
  }

  // Try to DM the transcript to whoever opened the ticket too.
  if (ticket) {
    try {
      const opener = await interaction.client.users.fetch(ticket.opener_id);
      await opener.send({ content: `Your ticket in **${interaction.guild.name}** has been closed. Transcript attached.`, files: [transcriptAttachment] });
    } catch { /* DMs closed - ignore */ }
  }

  await interaction.followUp({ content: 'Ticket closed. This channel will be deleted in 10 seconds.' });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
}
