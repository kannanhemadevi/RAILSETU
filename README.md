# RAILSETU

RAILSETU is a React + TypeScript + Vite hackathon prototype for resilient railway journey planning. It demonstrates journey search, preference-based route comparison, synthetic risk context, and passenger management for up to five people.

## Important: synthetic demo data

Every station service schedule, disruption note, journey duration, and estimated fare in this project is synthetic demo data. The app does not connect to railway systems and does not provide live railway information, ticket availability, bookings, or operational advice.

## Run locally

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To build and preview the static site:

```sh
npm run build
npm run preview
```

## Project structure

- `src/types/journey.ts` — journey, passenger, and synthetic schedule types.
- `src/data/railway.ts` — local synthetic station, service, and disruption fixtures.
- `src/engine/planJourney.ts` — direct and up-to-two-transfer journey search and deterministic preference ranking.
- `src/engine/decisionEngine.ts` and `src/engine/transferFeasibility.ts` — hard constraints, passenger-specific transfer validation, explanations, and ranking.
- `src/engine/passengerLedger.ts` — simulated passenger-specific ticket/refund transitions, integer-paise amounts, and reconciliation.
- `src/engine/disruptionSimulator.ts` — deterministic synthetic delay event transitions.
- `src/components/RouteCard.tsx` — comparable selectable journey options.
- `src/App.tsx` — Journey Planner, Risk-aware Route Lab, and Passenger Management flows.
- `src/App.css` and `src/index.css` — responsive navy and teal interface styles.

## Ranking overview

The client-side planner finds direct paths and paths with up to two transfers through the local fixtures. Hard passenger, accessibility, schedule, and transfer constraints are evaluated before scoring; a rejected itinerary never becomes recommendable because of a low fare or score. The five configurable demo weights default to arrival-time risk 30%, connection risk 30%, fare 20%, confirmation uncertainty 10%, and optional accessibility preference satisfaction 10%. These illustrative defaults are not validated optimal weights.

Each factor is normalized to a 0–100 desirability score, then the weighted mean is calculated as `sum(normalized factor × weight) / sum(weights)`. Lower risk and uncertainty are inverted so lower risk scores higher; synthetic fare is min–max normalized within the feasible candidate set so the lower fare scores higher; equal fares score 100. Missing or invalid factor values receive a neutral 50. Only optional accessibility preferences are scored; mandatory accessibility and caregiver requirements remain hard constraints. Routes are ordered by score descending, then lower connection risk, fewer transfers, shorter journey, lower synthetic fare, and stable itinerary ID. No randomness or current-time tie-break is used. Every schedule, fare, feature, and risk value remains synthetic demo data.

## Checks

```sh
npm run build
npm run lint
npm test
```

## Deployment

The repository includes `netlify.toml` with these Netlify settings:

- Build command: `npm run build`
- Publish directory: `dist`
- SPA fallback: `/*` rewrites to `/index.html` with status 200, so direct refreshes on client-side paths return the app shell.
- Use Node.js 24.x and run `npm ci` before the build.

No deployment has been configured or performed from this repository. For another static host, use `npm run build`, publish `dist/`, and configure the equivalent SPA fallback. Any deployed copy should retain the synthetic-data notice; do not present it as a live railway planner.
