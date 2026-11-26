# Airport Investment Agent: Design Document

## 1. Problem framing

if i was the investor i would take a lot of factors into account. for example 
1. Passenger traffic numbers are growing
2. Planes are mostly full
3. A new city is being built next to airport / business centers
4. Nearby airport closing
5. A new industrial zone is being built which will need cargo flights for factories
6. A different local airport is closing
7. Tourism is growing - the region is becoming a more popular tourist destination
8. There is a demand for more international flights but the infrastructure doesnt support the demand. + experiencing delays
9. Population growth in the area
10. There is cheap available land which makes growth easier
11. Environmental / weather factors. The neighboring airports are experiencing bad weather recently which delays flight

The goal of the agent is to help us identify airports where renovations will be most profitable based on increased flight and passenger capacity.

I would make the agent evaluate three main dimensions:

1. Existing demand: Is the airport already busy? Are flights full? Is passenger traffic growing?
2. Potential demand: Are there developments that could bring more passengers and airlines?
3. Capacity expansion potential: Can renovations realistically increase the number of flights and passengers, and at what cost?


At the end of the day the only public apis for information i can access is
Planes are full , passenger growth - BTS data has passengers and seats, so passengers ÷ seats = load factor 
Weather / delays - BTS records delays at this airport, including the cause 
I want to invest in a growing airport that is congested






## 2. Scoring methodology
### Factors and weights

I want to invest in a growing airport that is congested
I will have 4 factors

1. Growth 2023 vs 2025 years - 30%
    I chose 2025 because it's the latest full year of data.
    I chose 2023 because 2022 was still recovering from covid.
    I originally wanted to do the past five years but then it would start from 2020 the worst year becuase of covid and then the statistics would measure recovery from covid instead of real growth.
    Growth compares the total number of people who departed from a specific airport in 2023 and 2025.

2.  How full the planes are - load factor   - 35% (the biggest tell in my opinion)
    load factor = passengers ÷ seats, from yearly totals
    Biggest tell because this is the classic example of high demand. When flights are nearly always fully booked.

3.  Congestion (share of arrivals delayed 15+ min by NAS causes) - 15% 
    congestion = NAS-delayed arrivals ÷ all arrivals (2025)
    (it's complicated because a lot of delays can come from      
    irrelevant factors. What good is the api for delays has a reason why it was delayed so we only use the delays which are pertaining to the specific airport for example late arriving aircraft causing delay i dont think should be a factor but “airspace capacity’ should be) im only including delays from nas causes(NAS delays come from the airport and its airspace (operations, traffic, air traffic control, weather)), because that usually pertains to the geographic location of the airport while a flight that landed 15 minutes late and now created traffic can happen anywhere and its complete chance and it says nothing about this airports capacity 

4.  Scale (total passengers)  - 20%   (doubling the size of a very small airport isnt a good  
    opportunity for investment even though its growth would be multiplied because its still small)



### Normalization

The factors have different units so they cant be added directly so we need to normalize them (%, 0-1, millions of people) 

Regarding normalization we could use
1. Min max  (not good for this project because an extremely big airport wil ruin the statistics for the rest)

2. Percentile rank  (makes the most sense for this project. We rank airports by what position they are in compared to  all other airports in each factor and we score it according to its position.
Tradoff: i lose magnitude. For example if growth is 5% 6% and 30%. Even though 30 is much bigger than 5 and 6 it one rank above them only. )

3. Z score  (harder to explain to an analyst than beats X% of airports)

Step 1 of normalizaiton
For each factor sort all airports from lowest to highest. Each line gets a position (0,1,2,3…)

Step 2: divide each position by the last position (n-1), then × 100
Percentile = position / (number of airports -1) * 100


### Comparison group and missing data

Threshold: at least 100,000 departing passengers in 2025, which gives about 227 airports ranked
becuase below this threshhold growth is noise. for example in a tiny airport like cape cod(hya) +96% growth on only 34k passengers. one route can double a tiny airport

also all airports are ranked nationally even if the question is regional. 
so a question like "best in newengland" will give yo uthe best in new england but will also show its national rank

if a certain airport is missing data and missing one of the weights than the rest of the weights fill in for it in their correct ratio. and when the llm returns an airport like this it says confidence level medium. if two + weights are missing confidence is low.

### Decisions that changed during design

If runways are the bottleneck, a bigger terminal won't add capacity. Question 1 is about terminal expansion, so the score focuses on terminal investment. (If the investment scope included airfield work, runway / flight ratio could be added as a factor.")

the higher the congestion the higher the score. its counter intuitive but in our case we are looking for airports that have high congestion because thats where i want to invest and make more flights possible


