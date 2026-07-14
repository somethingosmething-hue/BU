function parseDuration(str) {
  if (!str || typeof str !== 'string') return null;
  const regex = /(\d+)\s*(w|weeks?|d|days?|h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)(?=\d|\s|$|\+|,|\.|;|!|\?|&|\/|\\|-|_|\(|\)|\[|\]|\{|\}|\||`|~|@|#|\$|%|\^|\*|=)/gi;
  let ms = 0;
  let matched = false;
  let match;
  while ((match = regex.exec(str)) !== null) {
    matched = true;
    const n = parseInt(match[1], 10);
    const u = match[2].toLowerCase();
    if (u === 'w' || u === 'week' || u.startsWith('week')) ms += n * 604800000;
    else if (u === 'd' || u === 'day' || u.startsWith('day')) ms += n * 86400000;
    else if (u === 'h' || u === 'hr' || u.startsWith('hour')) ms += n * 3600000;
    else if (u === 'm' || u === 'min' || u.startsWith('min')) ms += n * 60000;
    else if (u === 's' || u === 'sec' || u.startsWith('sec')) ms += n * 1000;
  }
  if (!matched || ms <= 0) return null;
  return ms;
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0 seconds';
  const units = [
    { name: 'week',   ms: 604800000 },
    { name: 'day',    ms: 86400000 },
    { name: 'hour',   ms: 3600000 },
    { name: 'minute', ms: 60000 },
    { name: 'second', ms: 1000 },
  ];
  const parts = [];
  let remaining = ms;
  for (const u of units) {
    const val = Math.floor(remaining / u.ms);
    if (val >= 1) {
      parts.push(`${val} ${u.name}${val > 1 ? 's' : ''}`);
      remaining -= val * u.ms;
    }
  }
  if (!parts.length) return '0 seconds';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts.join(' and ');
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

module.exports = { parseDuration, formatDuration };
