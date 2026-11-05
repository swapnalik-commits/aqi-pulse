# Brightspace Dropbox checklist

Upload this package to the course Dropbox **before** the due date, at least **15 minutes before 11:59 p.m. Newfoundland Time**. The cutoff uses CITL’s clock, not your laptop clock.

If the upload works, Brightspace sends a **confirmation receipt**. If you do not get that receipt, contact [CITL Support](https://www.citl.mun.ca/support). What is not uploaded cannot be marked.

## What is in this package

- The AQI Pulse website (`index.html`, `css/`, `js/`, `server.py`)
- How to run it (`README.md`)
- Research write-up so far (`docs/findings.md`) — Q1 and Q2 are answered; **Q3 (satellite delay, issue #11) is still blank**
- Design notes, tests, and the project proposal PDF
- GitHub: https://github.com/swapnalik-commits/aqi-pulse

## How a marker opens the site

```powershell
py server.py
```

Then open http://127.0.0.1:8000/

No NASA key is required for a preview. Live fire dots need a `MAP_KEY` in a local `.env` file. That file is **not** in this zip.

## Before you click Upload

- [ ] The Dropbox folder name matches the assignment instructions
- [ ] This zip is the file you meant to submit
- [ ] You still have time before 11:59 p.m. Newfoundland Time
- [ ] After upload, you can see the confirmation receipt
