const { AttachmentBuilder } = require('discord.js');

function escapeHtml(str = '') {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function buildTranscript(channel) {
  let allMessages = [];
  let lastId = null;

  // Discord API only returns 100 messages per call - page backwards until done.
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;
    allMessages.push(...batch.values());
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }

  allMessages.reverse(); // chronological order

  const rows = allMessages.map(msg => {
    const avatar = msg.author.displayAvatarURL({ size: 64 });
    const timestamp = new Date(msg.createdTimestamp).toLocaleString();
    let content = escapeHtml(msg.content || '');

    const embedsHtml = msg.embeds.map(e => `
      <div class="embed">
        ${e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : ''}
        ${e.description ? `<div class="embed-desc">${escapeHtml(e.description)}</div>` : ''}
        ${e.fields?.map(f => `<div class="embed-field"><b>${escapeHtml(f.name)}</b><br>${escapeHtml(f.value)}</div>`).join('') || ''}
      </div>
    `).join('');

    const attachmentsHtml = msg.attachments.map(a => {
      if (/\.(png|jpe?g|gif|webp)$/i.test(a.url)) {
        return `<div><img src="${a.url}" style="max-width:400px;border-radius:8px;margin-top:4px;"></div>`;
      }
      return `<div><a href="${a.url}" target="_blank">${escapeHtml(a.name)}</a></div>`;
    }).join('');

    return `
      <div class="message">
        <img class="avatar" src="${avatar}">
        <div class="content-wrap">
          <div class="meta"><span class="author">${escapeHtml(msg.author.tag)}</span> <span class="time">${timestamp}</span></div>
          <div class="text">${content}</div>
          ${embedsHtml}
          ${attachmentsHtml}
        </div>
      </div>
    `;
  }).join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Transcript - ${escapeHtml(channel.name)}</title>
<style>
  body { background:#313338; color:#dcddde; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; margin:0; padding:20px; }
  h1 { color:#fff; }
  .message { display:flex; padding:8px 0; border-bottom:1px solid #3f4147; }
  .avatar { width:40px; height:40px; border-radius:50%; margin-right:12px; }
  .meta { margin-bottom:2px; }
  .author { font-weight:600; color:#fff; }
  .time { font-size:12px; color:#949ba4; margin-left:6px; }
  .text { white-space:pre-wrap; word-break:break-word; }
  .embed { border-left:4px solid #5865F2; background:#2b2d31; padding:8px 12px; border-radius:4px; margin-top:6px; max-width:480px; }
  .embed-title { font-weight:700; color:#fff; margin-bottom:4px; }
  .embed-desc { margin-bottom:4px; }
  .embed-field { margin-top:4px; font-size:14px; }
</style>
</head>
<body>
<h1>Transcript: #${escapeHtml(channel.name)}</h1>
<p>Exported on ${new Date().toLocaleString()}</p>
${rows}
</body>
</html>
`;

  return new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `transcript-${channel.name}.html` });
}

module.exports = { buildTranscript };
