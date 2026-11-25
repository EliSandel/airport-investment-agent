Problem framing

The thesis: invest where demand pressure and capacity strain exist together
"Unmet demand" can't be measured directly, only estimated with proxies


Scoring

The four factors, their weights, and why each one is there
Why percentiles (vs min-max: outliers; vs z-score: harder to explain), and the tradeoff (magnitude is lost)
Comparison universe: ≥ 100k passengers, ranked nationally, and why
Missing data: re-scale weights + mark lower confidence
Changes made during design: dropped flights-per-runway (terminal ≠ runway), congestion = NAS delays only, load factor weight raised
Load factor from yearly sums, not by averaging monthly %



Data

BTS API as the main source, and why (official, free, no key, full coverage, server-side aggregation)
Why not the commercial APIs (they track flights, not passengers/seats)
OurAirports added because BTS has no state column
2023 vs 2025 for growth (COVID distortion)



Architecture

TypeScript stack (fluency, ownership)
No database (read-only data, fits in memory)
Ingest → cache → serve, instead of live calls per question, and the three reasons
Snapshot committed to git (reproducible, reviewers can run immediately)
Ingestion = facts, scoring = formulas
LLM never computes; it calls tools and explains
Minimal dependencies (declined observe; csv-parse instead of a homemade parser)



Assumptions & limitations

Passengers = departing only (about half of traffic, consistent across airports)
US states only (territories like San Juan excluded)
Average distance can't give "% long-haul"
Anchorage is mainly a cargo hub, so long-haul needs a passenger vs. all-flights distinction
Out of scope: your signals with no public data (developments, land, closures, tourism)



Open questions

Delay data source (congestion)
Route-level data (long-haul)
Long-haul threshold definition



international share is computed for context, not scored, because we have no evidence it predicts terminal ROI on its own

the disabled vs. missing distinction, and that weights are normalized so analysts can give relative weights

With congestion disabled, the score favors growing mid-size airports; adding delay data would likely raise congested hubs like BOS

stateless backend, history sent by the client. Simple, but long conversations grow the request size.


MAX_STEPS guardrail; tool errors returned to the model instead of crashing; tool calls shown in the UI for transparency; only text history is kept between turns, so follow-ups re-call tools, which is simpler and always uses fresh data


the congestion question is answered only with proxies because delay data isn't loaded; priority #1 for extension

separating tool data from model knowledge in answers

Weights are configurable, so the agent can run sensitivity analysis; robust picks (PWM) stay on top across weightings