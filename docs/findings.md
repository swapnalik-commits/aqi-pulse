# AQI Pulse: Findings

Answers to the three research questions from the project proposal.

## Q1. Do nearby fires and wind move with air quality? (issue #9)

### Short answer

**Sometimes, and only as a clue — not as proof.** When recent FIRMS detections sit roughly **upwind** of a place and the short-term AQI trend is **Worsening**, the dashboard picture matches the story people expect (smoke carried toward the city). The same pattern does **not** always hold: fires can appear with **Stable** air, wind can blow away from the detections, and AQI can worsen with **no** nearby hotspots on the map.

### How we checked it

We used the finished dashboard (issues #3–#8) for Los Angeles, Denver, and Seattle:

1. Count recent NASA FIRMS detections within about 275 km (or note DEMO SAMPLE when no `MAP_KEY` is set).
2. Read wind toward-direction and speed from Open-Meteo.
3. Count how many mapped fires sit roughly upwind of the selected place (bearing from fire → place within about 45° of the wind-toward direction).
4. Compare that with the short-term US AQI trend label and the last 24-hour chart.

We also refreshed the page after changing place, to confirm the three feeds redraw together.

### What we saw

| Picture on the page | What it suggests | How often it lined up |
|---|---|---|
| Fires upwind + AQI Worsening | Smoke may be arriving | Sometimes — the clearest “yes” cases |
| Fires nearby but not upwind + Stable/Improving | Hotspots exist, but wind is not aiming them at the city | Common |
| No nearby fires + AQI Worsening | Something else is driving the air (urban pollution, distant smoke, model noise) | Happens |
| DEMO SAMPLE fires | Layout test only | Not used as evidence for the science claim |

### Examples (how to read the page)

- **Supports the idea:** several live detections, wind arrow pointing from that cluster toward the city, and a Worsening badge with a rising chart. The “What changed” text then says some fires are upwind and air quality is worsening.
- **Does not support a simple link:** detections on the map, but the story says they are **not** clearly upwind, and AQI is Stable — fires alone are not enough.
- **Counterexample shape:** Worsening AQI with **zero** nearby FIRMS dots — the trend needs another explanation that day.

### Limits

- FIRMS dots are **satellite hotspots**, not confirmed fire perimeters, and they update on a delay (see Q3).
- Open-Meteo US AQI is a **model** product, not a local ground monitor.
- Wind is a single surface reading at the city; real smoke paths can be more complex.
- Demo mode must not be treated as real fire activity.
- Three cities and short live looks are enough to **illustrate** the relationship, not to prove it statistically across a season.

### What this means for the page

The map, wind arrow, and trend label should be read **together**. The “What changed” panel (issue #8) is written in past tense for that reason: it describes the current picture, not a forecast that fires plus wind will always make the air worse.

## Q2. Can the Worsening / Stable / Improving label be trusted? (issue #10)

### Short answer

**Partly.** The label is a correct description of the **last 3 hours**. As a hint about the **next** 3 hours, though, it is weak:

- **"Stable" can be trusted.** After a "Stable" label, the air stayed stable 89% to 99.8% of the time.
- **"Improving" is fairly safe.** After "Improving", the AQI did not go back up 80% to 88% of the time (in the places where it showed up often enough to judge).
- **"Worsening" is not a forecast.** After "Worsening", the AQI kept rising only about half the time (47% to 48%). It was still "Worsening" 3 hours later only 21% to 28% of the time. Big jumps often happen right at the peak of a smoke event, so by the time the label turns red, the worst may already be over.
- Overall the label matched the next 3 hours 78% to 99.5% of the time. But just saying "Stable" every hour would have scored slightly higher in every city, so the label has no real forecasting skill.

- **A shorter window works better.** When we tested 12 versions of the rule (below), comparing with **1 hour** ago instead of 3 made "Worsening" hold up 93% to 100% of the time. A 1-hour, 5-point rule was the only version that beat "always Stable".

**What this means for the page:** the label should be read as "what just happened", not "what will happen". That's why the page shows it as, for example, "Worsening (+12 AQI in the last 3 hours)". The "What changed" text (issue #8) should use the same past-tense wording.

### The rule being tested (issue #7, `js/trend.js`)

Compare the latest hourly US AQI with the value 3 hours earlier:

| Change in 3 hours | Label |
|---|---|
| more than +10 | Worsening |
| between −10 and +10 | Stable |
| less than −10 | Improving |

### How we checked it

For each place on the page, we downloaded 92 days of hourly US AQI from Open-Meteo (17 July to 17 October 2026, about 2,200 hours per city). Then, for every hour:

1. we worked out the label the page would have shown at that hour;
2. we looked at the AQI 3 hours later and applied the same rule to that change;
3. we counted the label as **"same next"** if both labels matched. We also used a looser test, **"direction held"**: after Worsening the AQI did not drop, after Improving it did not rise, after Stable it stayed within 10 points.

Anyone can repeat this with `node docs/backtest.js` (Node 18 or newer). It uses the exact same rule file as the page. The numbers will shift a little as the 92-day window moves.

### Results

| Place | Label | Times shown | Same label next 3 h | Direction held |
|---|---|---:|---:|---:|
| Los Angeles | Worsening | 4 | 0% | 0% |
| | Stable | 2,205 | 99.8% | 99.8% |
| | Improving | 3 | 0% | 100% |
| Denver | Worsening | 197 | 28% | 48% |
| | Stable | 1,829 | 89% | 89% |
| | Improving | 187 | 29% | 80% |
| Seattle | Worsening | 34 | 21% | 47% |
| | Stable | 2,138 | 98% | 98% |
| | Improving | 40 | 20% | 88% |

| Place | Hours checked | Label matched next 3 h | "Always Stable" would score |
|---|---:|---:|---:|
| Los Angeles | 2,212 | 99.5% | 99.7% |
| Denver | 2,213 | 78.5% | 82.6% |
| Seattle | 2,212 | 95.3% | 96.7% |

### Testing other versions of the rule

To check that we didn't just pick a lucky rule, we re-ran the test with 12 versions: looking back 1, 3, or 6 hours, with a threshold of 5, 10, 15, or 20 AQI points. These are the three cities pooled, about 6,600 hours. The current page rule is in **bold**.

| Look back | Threshold | Label matched next period | "Always Stable" would score | "Worsening" shown | Worsening: AQI kept rising | Improving: AQI kept falling |
|---|---:|---:|---:|---:|---:|---:|
| 1 h | 5 | **96.6%** | 95.5% | 151 | 93% | 96% |
| 1 h | 10 | 97.6% | 97.8% | 78 | 100% | 97% |
| 1 h | 15 | 99.0% | 99.2% | 33 | 100% | 94% |
| 1 h | 20 | 99.8% | 99.9% | 6 | 100% | 100% |
| 3 h | 5 | 84.9% | 86.2% | 452 | 62% | 82% |
| **3 h** | **10** | **91.1%** | **93.0%** | **235** | **47%** | **81%** |
| 3 h | 15 | 93.3% | 95.4% | 156 | 38% | 82% |
| 3 h | 20 | 94.5% | 96.6% | 114 | 38% | 84% |
| 6 h | 5 | 66.1% | 72.5% | 868 | 55% | 68% |
| 6 h | 10 | 78.8% | 86.2% | 454 | 35% | 61% |
| 6 h | 15 | 87.1% | 91.8% | 263 | 9% | 61% |
| 6 h | 20 | 90.5% | 94.0% | 207 | 5% | 62% |

What the table shows:

- **The longer you look back, the later the label is.** With a 6-hour window, by the time the label says "Worsening", the AQI has already started to fall 65% of the time at a 10-point threshold, and 91% to 95% of the time at 15 to 20 points. The smoke peak has passed.
- **A 1-hour window catches changes while they are still happening.** After a 1-hour "Worsening", the AQI kept rising 93% to 100% of the time.
- **1 hour with 5 points is the only rule that beats "always Stable"** (96.6% vs 95.5%). It still flags real changes often (151 times in 92 days across three cities). With 15 or 20 points the label almost never changes, which makes it useless.
- **Caveat:** US AQI changes smoothly from hour to hour, so a short window partly works because the next hour usually looks like the last one. It tells you "this is happening now", not a long-range forecast.

**Recommendation:** switch the page rule to **1 hour / 5 points**. It's a two-number change in `js/trend.js` (`hours: 1, threshold: 5`), and every part of the page, plus this test, reads from that file. We kept 3 hours / 10 points for now because issues #8 and #11 were written around it, so the team should agree on the change first.

### Examples (local time)

- **Right:** Seattle, 21 July, 6 PM. AQI went from 78 to 110 in 3 hours, so the label was "Worsening". Three hours later it was 135, so the air really did keep getting worse.
- **Wrong:** Seattle, 21 July, 8 PM. AQI went from 85 to 135, so the label was "Worsening". But that was the peak: 3 hours later it had already fallen to 114.
- **Wrong:** Denver, 17 July, 8 PM. AQI went from 50 to 61, so the label was "Worsening". Three hours later it was back down to 48.
- **Rare labels:** Los Angeles showed "Worsening" or "Improving" only 7 times in 92 days, so for LA the label is almost always "Stable". There are too few cases to judge the other two labels there.

### Limits

- Open-Meteo's air-quality values come from a forecast model, not from ground sensors, so this checks the label against the model's own history.
- US AQI for particles is based on longer averages, so it moves slowly. That's one reason "Stable" is so common, and why a 10-point jump is a big event.
- This is a single 92-day window (summer to early autumn) and only three cities. A different season or threshold could give different numbers.

## Q3. How does satellite delay affect the trend? (issue #11)

_To be added._
