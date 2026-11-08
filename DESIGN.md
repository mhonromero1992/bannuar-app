# DESIGN.md · Bannuar employee app

The app carries the website's and the portal's identity (their DESIGN.md files) onto the phones of
about 4,000 guards: low-end Android phones on prepaid data, read on night shifts and under the noon
sun. Every decision has its reason in one line.

## Who it is for

| | |
|---|---|
| Who | Security guards, lady guards, detachment commanders and inspectors; some office staff with an employee number |
| Where | At the post, often outdoors or at night; at home on a shared phone |
| Phones | Mostly Android, often entry level, small screens, large system font sizes, prepaid mobile data |
| What they come for | The payslip on pay day, filing leave, acknowledging a memo, a certificate for a bank, a license about to expire |

## Identity

| Decision | Reason |
|---|---|
| The badge, as Bannuar's own PNG, on night: splash, sign-in band, Home band, app icon | The website's rule: never redraw the logo. The vector original is still needed for a crisp icon |
| Night band (`#0b1626`) at the top of Home and the sign-in screens, khaki ground (`#f6f3ec`) below | The badge's night as the frame, like the portal's sidebar; long reading on a light ground |
| One accent, Bannuar red (`#c4161c`), for the one main action of a screen | The eye finds the thing to do; secondary actions are outlined, links are text |
| The gold beacon marks the active tab, unread items, the item a notification opened, and empty states | The website's identity motif: one light, one guard on duty |
| Archivo in five cuts: expanded bold for titles, condensed capitals for section labels, regular body | One family like a uniform, the same as the website and portal; contrast from width, not a second font |
| Status colours with fixed meanings, the portal's: green done, gold waiting, red needs action or declined, blue information, grey closed | HR and guards read the same states the same way |
| Status words copied from the portal (`src/config/labels.ts`, tested against the portal's file) | "With the commander", "With HR", "Not approved": the same words on both sides |
| No gradients, no glass | A working tool used in daylight; nothing that costs battery or contrast |

## Reading in the sun and at night

| Decision | Reason |
|---|---|
| Body text 16sp, nothing that carries information under 14sp | Readable at arm's length on a small screen |
| Text follows the phone's font size; tab labels and counts cap at 1.35× | Guards who set large text keep it; the bar does not break |
| Every pair of text and ground at 4.5:1 or more, light and dark, computed in a test (`__tests__/theme.test.ts`) | WCAG AA, and it holds in sunlight; the portal's faint grey (4.15:1) is never used for text |
| Dark scheme follows the phone: night grounds, pale text, gold links | Night shifts; red never carries text on night (3:1), it stays a shape (the button) |
| Every control at least 48dp tall; rows 56dp | Gloved or tired fingers, one hand on a phone |
| Dates as day, month by name, year; shown back as "Friday, 20 Nov 2026" | No 08/11 versus 11/08 confusion; no calendar to scroll back forty years for a birthdate; works with a screen reader |
| Amounts with tabular figures, "₱1,234.56"; dates "8 Nov 2026"; mobiles "0917 123 4567" | The formats the prompt and the portal use, written by hand so every Android version prints the same |

## Plain words

| Decision | Reason |
|---|---|
| Buttons name the action: "File leave", "Request a certificate", "Send to HR", "I acknowledge" | People know what happens before they tap |
| The database's own refusals are shown as written ("There is already leave filed on some of these days") | They are already written for people; the app adds none of its own codes |
| Activation answers one message for any mismatch | Nobody learns which of the three facts was wrong |
| No invented data: no HR phone number, no testimonials, no sample figures outside `seed-demo.sql` | Nothing on screen that Bannuar has not confirmed |
| English first; Filipino to confirm | Short words now, a translation once Bannuar says so |

## Every screen has four states

| State | What it shows | Reason |
|---|---|---|
| Loading | A spinner and "Loading…" | Nothing looks finished while it is still coming |
| Empty | The gold light, a plain line, and the action that fills it ("File leave") | An empty list explains itself |
| Error | What went wrong in plain words and "Try again" | The guard can do something about it |
| Offline | What was loaded last, under "Offline · updated 8 Nov 2026, 2:05 PM" | Posts often have weak signal; last cutoff's payslip is still useful |

## Privacy you can see

| Decision | Reason |
|---|---|
| Net pay hidden ("₱ ••••••") until tapped, on Home, the list and the payslip | Payslips are opened in guardhouses and jeepneys |
| Government numbers masked until tapped, fetched each time, never saved on the phone | The fewer copies of an SSS or TIN number, the better (RA 10173) |
| No screenshots on the payslip and government number screens (Android `FLAG_SECURE`); iOS covers the app in the app switcher | A screenshot travels further than the screen |
| Push text says "Your payslip is ready", never the amount | Lock screens are public |
| App lock off by default, the phone's own fingerprint, face or PIN | Shared phones exist; a second PIN to forget would send guards to HR |
| Sign-out deletes everything the app kept | A phone handed to the next guard keeps nothing of the last |

## Speed on a cheap phone and prepaid data

| Decision | Reason |
|---|---|
| Hermes, ARM-only builds, one APK per processor type for hand installs | Faster start, half the download |
| Fonts subset to Latin and ₱ (51 KB each), icons as small SVG paths, splash and icons palette-compressed | A small APK on prepaid data |
| Home loads in parallel requests that each ask only for the guard's own rows; pictures load only when an announcement is opened | Little data per screen |
| The splash stays until the first real screen is drawn | No flash of an empty screen on a slow phone |

## Layout

| Decision | Reason |
|---|---|
| Four tabs: Home, Payslips, Leave, More; a bell on Home | The three things guards open most, everything else one tap away |
| A label under every tab icon | Icons alone are guessed at |
| One idea per screen, one column, details on their own screen | Small screens and large text |
| Forms keep their main button pinned at the bottom | It stays reachable above the keyboard |
