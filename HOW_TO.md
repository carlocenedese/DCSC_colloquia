# DCSC Colloquia — How-To Guide

Everything you need to maintain this site. Each task has two paths:
- **🤖 With Claude Code** — open a terminal in this folder, run `claude`, paste the prompt.
- **✋ Manually in VS Code** — the exact files and steps.

---

## How the site works (30-second version)

```
organizer xlsx (private, never committed)
        │  python3 scripts/extract_talks.py
        ▼
data/talks/*.yaml  (one file per xlsx sheet + all.yaml combined)
        │  hugo (runs automatically on git push, via GitHub Actions)
        ▼
published website
```

- **Source of truth for talk data** = the xlsx in `01.Colloquia organization/` (private, gitignored).
- **What the site actually reads** = `data/talks/all.yaml`.
- **Publishing** = `git push` to `main`. GitHub Actions builds and deploys automatically. No manual build step.
- Speaker photos: `static/avatars/<speaker-name-slug>.jpg` (also `.jpeg/.png/.webp`).
- Slides: `static/slides/<talk-id>.pdf` (also `.pptx/.ppt`).
- The pipeline picks both up **by filename convention** — no yaml editing needed.

---

## Add a new talk

### 🤖 With Claude Code

> Add the new talk(s) I just entered in the organizer xlsx to the website:
> run the extraction pipeline, check the output for warnings, and commit.

### ✋ Manually

1. Add the talk as a new row in the xlsx (`01.Colloquia organization/Lunch colloquia version_v1.xlsx`), in the sheet for its year (`2026` for in-person, `2026-online` for online). Fill the columns like the existing rows. Only **date + speaker** are strictly required — everything else can stay empty and shows as "coming soon".
2. In a terminal in this folder:
   ```bash
   python3 scripts/extract_talks.py
   ```
3. Read the output. `warn:` lines tell you about unmapped affiliations/roles/tags (see FAQ below).
4. Preview locally (optional): `hugo server -D`, open http://localhost:1313/
5. Publish:
   ```bash
   git add data/ static/
   git commit -m "data: add talk <speaker> <date>"
   git push
   ```
   The site updates itself ~1 minute after the push.

---

## Add a new **year** (e.g. the 2027 season)

Nothing to configure. Create a sheet named `2027` (and/or `2027-online`) in the xlsx, add rows, rerun the pipeline. Sheets named `YYYY` or `YYYY-online` are discovered automatically.

---

## Add a speaker photo

1. Save the photo as `static/avatars/<speaker-slug>.jpg` — the slug is the speaker's name, lowercase, spaces → dashes. E.g. *Nicolas Lanzetti* → `nicolas-lanzetti.jpg`. Accents are kept (`wendelin-böhmer.jpg`).
2. Rerun `python3 scripts/extract_talks.py` (it links the photo into the yaml).
3. Commit + push.

Talks without a photo show a generic placeholder automatically.

## Add slides to a talk

1. Find the talk's `id` in `data/talks/<year>.yaml` (format: `YYYY-MM-DD-speaker-slug`).
2. Save the file as `static/slides/<talk-id>.pdf`.
3. Rerun the pipeline, commit, push. The "Slides" download chip appears on that card automatically.

## Add a recording (YouTube link)

Paste the YouTube URL into the video/link column of the talk's row in the xlsx, rerun the pipeline, commit, push. The player embeds automatically in the talk's detail view.

---

## FAQ

### How do I add a new talk?
See [Add a new talk](#add-a-new-talk) above. Short version: row in xlsx → `python3 scripts/extract_talks.py` → commit + push.

### How do I run the data extraction pipeline?
```bash
python3 scripts/extract_talks.py
```
Requires `openpyxl` and `pyyaml` (`pip3 install openpyxl pyyaml` once). Defaults to the xlsx in `01.Colloquia organization/`; another file: `--source path/to/file.xlsx`. Only some sheets: `--sheets 2026,2026-online` (safe — `all.yaml` is always rebuilt from every yaml on disk, so partial runs never lose other years).

### How do I fix missing information (TBD title, abstract, bio…)?
Fill the empty cell in the xlsx, rerun the pipeline, commit, push. **Don't edit the yaml directly for these fields** — the next pipeline run would overwrite your edit. The yaml is generated output; the xlsx is the source.

**Exception:** the `links:` block (scholar / homepage) lives only in the yaml — the pipeline preserves it across runs. Edit it directly in `data/talks/<year>.yaml`:
```yaml
links:
  scholar: https://scholar.google.com/citations?user=...
  homepage: https://their-university-page.example
  verified: true
```
Then rerun the pipeline once (so `all.yaml` picks it up), commit, push.

### How do I update a broken link?
- **Scholar/homepage link in a talk's detail view** → edit the `links:` block in `data/talks/<year>.yaml` (see above), rerun pipeline, commit, push.
- **YouTube link** → fix the URL in the xlsx, rerun pipeline, commit, push.
- **Header/footer/About links** → they're hardcoded in `layouts/index.html`; edit there, commit, push.

### The pipeline printed `warn: no affiliation mapping for '…'`
The xlsx has an affiliation string the script hasn't seen. The site will show the raw string (works, just unpolished). To polish: add an entry to `AFFILIATION_MAP` in `scripts/extract_talks.py`:
```python
"Raw String From Xlsx": ("SHORT", "Full University Name — Department"),
```
Same idea for `warn: no role mapping` → `ROLE_CANON`.

### The pipeline printed `warn: dropping non-canonical tag '…'`
Only 4 research clusters are allowed on the site (Control and Learning / Modeling and System Identification / Optimization / Systems and Signal Analysis). Any other tag in the xlsx is dropped on purpose. If a variant spelling should map to one of the 4, add it to `TAG_CANON` in the script.

### A talk shows the wrong date/speaker or appears twice
The talk `id` is built from date + speaker. If you change either in the xlsx, the id changes — any manually-added `links:` for the old id won't carry over (re-add them), and any slides file named after the old id must be renamed.

### How do I preview the site before publishing?
```bash
hugo server -D
```
Open http://localhost:1313/ — live-reloads as you edit. Ctrl-C to stop.

### How do I publish changes?
```bash
git add -A
git commit -m "describe the change"
git push
```
GitHub Actions builds and deploys automatically (~1 min). Check the Actions tab on GitHub if the site didn't update.

### What must never be committed?
- `01.Colloquia organization/` (the private xlsx) — gitignored.
- `website_asset/` (raw design exports, unlicensed placeholder images) — gitignored, and deliberately kept **outside** `static/` so Hugo can never publish it.
Both are already covered by `.gitignore`; just don't force-add them.

### 🤖 Useful Claude Code prompts
- *"Rerun the talk extraction pipeline and fix any mapping warnings it prints."*
- *"Add scholar and homepage links for speaker X — here they are: …"*
- *"The talk on 2026-05-21 has new slides at ~/Downloads/slides.pdf — attach them."*
- *"Preview the site and check the newest talk renders correctly, then commit and push."*
