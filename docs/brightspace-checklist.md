# Brightspace Dropbox checklist

Upload the final package to the course Dropbox **before** the due date, at least **15 minutes before 11:59 p.m. Newfoundland Time**. The cutoff uses CITL’s clock, not your laptop clock.

If the upload works, Brightspace sends a **confirmation receipt**. If you do not get that receipt, contact [CITL Support](https://www.citl.mun.ca/support). What is not uploaded cannot be marked.

## Build the zip last

Do not zip the project for Dropbox yet. Make the zip only after the final version is on `main`:

- Q3 in `docs/findings.md` is answered (issue #11). It still says “To be added.” Finish that before any upload.
- The README includes a screenshot of the finished page (issue #18).
- The whole site has been smoke tested (issue #19).

The zip is the file a marker will open. It should be that finished copy, not an earlier snapshot.

## What goes in the zip

- The AQI Pulse website (`index.html`, `css/`, `js/`, `server.py`)
- How to run it (`README.md`)
- The research write-up (`docs/findings.md`), with Q1, Q2, and Q3 answered
- Design notes, tests, and the project proposal PDF
- GitHub: https://github.com/swapnalik-commits/aqi-pulse

Leave out `.env`. The NASA key stays on your computer.

## How a marker opens the site

On Windows, from the project folder:

```powershell
py server.py
```

On Mac:

```bash
python3 server.py
```

Then open http://127.0.0.1:8000/

No NASA key is required for a preview. Live fire dots need a `MAP_KEY` in a local `.env` file. That file is not in the zip.

## Before you click Upload

- [ ] Q3 is written in `docs/findings.md`
- [ ] Issue #18 (README screenshot) and issue #19 (smoke test) are done
- [ ] The zip was built after those, from the final version
- [ ] The Dropbox folder name matches the assignment instructions
- [ ] You still have time before 11:59 p.m. Newfoundland Time
- [ ] After upload, you can see the confirmation receipt
