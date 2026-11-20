# Asset Finder

Sidebar gallery of every image and video in the workspace.

- Thumbnails: images show themselves; each video shows a frame grabbed with `ffmpeg` (cached).
- Grouped by folder with collapsible headers (big sets start closed; the first chip switches to one flat grid).
- Filter by file type with the chips (PNG, MP4, ...) or by name with the search box.
- Click a tile to open the image or play the video in an editor tab.
- Zoom buttons in the view title make the thumbnails smaller or bigger.
- Right-click a tile: Open, Open in Default App, Reveal in Finder, Reveal in Explorer View, Copy Path, Copy Relative Path.

Settings: `assetFinder.imageExtensions`, `assetFinder.videoExtensions`, `assetFinder.excludeFolders`, `assetFinder.maxFiles`, `assetFinder.ffmpegPath`.

Without ffmpeg, video tiles fall back to the editor's own first-frame rendering.
