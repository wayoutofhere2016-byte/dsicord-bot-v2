const { getSettings } = require('../database');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    const settings = getSettings(member.guild.id);
    if (!settings.welcome_dm_message) return;

    const message = settings.welcome_dm_message
      .replaceAll('{user}', member.toString())
      .replaceAll('{username}', member.user.username)
      .replaceAll('{server}', member.guild.name);

    try {
      await member.send(message);
    } catch {
      // User has DMs closed - silently ignore.
    }
  }
};
