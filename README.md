# Blitzdiagnose

**Aktuelle Version: 0.1.2**

Foto machen, KI analysiert es und gibt konkrete Tipps – ohne Kategorie-Vorwahl,
ohne Login.

## Idee

Foto von einem beliebigen Alltagsproblem (Haushalt, Technik, Garten,
Handwerk, Pflanzen/Tiere, Kochen, uvm.) aufnehmen, die KI erkennt selbst,
worum es geht, und gibt in Sekunden eine Einschätzung mit 3-6 konkreten
Tipps zur Lösung – inklusive Risiko-Hinweis, wenn Vorsicht geboten ist
(z.B. Strom, Gas, Gesundheit).

Ursprünglich als Ableger von [Sm@rtCraft](https://github.com/SchludeMarco/smartcraft-v2)
entstanden (gleiches Grundprinzip: Foto → KI-Diagnose → Tipps), aber bewusst
schlanker und ohne Kategorie-Vorwahl:

- **Kein Login, keine Historie, kein Firebase** – nur Foto → Analyse → Tipps
- **Keine Berufs-/Kategorie-Auswahl** – die KI erkennt das Thema selbst aus
  dem Foto statt einer Vorauswahl durch den Nutzer

Die Modellwahl (`gemini-flash-lite-latest`) und die Bild-Kompression vor dem
Versand übernehmen Erfahrungen, die in Sm@rtCraft bereits in Produktion
gemacht wurden (siehe dortiges README, "Entstehung & technische Hürden").

## Tech-Stack

- Vite + React 19 + Tailwind CSS 4
- `vite-plugin-pwa` (installierbar auf dem Homescreen, App-Shell-Caching)
- Eine Vercel-Serverless-Funktion (`api/analyze.js`) als Proxy vor der
  Gemini-API, damit der API-Key nie im Client-Code landet

## Lokal starten

```bash
npm install
cp .env.example .env
# GEMINI_API_KEY in .env eintragen
npm run dev
```

Die Vercel-Funktion (`api/analyze.js`) läuft lokal nur über `vercel dev`
(nicht über `vite dev` allein) - für reine UI-Arbeit reicht `npm run dev`,
für den vollen Foto-Analyse-Flow lokal `vercel dev` verwenden.

PWA-Icons aus `public/favicon.svg` erzeugen (einmalig bzw. nach Änderung des
Favicons):

```bash
npm run generate-pwa-assets
```

## Deployment (Vercel)

Benötigte Umgebungsvariable im Vercel-Projekt:

| Variable          | Zweck                                             |
|-------------------|----------------------------------------------------|
| `GEMINI_API_KEY`  | Server-seitiger Key für `api/analyze.js`           |

## Bekannte Einschränkungen

- **Kein persistentes Rate-Limiting.** `api/analyze.js` bremst Missbrauch nur
  best-effort pro warmer Vercel-Instanz (In-Memory-Zähler, 12 Anfragen/Minute
  und IP) - kein Zähler, der über mehrere Instanzen/Kaltstarts hinweg gilt.
  Für einen privaten/kleinen Nutzerkreis ausreichend; bei öffentlicher
  Verbreitung sollte hier nachgerüstet werden (z.B. Vercel KV/Upstash Redis
  für einen echten, geteilten Zähler).
- **Keine Historie.** Jede Analyse ist flüchtig; nach "Neues Foto" ist das
  Ergebnis weg. Kann bei Bedarf über `localStorage` ergänzt werden, ohne
  gleich ein Backend/Login zu brauchen.
