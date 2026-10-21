# RAM Nudge

A small, free Chrome extension (working name). It watches your computer's free
memory. When it runs low, its toolbar face changes mood, you get one notification, and the popup
offers **Restart Chrome**. After the restart your tabs come back.

## What it does

- Checks available system memory every 30 seconds. "Low" means available memory below 15%
  (change it in Settings); it goes back to normal above 20%.
- The toolbar icon is a small pebble whose face follows free memory in five stages
  (calm, strained, sweating, red, melting). It changes only when the stage changes,
  winces when things get worse, and sighs now and then while memory is tight; there
  is no continuous animation. The tick counter behind the sighs is kept in the browser's
  session storage, so the rhythm survives the worker going to sleep. Its tooltip says
  the same thing as the popup heading.
- Shows one notification per low-memory episode, with
  **Restart Chrome** and **Snooze** buttons. Snooze holds the next nudge back
  for the snooze length; if memory is still low afterwards, you get one more.
- The popup shows memory state, open tab count and the restart button. **Free memory
  now** puts your other tabs to sleep (Chrome's tab discarding): the tab in front in
  each window, pinned tabs, tabs playing sound and tabs you excluded from Chrome's
  Memory Saver stay as they are. Sleeping tabs reload when you click them, so
  unsaved work inside a page can be lost.
- The welcome page and a popup link open Chrome's startup settings so you can
  choose **Continue where you left off**. Chrome does not let extensions read
  that setting, so the extension cannot check it for you.
- English and Spanish.

It only talks about your **computer's** memory. Chrome's own memory use is not
measurable by extensions on stable Chrome, so it never claims otherwise.

If no notification appears on macOS, allow notifications for Google Chrome in
System Settings > Notifications. The pebble and popup work either way.

## About the restart button

Chrome blocks extensions from opening `chrome://restart`, so the button does the
next best thing: it copies `chrome://restart` and opens a new tab (Chrome selects
its address bar). The popup tells you the rest: press **Cmd+V** (Ctrl+V on
Windows and Linux), then **Enter**. Chrome restarts and your tabs come back (in
testing this worked with the startup setting at its default, but "Continue where
you left off" is what protects your tabs on a normal quit or a crash). A page
with unsaved changes may ask to confirm first. If another extension replaces
the new tab page, press Cmd+L (Ctrl+L) first. If copying fails, the popup
shows the address to type instead.

## Permissions and why

| Permission | Why |
| --- | --- |
| `system.memory` | read total and available memory |
| `alarms` | check every 30 seconds while the service worker sleeps |
| `storage` | keep your threshold and snooze settings, and the current low-memory state |
| `notifications` | show the low-memory nudge |

No `tabs` permission and no host permissions. The tab count is a number only;
the extension never sees tab titles or addresses.

## Privacy

Nothing leaves your browser. There is no server, no analytics and no network
request.

## Install (free, no account)

Start at [the RAM Nudge website](https://particular-labs.github.io/ram-nudge/)
([Español](https://particular-labs.github.io/ram-nudge/es/)), or
[download the latest zip](https://github.com/particular-labs/ram-nudge/releases/latest).

1. Download the extension zip from the release.
2. Unzip it to get one RAM Nudge folder.
3. Move that folder somewhere permanent. Chrome loads it from there; **do not delete it**.
4. Copy `chrome://extensions` into Chrome's address bar and press Enter.
5. Turn on **Developer mode**.
6. Click **Load unpacked** and pick the folder you kept.

To update, download and unzip the new version, replace the contents of the permanent
folder with the new contents, then click **Reload** on its card in `chrome://extensions`.
There is no auto-update until the Chrome Web Store version. Chrome may show a
developer-mode extensions notice at startup. Works on Chrome 120 or newer (and
Chromium browsers at that level).

The release also contains `ram-nudge-<version>-store.zip` (same files, `manifest.json` at the archive root) for
Chrome Web Store upload; for manual install use the `-chrome.zip`. Privacy: the site's [privacy page](https://particular-labs.github.io/ram-nudge/privacy.html).

Optionally download `SHA256SUMS.json` from the same release and compare the zip's
SHA-256 with its entry in that file. Run in your downloads folder:

```sh
# macOS
shasum -a 256 ram-nudge-*-chrome.zip
# Linux
sha256sum ram-nudge-*-chrome.zip
```

```powershell
# Windows PowerShell
Get-FileHash .\ram-nudge-*-chrome.zip -Algorithm SHA256
```

## Develop

`npm test` runs the extension, packaging and site tests (Node 22+, no dependencies).
The extension and static site need no build step. `node scripts/pack.mjs` writes a
reproducible extension zip and archive/per-file SHA-256 hashes to `dist/`.

Maintainers release by bumping the version in `manifest.json`, merging to main,
and pushing the matching `vX.Y.Z` tag. The release decision = pushing the tag:
the workflow checks the version, runs tests, packs a normal GitHub release (so
`/releases/latest` resolves for the site's Download button) and dispatches Pages.
No npm or Chrome Web Store publishing is involved.

## Credits

The Nunito font (Vernon Adams, Jacques Le Bailly and contributors) is bundled under
the SIL Open Font License, see `fonts/OFL.txt`. No fonts or images are loaded from
the internet.

## License

MIT, see `LICENSE`.
