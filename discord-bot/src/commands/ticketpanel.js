const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { db } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Post a ticket panel to a channel')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to post the panel in (defaults to here)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('categories')
        .setDescription('Comma-separated categories e.g. "General, Billing". Leave blank for one button.')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('title')
        .setDescription('Panel embed title')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('description')
        .setDescription('Panel embed description')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const categoriesRaw = interaction.options.getString('categories');
    const title = interaction.options.getString('title') || 'Need Help?';
    const description = interaction.options.getString('description') || 'Open a ticket below and our team will assist you.';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(title)
      .setDescription(description);

    let components;
    let categories = null;

    if (categoriesRaw) {
      categories = categoriesRaw.split(',').map(c => c.trim()).filter(Boolean);
      const select = new StringSelectMenuBuilder()
        .setCustomId('ticket_category_select')
        .setPlaceholder('Choose a ticket category...')
        .addOptions(categories.map(c => ({ label: c, value: c })));
      components = [new ActionRowBuilder().addComponents(select)];
    } else {
      const button = new ButtonBuilder()
        .setCustomId('ticket_open_generic')
        .setLabel('Open Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫');
      components = [new ActionRowBuilder().addComponents(button)];
    }

    const sent = await channel.send({ embeds: [embed], components });

    db.prepare('INSERT INTO ticket_panels (message_id, channel_id, guild_id, categories_json) VALUES (?, ?, ?, ?)')
      .run(sent.id, channel.id, interaction.guild.id, categories ? JSON.stringify(categories) : null);

    await interaction.reply({ content: `Ticket panel posted in ${channel}.`, ephemeral: true });
  }
};
