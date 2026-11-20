const fs = require('fs/promises');
const path = require('path');

// Decimal units (1 MB = 1,000,000 bytes), the same as Finder.
function formatBytes(bytes) {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  if (unit === 0) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function plural(count, word) {
  return `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;
}

function describe(name, totals) {
  const parts = [formatBytes(totals.bytes)];
  if (totals.folders > 0 || totals.files !== 1) {
    parts.push(`${plural(totals.files, 'file')}, ${plural(totals.folders, 'folder')}`);
  }
  if (totals.skipped > 0) parts.push(`${plural(totals.skipped, 'unreadable item')} skipped`);
  return `${name}: ${parts.join(' - ')}`;
}

// Adds up the size of a file or of everything under a folder. Symlinks are
// counted as the link itself and never followed. `isCancelled` stops the walk.
async function measure(target, isCancelled = () => false, totals = newTotals()) {
  let stat;
  try {
    stat = await fs.lstat(target);
  } catch {
    totals.skipped += 1;
    return totals;
  }
  if (!stat.isDirectory()) {
    totals.bytes += stat.size;
    totals.files += 1;
    return totals;
  }
  const pending = [target];
  while (pending.length > 0 && !isCancelled()) {
    const dir = pending.pop();
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      totals.skipped += 1;
      continue;
    }
    const files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        totals.folders += 1;
        pending.push(full);
      } else {
        files.push(full);
      }
    }
    for (let i = 0; i < files.length && !isCancelled(); i += 64) {
      await Promise.all(files.slice(i, i + 64).map(async (file) => {
        try {
          totals.bytes += (await fs.lstat(file)).size;
          totals.files += 1;
        } catch {
          totals.skipped += 1;
        }
      }));
    }
  }
  return totals;
}

function newTotals() {
  return { bytes: 0, files: 0, folders: 0, skipped: 0 };
}

module.exports = { formatBytes, describe, measure, newTotals };