## 3. Data sources

Passengers, seats, departures, international passengers, freight (2023 + 2025) | BTS T-100 Segment Summary by Origin Airport | **Public API** (data.transportation.gov, SoQL query)
Airport name, state, coordinates | OurAirports | Public CSV, downloaded by the ingest script
Delays by cause (2025) | BTS Airline On-Time Statistics & Delay Causes | Official file, downloaded once (BTS has no API for it)

**Why BTS**
- It's the official US government source. Airlines are legally required to report this data (form T-100).
- The FAA's own passenger statistics are built from the same data.
- Free, no API key, covers every US airport.
- The API can sum the data for me (SoQL `sum` + `group by`), so I download ~2,600 rows instead of 136,000.

**Why not commercial aviation APIs** (AviationStack, FlightAware, OpenSky)
- They track flights and planes ("where is flight X now?"), not passengers and seats.
- I need "how many people fly from here and how full are the planes", which only BTS has.
- Cirium / OAG have this kind of data but are expensive enterprise products.

**Why OurAirports**
- The BTS data has no state column, so I can't filter "New England" without it.
- I join the two on the airport code.

T-100 Segment route file for flight routes for distances

**Why a cached snapshot instead of calling the API on every question**
- The data is historical (2023, 2025) and doesn't change.
- Ranking needs all airports at once (percentiles compare every airport), so live calls per question would be slow.
- The app keeps working even if a government API is down during a demo.
- The snapshot (`data/airports.json`) is committed to git with its creation date, so anyone can run the app right away and get the same results.

**Why a downloaded file for delays**
- BTS doesn't offer delay causes through an API. I used their official download and documented it.
- I used the API wherever one existed. This is the only exception.


## 4. Where and how AI is used
<!-- What does the LLM do? (understands the question, picks tools, explains, states uncertainty)
     What does it NOT do? (compute numbers)
     The 3 tools and what each is for.
     Guardrails: system prompt rules, max steps, tool calls shown in the UI.
     How you used AI while building it. -->

this is the flow
the user sends a prompt.
it goes to endpoint which feeds it to the llm.
the llm understands the question, then goes to its available tools, it thinks on its own what tools are relevant for this task.
its a loop so the llm can call multiple tools and think in between
the llm explains his decisions and choice of tools and reasoning.
i made sure if the llm is uncertain it should say its uncertain instead of making up numbers


i made sure the llm will never compute or calculate numbers. all numbers come from determenistic functions, so the same tool / function call
always returns the same scores. the wording of the explanation can change between runs but the numbers dont

i made three tools 
rank_airports - ranks airport by score, can filter by states
get_airport - all data for one airport
compare_airports - the same data for two to five airports side by side

i made gurdrails 
System prompt rules - get every number from tools, never invent. label general knowledge. 
The known limitations are written into the prompt (no long-haul data, NAS delays include weather, etc.), so the agent admits them instead of guessing
max 6 tool steps so the llm wont loop forever
tool calls are shown in the ui above each answer so the user can see which tool was called
Input validation: max 30 messages, 4,000 characters each, plain-text user/assistant messages only, so tool results can't be forged by the client
Prompt rules against injection; the main protection is that the agent only has read-only tools(least privelage)



The frontend sends the whole conversation each time, and the backend doesn't store anything. That's how follow-up questions work ("what if growth mattered twice as much?")


i used ai coding assistants to speed up the coding process
all the design decisions were mine, the factors, weights, percentiles, data source and the caching approach


## 5. Key tradeoffs

1. **Fetch data once and save a snapshot, instead of calling the API on every question**
   - Why: the data is historical and doesn't change; ranking needs all airports at once; the app works even if the API is down.
   - Gave up: data isn't live; new data needs re-running `npm run ingest`.

2. **JSON file in memory, instead of a database**
   - Why: the data is read-only and small (~1,200 airports). A database adds setup and nothing else.
   - Gave up: wouldn't scale to much larger data.

3. **Percentile ranks, instead of min-max or z-scores**
   - Why: big outliers like Atlanta can't squash the other airports, and "higher than X% of airports" is easy to explain.
   - Gave up: magnitude is lost; only the order counts.

4. **National comparison group (100k+ passengers), instead of ranking only within the asked region**
   - Why: "best in New England" can't hide "mediocre nationally," and small airports' growth is noise.
   - Gave up: airports under 100k passengers aren't ranked.

5. **Fixed default weights that can be overridden, instead of letting the LLM decide weights**
   - Why: results are consistent and explainable, and analysts can still test "what if" scenarios.
   - Gave up: the weights are my judgment, not proven.

