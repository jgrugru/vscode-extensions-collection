const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { kindMap, extOf, walk, thumbName, ffmpegArgs, ffmpegCandidates } = require('./assets');
const { createThumbnailer, findFfmpeg } = require('./thumbs');
const { page } = require('./page');

async function main() {
  const kinds = kindMap(['png', '.JPG'], ['mp4']);
  assert.strictEqual(kinds.get('png'), 'image');
  assert.strictEqual(kinds.get('jpg'), 'image');
  assert.strictEqual(kinds.get('mp4'), 'video');
  assert.strictEqual(extOf('/a/b/Clip.MP4'), 'mp4');
  assert.strictEqual(extOf('/a/b/noext'), '');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-test-'));
  fs.mkdirSync(path.join(root, 'sub', 'deep'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
  for (const f of ['a.png', 'b.txt', 'sub/c.MP4', 'sub/deep/d.jpg', 'node_modules/pkg/e.png']) {
    fs.writeFileSync(path.join(root, f), 'x');
  }
  fs.symlinkSync(path.join(root, 'sub'), path.join(root, 'link'));

  const opts = { kinds, skip: new Set(['node_modules']), max: 100 };
  const found = await walk(root, opts);
  assert.deepStrictEqual(found.map((a) => path.relative(root, a.path)).sort(), ['a.png', 'sub/c.MP4', 'sub/deep/d.jpg']);
  const clip = found.find((a) => a.name === 'c.MP4');
  assert.deepStrictEqual({ ext: clip.ext, kind: clip.kind }, { ext: 'mp4', kind: 'video' });
  assert.strictEqual((await walk(root, { ...opts, max: 2 })).length, 2);
  assert.deepStrictEqual(await walk(path.join(root, 'missing'), opts), []);

  assert.strictEqual(thumbName('/a.mp4', 1, 2), thumbName('/a.mp4', 1, 2));
  assert.notStrictEqual(thumbName('/a.mp4', 1, 2), thumbName('/a.mp4', 3, 2));
  assert.ok(/^[0-9a-f]{40}\.jpg$/.test(thumbName('/a.mp4', 1, 2)));
  const args = ffmpegArgs('/in.mp4', '/out.jpg', 1);
  assert.strictEqual(args[args.indexOf('-ss') + 1], '1');
  assert.ok(args.indexOf('-ss') < args.indexOf('-i'));
  assert.strictEqual(args[args.length - 1], '/out.jpg');
  assert.deepStrictEqual(ffmpegCandidates('ffmpeg').slice(0, 1), ['ffmpeg']);
  assert.strictEqual(ffmpegCandidates('/opt/homebrew/bin/ffmpeg').length, 2);

  const html = page('abc', 'vscode-resource:', 'S.js', 'S.css');
  assert.ok(html.includes("script-src 'nonce-abc'") && html.includes('src="S.js"') && html.includes('href="S.css"'));

  const thumbs = path.join(root, 'thumbs');
  const none = createThumbnailer(thumbs, ['/nonexistent/ffmpeg']);
  await assert.rejects(none(path.join(root, 'sub/c.MP4')), /ffmpeg not found/);

  const ffmpeg = await findFfmpeg(ffmpegCandidates('ffmpeg'));
  if (ffmpeg) {
    const make = (name, seconds) => {
      const out = path.join(root, name);
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10', '-t', String(seconds), '-pix_fmt', 'yuv420p', out]);
      return out;
    };
    const thumbnail = createThumbnailer(thumbs, [ffmpeg]);
    const long = make('long.mp4', 2);
    const short = make('short.mp4', 0.3);
    const [one, again, two] = await Promise.all([thumbnail(long), thumbnail(long), thumbnail(short)]);
    assert.strictEqual(one, again);
    assert.notStrictEqual(one, two);
    for (const f of [one, two]) {
      const head = fs.readFileSync(f).subarray(0, 2);
      assert.deepStrictEqual([head[0], head[1]], [0xff, 0xd8], 'thumbnail is a jpg');
    }
    const before = fs.statSync(one).mtimeMs;
    assert.strictEqual(await thumbnail(long), one);
    assert.strictEqual(fs.statSync(one).mtimeMs, before, 'cached thumbnail is reused');
    await assert.rejects(thumbnail(path.join(root, 'sub/c.MP4')), /could not read a frame/);
    console.log('ffmpeg thumbnails ok');
  } else {
    console.log('ffmpeg not found, thumbnail test skipped');
  }

  fs.rmSync(root, { recursive: true, force: true });
  console.log('ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
