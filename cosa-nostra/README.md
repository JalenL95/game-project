# Cosa Nostra: A Generational Saga

A single-file, browser-based mafia management game. Build a criminal dynasty that
survives generation after generation: launder your fortune, command your crew,
outmaneuver the Five Families, and stay one step ahead of the Feds.

## Play

Open `index.html` in any modern web browser. That's it — there is no build step,
no install, and no server required. (Tailwind and the web fonts load from a CDN,
so an internet connection gives the best visuals, but the game logic runs offline.)

To play locally with a server instead of opening the file directly:

```bash
cd cosa-nostra
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How to Play

- **Two economies.** Crime earns **Dirty Cash**; you must **launder** it into
  **Clean Cash** (via Front Businesses, or street washers at a 50% loss). Clean
  Cash buys influence, businesses, and your estate.
- **The City Map.** Buy rackets, post guards, and install modules. Rackets are
  your core income. Raid rivals to seize their turf.
- **Your crew.** Recruit associates; after 10 years they can be *made*. Promote
  them to Capo, Underboss, or Consigliere. Watch **Loyalty** — disloyal leaders
  can trigger a civil war.
- **Heat & the Feds.** Crime raises **Heat**. From 1970 (the RICO Era), Heat feeds
  the **Federal Case File**; at 100% you face a RICO trial. Bribe police, buy
  influence, or call in Favors to stay free.
- **Succession.** Your Don will die eventually — designate an **Heir** so the
  empire endures. New generations unlock permanent Legacy Perks.
- **Eras.** The Golden Age (1946), the Narcotics Boom (1960), and the RICO Era
  (1970+) each change the rules.

## Winning & Losing

- **Win:** be crowned **Boss of Bosses** at the Commission, or **flee to Sicily**
  a wealthy free man once the heat is unbearable.
- **Lose:** the family line ends with no heir, or the Feds convict everyone.

## Saving

Your progress saves automatically to the browser's `localStorage` at the start of
every year. Use **Continue Saga** from the main menu to resume.

## Tech

- Plain HTML + CSS + vanilla JavaScript in a single file (`index.html`).
- Styling via Tailwind (CDN) plus custom CSS; fonts from Google Fonts.
- No dependencies, no build tooling.