6. **LLM explains and code computes, instead of the LLM analyzing the data itself**
   - Why: numbers are reliable and testable; no invented figures.
   - Gave up: the agent can only answer what the tools support.

7. **Proxies for "unmet demand" (load factor, growth, delays), instead of claiming a direct measure**
   - Why: unmet demand can't be observed directly, and saying so is more honest.
   - Gave up: answers are estimates, not facts.



## 6. Assumptions and limitations

### Assumptions
1. **Passengers = departing passengers only** (people boarding at this airport). That's about half of the airport's total traffic, but it's counted the same way for every airport, so comparisons stay fair.
2. **US states only.** Territories like Puerto Rico (San Juan) and foreign airports are excluded.
3. **Growth = 2025 vs 2023**, the latest full year compared with the first year after COVID recovery.
4. **Higher congestion means a better investment opportunity**, because strain shows capacity is needed. Someone could argue the opposite (congestion = operational problems), so this is a deliberate choice.
5. **The score ranks relative opportunity.** It does not estimate financial return or construction cost.

### Limitations
1. **Unmet demand can't be measured directly.** The agent estimates it with proxies (full planes, growth, delays) and says so.
2. **Delay data only covers the larger airlines** (those required to report on-time data). Airports without it are scored on the other three factors and marked lower confidence.
3. **Gate and terminal capacity aren't publicly available**, which would be the most direct signal of terminal strain.
4. **The data is a snapshot.** It doesn't update by itself (the creation date is stored in the file).

### Not modeled (relevant, but no reliable public data per airport)
From my original list of what would make an airport worth renovating:
- New cities or business centers being built nearby
- New industrial zones needing cargo flights
- Nearby airports closing
- Tourism growth in the region
- Population growth (Census data exists, but matching it to airports would take more time)
- Land availability and construction cost

## 7. Example questions

Question 1
Which airports in New England are strong candidates for terminal expansion?
the llm translated new england into a list of states that make up new england
The rank_airports tool answer this question takes everything into account and can take a list of states

Question 2
Compare LA and Santa Ana airport congestion levels.
la is ambigous so the llm assumes its lax
This simply call to compare_airports tool with la and stanta ana

Question 3
What is the percentage of long haul flights out of Anchorage airport?
tool get_long_haul_share with anc
cant be answered accurately. the data only has the average flight distance and not each routes distance
The agent says so and gives what is known instead: international passenger share and freight volume.
What would fix it: route-level BTS data (each route with its distance), then count flights above a threshold (e.g. 3,000 miles).


Question 4
What is the unmet flight demand in SFO airport and why?
tool get_airpot with sfo
This is interesting. I can try to understand but i cant be certain because there is no definitive answer. So the ai will have reply with factors that could be relevant (load factor, growth, and congestion) but to say that it cant know the exact reason


## 8. Glossary
## 8. Glossary

1. **Load factor:** passengers ÷ seats. How full the planes are. 82% means 82 of every 100 seats were filled.
2. **Percentile:** the share of ranked airports this airport is higher than, from 0 to 100. "Load factor percentile 87" means fuller planes than 87% of ranked airports. Higher is better.
3. **Rank:** position in the sorted list. 1 is best. **Not the same as a percentile**: rank 16 is near the top, while percentile 16 is near the bottom.
4. **Score (Expansion Score):** 0 to 100. The weighted sum of an airport's four percentiles.
5. **Contribution:** percentile × weight. How many points one factor adds to the score. All contributions add up to the score.
6. **Growth:** change in departing passengers from 2023 to 2025, e.g. +15% (a speed).
7. **Scale:** total departing passengers in 2025 (a size).
8. **Congestion:** share of arriving flights delayed 15+ minutes by NAS causes.
9. **NAS (National Airspace System) delay:** a delay caused by the airport and its airspace: airport operations, heavy traffic, air traffic control, non-extreme weather. Delays caused by the airline or a late-arriving plane are not included.
10. **Comparison group:** the ~227 US airports with at least 100,000 departing passengers in 2025. Only these are ranked.
11. **Confidence:** high = all factors have data; medium = one factor missing; low = two or more missing.
12. **BTS (Bureau of Transportation Statistics):** part of the US Department of Transportation. The main data source.
13. **T-100:** the traffic report every airline must file with the US government (passengers, seats, flights per route).
14. **Departing passengers (enplanements):** people boarding flights at an airport.
15. **Tool (tool calling):** a function the LLM can ask the backend to run. The LLM chooses the tool and its arguments; my code runs it and returns the result.


