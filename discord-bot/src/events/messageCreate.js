const { db } = require('../database');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    // If this message is in an open ticket channel, update last_activity and reset warning flag
    const ticket = db.prepare(
      "SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'"
    ).get(message.channel.id);

    if (ticket) {
      db.prepare(
        'UPDATE tickets SET last_activity = ?, inactivity_warned = 0 WHERE channel_id = ?'
      ).run(Date.now(), message.channel.id);
    }
  }
};
