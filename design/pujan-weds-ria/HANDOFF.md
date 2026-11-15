# Pujan weds Ria: lotus wedding invitation

Everything needed to carry this project on from another machine or another chat.
Written 15 November 2026.

## What this is

A single page wedding invitation website for Pujan and Ria. The wedding is on
Sunday, 13 December 2026, with events from 6 December.

The page is plain HTML, CSS and JavaScript in one file. It needs no build step.
The 3D scene uses three.js r128, loaded from cdnjs. Fonts come from Google Fonts.

## Folder contents

| Path | What it is |
|---|---|
| `site/index.html` | The complete page, ready to host as is |
| `site/siddhchakra-yantra.png` | The cleaned Siddhchakra yantra sketch used on the pujan card |
| `source/lotus-invitation.fragment.html` | The same page in the form published as a Claude artifact (no doctype or head) |
| `source/siddhchakra-yantra-original.png` | The yantra image as the client supplied it, 505 by 661 pixels |
| `experiments/envelope/` | An experimental opening: a lotus envelope sealed in wax that opens in a line of light. Ready to host on its own, with its own copy of the yantra |
| `previous-versions/` | Earlier saved versions, in case a direction needs to be recovered |

## How to host it

The `site` folder is a complete static site. Any static host works:

- **Vercel, Netlify or Cloudflare Pages:** create a project and point it at the
  `site` folder. No build command, no framework.
- **GitHub Pages:** push the contents of `site` to a repository and enable Pages.
- **To preview locally:** run `python3 -m http.server` inside `site` and open
  `http://localhost:8000`.

`index.html` carries a `noindex` tag so search engines do not list the invitation.

## The experience, in order

1. **Splash.** A single closed lotus on its stem, in dim low contrast light. One
   hint at the bottom says "Tap the lotus".
2. **Opening.** On the tap the lotus blooms. Gold light floods out, a burst of gold
   dust rises, and "Pujan weds Ria" grows out of the flower into place. A ring of
   light spreads across the water and wakes the leaves, the other lotuses, the loose
   petals and the brass diyas. A scalloped valance with jasmine strings, lotus buds
   and bells lowers in from the top.
3. **Scratch to reveal.** A gold foil lozenge that the guest rubs away to uncover
   "Sunday, 13 December 2026".
4. **The formal invitation.** Blessings, hosts, the couple's names, a countdown.
5. **Six event cards**, each with its own backdrop (see below).
6. **Venue, reply and closing cards.**

## The events

Edit these in the `EVENTS` list near the top of the script in `index.html`.

| Event | Date and time | Backdrop | Notes |
|---|---|---|---|
| Siddhchakra Pujan | Sun 6 Dec 2026, 11:00 am | Kesar dawn, gold lotus mandala, temple skyline, rising sparks | Jain pujan. Title is in Gujarati: સિધ્ધચક્ર પૂજન. Shows the yantra. No dress section. |
| Rang and Rituals | Fri 11 Dec 2026, 3:30 pm | Haldi yellow sky, pink and yellow mist, fast yellow petals | Context not confirmed (haldi or colour play) |
| Mehandi | Sat 12 Dec 2026, 11:00 am | Green garden light, green leaves falling | |
| Symphony Night | Sat 12 Dec 2026, 6:30 pm | Indigo dusk, stars, diyas carry the light | Context not confirmed (sangeet or live music) |
| Baarat | Sun 13 Dec 2026, 10:30 am | Saffron morning, heavy pink petal shower | |
| The Seven Steps | Sun 13 Dec 2026, 12:39 pm | Rose gold glow, embers rising | The wedding ceremony |

Each event has these fields:

- `name`, and optionally `title` and `lang` for a title in another script
- `day`, `date`, `time`
- `venue`, `area`, and `map` (the Google Maps link)
- `style`: the lettering treatment for the title
- `crest`: the small emblem at the top of the card
- `dress`: the "What to wear" block. Leave it out and the block disappears.
- `sketch` and `photo`: image paths for the outfit frames
- `feature`: one large image in place of the frames (used for the yantra)
- `fx`: the backdrop. Sky colours, mist colours, falling petals, rising sparks,
  halo, night level and so on.

## Design decisions made with the client

- Theme is lotus. Calm, bright, ivory and gold, with pink lotuses.
- The lotus replaces the usual envelope as the thing you tap to open.
- Every lotus stands on a stem. Small lotuses on stems sit in the bottom corners
  of every card.
- Marigold garlands were tried and removed. They hurt the elegance.
- The client writes the names as "Pujan weds Ria", groom first.
- Card order: event title, then date and time as one line, then dress code,
  then venue and map link last.
- The Siddhchakra yantra is the client's own image, cleaned into gold line art.
  It was not redrawn, because the mantras must stay faithful.
- Backgrounds change per event. Symphony Night is the only dark one.

## Still placeholder

- Family names on the formal invitation and the closing card
- The invocation line, currently "शुभ विवाह"
- All venues. Every map button points to a dummy Google Maps search for Surat.
- Dress codes and their colour swatches for the five events that have them
- Outfit sketches and reference photos
- The reply date, and the reply buttons, which do not save anything yet

## Open questions for the client

1. Is Rang and Rituals a haldi, a colour event, or both?
2. Is Symphony Night a sangeet with performances, or a live music night?
3. Which family hosts? The formal card currently names Ria first, as the hosts' daughter.
4. Is there a higher resolution scan of the Siddhchakra yantra? The current one is
   soft in the larger view.
5. Should there be background music? It needs a track from the client.
6. Real venues and Google Maps links for each event.

## Known limits

- **Phones.** Checked on emulated phones at 320, 360, 390 and 412 pixels wide with
  real touch input. It has not been checked on a physical phone. A status line at
  the very bottom of the page reports whether the 3D scene is running and how fast.
- **Fallback.** If 3D cannot start, the page shows a still picture of the pond and
  stays fully readable.
- **Performance.** The page lowers its own rendering quality when frames are slow.
- **The client's reference.** One video was supplied (a nine second save the date:
  stone urli with lotuses, a gold foil card, and a mandap). The Nimantran link the
  client shared could not be opened during this work.

## Related

- The invitation system (WhatsApp delivery, about 500 guests, access levels) is a
  separate piece of work. This page is only the front end.
- The live preview is published as a Claude artifact on the owner's Claude account.
