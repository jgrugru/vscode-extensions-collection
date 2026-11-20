const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { thumbName, ffmpegArgs } = require('./assets');

function run(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 20000 }, (err) => (err ? reject(err) : resolve()));
  });
}

async function sizeOf(file) {
  try {
    return (await fs.promises.stat(file)).size;
  } catch {
    return 0;
  }
}

async function findFfmpeg(candidates) {
  for (const bin of candidates) {
    try {
      await run(bin, ['-version']);
      return bin;
    } catch {}
  }
  return undefined;
}

/**
 * Returns thumbnail(file): resolves the path of a cached jpg frame of the video,
 * making it with ffmpeg when missing. At most limit ffmpeg runs at once,
 * newest request first so tiles on screen now beat ones scrolled past.
 */
function createThumbnailer(dir, candidates, limit = 4) {
  let ffmpeg;
  let active = 0;
  const waiting = [];
  const inflight = new Map();

  async function slot(work) {
    if (active >= limit) await new Promise((go) => waiting.push(go));
    active++;
    try {
      return await work();
    } finally {
      active--;
      const next = waiting.pop();
      if (next) next();
    }
  }

  async function make(file) {
    const stat = await fs.promises.stat(file);
    const out = path.join(dir, thumbName(file, stat.mtimeMs, stat.size));
    if ((await sizeOf(out)) > 0) return out;
    ffmpeg = ffmpeg || findFfmpeg(candidates);
    const bin = await ffmpeg;
    if (!bin) throw new Error('ffmpeg not found');
    await fs.promises.mkdir(dir, { recursive: true });
    const tmp = out + '.tmp.jpg';
    // The keyframe near one second; clips with none there fall back to the first frame.
    for (const seek of [1, 0]) {
      try {
        await run(bin, ffmpegArgs(file, tmp, seek));
      } catch {}
      if ((await sizeOf(tmp)) > 0) {
        await fs.promises.rename(tmp, out);
        return out;
      }
    }
    throw new Error('ffmpeg could not read a frame');
  }

  return function thumbnail(file) {
    if (!inflight.has(file)) {
      inflight.set(file, slot(() => make(file)).finally(() => inflight.delete(file)));
    }
    return inflight.get(file);
  };
}

module.exports = { createThumbnailer, findFfmpeg };
