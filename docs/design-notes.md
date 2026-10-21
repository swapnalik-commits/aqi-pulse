# Design notes: Air quality chart and trend label

Issues #4 and #7. Why the air-quality part of the page looks the way it does.

## Who it's for and what they need to do

Our proposal names parents, schools, outdoor workers, and people with breathing problems. They need to answer three quick questions:

1. **How is the air right now?** The "Now" value and the health message.
2. **Which way is it heading?** The trend label.
3. **Is this normal for today?** The 24-hour line.

The proposal points out that most tools show "a single AQI number with no real context". Every choice below is meant to add that context without making the page harder to read.

## Choices

| Choice | Why |
|---|---|
| **Line chart** of hourly AQI | This is a time series. Position along a shared axis is the most accurately read visual channel, and a connected line makes rises and falls easy to see. |
| **One line only** (US AQI) | The issue asked for one clear signal. Adding PM2.5, PM10, and ozone would mean four lines with different units, and that hurts the main task. |
| **Last 24 hours** | Long enough to show the daily pattern and today's change, short enough that each hour is still visible. |
| **Local time of the place** | "6 PM in Denver" is what a Denver parent means. Using the viewer's own clock would shift the line by hours. |
| **Y-axis starts at 0** | Small changes don't look dramatic. The top grows with the data (always at least 100), so a smoke spike stays in view. |
| **Faint official AQI color bands** | People can read "Good / Moderate / Unhealthy" without memorizing numbers. The colors are the official US EPA ones people already know. They're kept at 12% opacity so they sit behind the data instead of competing with it. |
| **Direct labels** (band names, "Now: 53") | No legend to look back and forth at. |
| **Plain-language health message** | Turns the number into a decision ("reduce long outdoor activity"), which is what the proposal's audience actually needs. The wording follows the US EPA / AirNow guidance for each level. |
| **Trend label: word + arrow + color** | The word carries the meaning. The arrow (↑ → ↓) means color-blind viewers don't have to rely on red vs green. The color is only a quick extra cue. |
| **Shaded "last 3 h" window and hollow dot** | Shows exactly which two readings the trend label compares, so the label and the chart tell one story and the label can be checked by eye. |
| **The number next to the label** ("+12 AQI in the last 3 hours") | Shows the evidence, and says plainly that the label describes the past, not a forecast (see `findings.md`, Q2). |
| **Hover a dot for the exact value** | Exact numbers are there when you want them without crowding the chart. |
| **Loading and error messages** | Live data can fail. The page says so instead of showing an empty box. |
| **Scales to the screen width** | The chart uses an SVG `viewBox`, so it shrinks to fit a phone without a sideways scroll. |

## The trend rule

`js/trend.js`: compare the latest AQI with the value 3 hours earlier. A rise of more than 10 points is **Worsening**, a fall of more than 10 is **Improving**, anything else is **Stable**. The rule lives in one file that the page and the reliability test (`docs/backtest.js`) both use, so they can never disagree. `findings.md` (Q2) tests this rule and 11 other versions, and recommends 1 hour / 5 points.

## Testing

- `node --test` runs the unit tests for the trend rule (`tests/trend.test.js`).
- `node docs/backtest.js` re-runs the reliability check on live data.
- Checked in a browser: all three places, a failed request, a request that never answers (gives up after 10 seconds), switching places quickly, and a phone-sized screen.
