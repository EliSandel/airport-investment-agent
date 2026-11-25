# Airport Investment Intelligence Agent

A chat agent that helps analysts find US airports where **terminal expansion** is most likely to pay off.

It combines a **deterministic scoring model** (load factor, growth, scale, congestion) built on
US government aviation data with an **LLM agent** (Claude) that picks the right analysis and explains the results.
The LLM never computes numbers. Every figure comes from tested TypeScript code.

📄 **Design document:** [docs/DESIGN.md](docs/DESIGN.md) (scoring methodology, tradeoffs, where AI is used)

## Example questions

- Which airports in New England are strong candidates for terminal expansion?
- Compare LA and Santa Ana airport congestion levels.
- What is the percentage of long haul flights out of Anchorage airport?
- What is the unmet flight demand in SFO airport and why?
- Follow-ups, e.g. "What if growth mattered twice as much?"

## Tech stack

- **Backend:** NestJS (TypeScript), Anthropic SDK (Claude tool calling)
- **Frontend:** React + Vite (TypeScript)
- **Data:** BTS T-100 via the public Socrata API, OurAirports, BTS delay causes, stored as a JSON snapshot

## Running locally

**Requirements:** Node.js 20+ and an [Anthropic API key](https://console.anthropic.com).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Open `backend/.env` and set your key:
```
ANTHROPIC_API_KEY=your-key-here
ANTHROPIC_MODEL=claude-sonnet-5-5
```

Start the server (http://localhost:3000):
```bash
npm run start:dev
```

### 2. Frontend

In a second terminal:
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** and click one of the example questions.

## Data

The data snapshot (`data/airports.json`) is **committed to the repo**, so the app runs without fetching anything.
To rebuild it from the sources:

```bash
cd backend
npm run ingest
```

This calls the BTS public API and OurAirports, and reads the delay causes file from
`data/raw/Airline_Delay_Cause.csv` (downloaded from BTS, which offers no API for it).

## Tests

```bash
cd backend
npm test
```

Covers the scoring logic: percentile ranking, metrics, weighted scores, missing data handling.

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/chat` | Agent chat. Body: `{ "messages": [{ "role": "user", "content": "..." }] }` |
| `GET` | `/airports/rank?states=MA,CT&limit=5` | Ranking (national, optionally filtered by states) |
| `GET` | `/airports/:code` | All data and score breakdown for one airport, e.g. `/airports/SFO` |

## Project structure

```
backend/
  scripts/ingest.ts       data ingestion (BTS API + OurAirports + delay file)
  src/scoring/            deterministic scoring model + tests
  src/airports/           data loading, ranking and lookup services
  src/agent/              Claude agent: tools, system prompt, tool-calling loop
frontend/src/App.tsx      chat UI
data/airports.json        data snapshot
docs/DESIGN.md            design document
```

## Limitations

The score ranks **relative** opportunity from public data; it does not estimate financial return.
Unmet demand is estimated with proxies, long-haul share can't be computed from the available data,
and factors like local development plans or land availability aren't modeled.
See [docs/DESIGN.md](docs/DESIGN.md) for details.