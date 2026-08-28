# CASE FILE 1892
### A cinematic historical immersion for *The Yellow Wallpaper*

This is a self-contained GitHub Pages website built with plain HTML, CSS, and JavaScript.

## What it does
- Gives students a gender-neutral first-person 1892 patient simulation.
- Personalizes the case with the student's name and preferred activity.
- Uses an autonomy meter, branching choices, medical-record reframing, and private/public reality.
- Plays local sound effects: page turns, pen scratching, rain, footsteps, room tone, and a latch.
- Uses the browser's built-in Speech Synthesis voice for the doctor's spoken dialogue.
- Ends with historically grounded context about women's legal/social world, period medicine, postpartum mental illness, the Rest Cure, and Charlotte Perkins Gilman.
- Explicitly bridges historical setting -> point of view/reliability -> universal theme.
- Saves progress locally on the same browser/device.
- Generates a printable final case report.

## Put it on GitHub Pages
1. Create a new GitHub repository.
2. Upload **all files and folders exactly as they appear here**.
3. In GitHub: Settings -> Pages.
4. Under “Build and deployment,” choose **Deploy from a branch**.
5. Select branch **main** and folder **/(root)**.
6. Save. GitHub will provide the live Pages link.

## Important audio note
Modern browsers block sound until the user interacts with a page. Students must click **ENTER 1892**. That first click unlocks the sound system.

The doctor's voice uses the Web Speech API / SpeechSynthesis voice installed on the student's device. The exact voice can vary by Chromebook, Windows PC, or Mac. Captions are always shown while the doctor speaks.

## Classroom recommendation
Headphones strongly recommended.

## Files
- `index.html` — page shell
- `styles.css` — cinematic styling and animation
- `game.js` — all story logic, choices, audio, progress saving, and report data
- `assets/` — bundled cinematic background art and favicon
- `audio/` — bundled sound effects
- `SOURCES.txt` — historical verification sources

## Customizing dialogue
All game text is in `game.js`. Search for the chapter title or a line of dialogue and edit the quoted text.

## Resetting
Students can use RESTART, or clear the site's local storage in the browser.
