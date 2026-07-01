// Rewrites Twitter/X and TikTok links to "fix" services whose oEmbed/og-tags
// Discord can read directly (Discord can't reliably embed native x.com or
// tiktok.com video previews). YouTube links Discord already embeds natively,
// so they're passed through unchanged.

function fixSocialLink(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace('www.', '');

  // Twitter / X
  if (host === 'twitter.com' || host === 'x.com') {
    parsed.hostname = 'fxtwitter.com';
    return parsed.toString();
  }

  // TikTok
  if (host === 'tiktok.com' || host === 'vm.tiktok.com') {
    parsed.hostname = 'vxtiktok.com';
    return parsed.toString();
  }

  // YouTube - Discord embeds these natively already
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
    return url;
  }

  return null;
}

module.exports = { fixSocialLink };
