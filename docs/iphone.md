# Puntito on iPhone

## Install and resume

1. Open the HTTPS deployment in Safari.
2. Choose **Share → Add to Home Screen**. Keep **Open as Web App** enabled if Safari offers the option.
3. Open Puntito from its icon, then create your game.

The landing remains at `/`. The installed app starts at `/app`, resumes the last game, and restores a pending round at the same player. The arrow in the scoreboard header opens the menu for creating or joining another game.

Install before creating your first game. Safari and the installed app can use separate storage, so editing access may not transfer between them. Clearing the app's data loses the host token. Shared game links only grant viewing access.

## At the table

- New games accept 2–10 players. The portrait layout fills the available screen and respects the notch and home indicator.
- During score entry, the scoreboard is replaced by one player's name and large score buttons. A brief press effect and a floating bubble with the previous player's name and points confirm each accepted choice. The bubble rises above the touch position, fades out, and does not intercept touches.
- A new player's buttons start unselected. Going back shows that player's recorded choice. Points only affect totals after reviewing and saving the whole round.
- The scoreboard and round summary use pages when the rows cannot fit legibly. The preparation list can scroll within its own panel; the game has no page scroll.
- Reduced motion disables the press and floating animations while keeping the brief confirmation visible. Recorded points are also announced to assistive technology.

The browser still controls some navigation gestures. A reload confirmation appears only where supported; recovery relies on the locally stored draft.

## Connection requirements

Installation does not add offline play. Creating games, reopening them, and saving rounds require a connection. An already-open scoreboard keeps its last reading if connectivity drops, and the pending round stays on the device for retry. This version does not register a service worker or cache private API responses.

For local phone testing, run `pnpm preview:lan` and open one of the printed addresses while the computer and phone are on the same network. Only the Next.js server is exposed; the database adapter remains on loopback. HTTP supports scoring, but clipboard and system sharing can be unavailable. Validate installation using HTTPS.

## Device checks

- Install from Safari and launch from the icon: the app should open directly without Safari's toolbars.
- Create a ten-player game, enter points, review the summary, and save. The scoreboard should be hidden during entry.
- Close and reopen halfway through a round: the player and previous choices should be restored.
- Verify that each score bubble belongs to the player just scored, stays within the screen, disappears, and leaves the next player's choices clear. Going back should restore the recorded selection.
- Check the scoreboard, summary, touch controls, notch, and home indicator with normal and enlarged text; use pagination where necessary.
- Try reduced motion, connection loss and recovery, and a shared link in another browser with view-only access.
