# RAM Nudge

A small, free Chrome extension (working name). It watches your computer's free
memory. When it runs low, it shows a badge and one notification, and the popup
offers **Restart Chrome**. After the restart your tabs come back.

## What it does

- Checks available system memory every 30 seconds. "Low" means available memory below 15%
  (change it in Settings); it goes back to normal above 20%.
- Shows a `!` badge and one notification per low-memory episode, with
  **Restart Chrome** and **Snooze** buttons. Snooze holds the next nudge back
  for the snooze length; if memory is still low afterwards, you get one more.
- The popup shows memory state, open tab count and the restart button.
- The welcome page and a popup link open Chrome's startup settings so you can
  choose **Continue where you left off**. Chrome does not let extensions read
  that setting, so the extension cannot check it for you.
- English and Spanish.

It only talks about your **computer's** memory. Chrome's own memory use is not
measurable by extensions on stable Chrome, so it never claims otherwise.

If no notification appears on macOS, allow notifications for Google Chrome in
System Settings > Notifications. The badge and popup work either way.

## About the restart button

Chrome blocks extensions from opening `chrome://restart`. The button copies
`chrome://restart` to your clipboard; paste it in the address bar and press
Enter. Chrome restarts and your tabs come back (in testing this worked with
the startup setting at its default, but "Continue where you left off" is what
protects your tabs on a normal quit or a crash). A page with unsaved changes may
ask to confirm first.

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

## Install (load unpacked)

1. Download or clone this folder.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder.

## Develop

`npm test` runs the unit tests for the threshold logic (Node 20+, no dependencies).
There is no build step.

## License

MIT, see `LICENSE`.
