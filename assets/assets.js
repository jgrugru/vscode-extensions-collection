const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Extension (lower case, no dot) to 'image' or 'video'. */
function kindMap(images, videos) {
  const kinds = new Map();
  const add = (list, kind) => list.forEach((e) => kinds.set(String(e).toLowerCase().replace(/^\./, ''), kind));
  add(images, 'image');
  add(videos, 'video');
  return kinds;
}

function extOf(file) {
  return path.extname(file).slice(1).toLowerCase();
}

/**
 * Collects assets under root into out, skipping folders named in opts.skip.
 * Symlinks are not followed. Stops once out holds opts.max items.
 */
async function walk(root, opts, out = []) {
  const pending = [root];
  while (pending.length > 0 && out.length < opts.max) {
    const dir = pending.shift();
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!opts.skip.has(entry.name)) pending.push(full);
      } else if (entry.isFile()) {
        const ext = extOf(entry.name);
        const kind = opts.kinds.get(ext);
        if (!kind) continue;
        if (out.length >= opts.max) break;
        out.push({ path: full, name: entry.name, ext, kind });
      }
    }
  }
  return out;
}

/** Thumbnail file name; changes whenever the video changes. */
function thumbName(file, mtimeMs, size) {
  return crypto.createHash('sha1').update(file + '|' + mtimeMs + '|' + size).digest('hex') + '.jpg';
}

/**
 * ffmpeg arguments that write one frame near seek seconds as a small jpg.
 * Keyframes only and no exact seek: nothing but the one frame is decoded, which keeps big clips fast.
 */
function ffmpegArgs(file, out, seek) {
  return ['-y', '-loglevel', 'error', '-skip_frame', 'nokey', '-noaccurate_seek', '-ss', String(seek), '-i', file, '-an', '-sn', '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '5', out];
}

/** The configured ffmpeg first, then the usual Homebrew spots (the editor's PATH often lacks them). */
function ffmpegCandidates(configured) {
  return [...new Set([configured || 'ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'])];
}

module.exports = { kindMap, extOf, walk, thumbName, ffmpegArgs, ffmpegCandidates };
