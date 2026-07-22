#!/usr/bin/env python3
"""Extract talk records from the organizer's xlsx into public data/talks/*.yaml.

Source xlsx stays private (OneDrive, never committed). This script is the
repeatable step: rerun after every xlsx edit, then commit the regenerated yaml.

Usage:
    python3 scripts/extract_talks.py [--source PATH] [--sheets 2026,2026-online]
"""
import argparse
import re
import sys
from datetime import date
from pathlib import Path

import openpyxl
import yaml

DEFAULT_SOURCE = (
    "/Users/ccenedese/Library/CloudStorage/OneDrive-DelftUniversityofTechnology/"
    "TU Delft/00.Doc/05.DCSC/03.lunch colloquium & poster/06.Website/DCSC_colloquia/"
    "01.Colloquia organization/Lunch colloquia version_v1.xlsx"
)
DEFAULT_SHEETS = ["2026", "2026-online"]
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "talks"
SLIDES_DIR = Path(__file__).resolve().parent.parent / "static" / "slides"
SLIDES_EXTENSIONS = [".pdf", ".pptx", ".ppt"]
AVATARS_DIR = Path(__file__).resolve().parent.parent / "static" / "avatars"
AVATAR_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]

HEADER = [
    "date", "location", "time", "speaker", "gp", "role", "affiliation",
    "status_raw", "title", "abstract", "tags_raw", "bio", "pic", "video",
    "notes", "youtube_url",
]

YT_ID_RE = re.compile(r"(?:youtu\.be/|v=)([A-Za-z0-9_-]{6,})")


def slugify(text):
    text = re.sub(r"[^\w\s-]", "", text or "").strip().lower()
    return re.sub(r"[\s_]+", "-", text)


def youtube_id(url):
    if not url:
        return None
    match = YT_ID_RE.search(url)
    return match.group(1) if match else None


def clean(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def clean_or_tbd(value):
    return clean(value) or "TBD"


def find_slides(talk_id):
    """Convention over configuration: drop static/slides/<talk-id>.pdf (or .pptx/.ppt)
    to attach slides — no yaml editing needed, this just picks it up on next run."""
    for ext in SLIDES_EXTENSIONS:
        candidate = SLIDES_DIR / f"{talk_id}{ext}"
        if candidate.exists():
            return f"/slides/{candidate.name}"
    return ""


def find_avatar(speaker):
    """Drop static/avatars/<speaker-slug>.jpg (or .jpeg/.png/.webp) to attach a photo.
    Keyed by speaker, not talk id, so one photo covers every talk by that person."""
    slug = slugify(speaker)
    if not slug:
        return ""
    for ext in AVATAR_EXTENSIONS:
        candidate = AVATARS_DIR / f"{slug}{ext}"
        if candidate.exists():
            return f"/avatars/{candidate.name}"
    return ""


def parse_sheet(ws, mode):
    talks = []
    seen_ids = set()
    for row in ws.iter_rows(min_row=4, values_only=True):
        cells = row[1:1 + len(HEADER)]
        record = dict(zip(HEADER, cells))
        if not record.get("date"):
            continue  # no date at all: not a real slot
        if not clean(record.get("speaker")):
            continue  # date-only placeholder: blank/skipped week, not a real slot

        talk_date = record["date"].date() if hasattr(record["date"], "date") else record["date"]
        tags = [t.strip() for t in (record.get("tags_raw") or "").split(",") if t.strip()]
        yt_url = clean(record.get("youtube_url"))

        base_id = f"{talk_date.isoformat()}-{slugify(record.get('speaker')) or 'tbd'}"
        talk_id = base_id
        suffix = 2
        while talk_id in seen_ids:
            talk_id = f"{base_id}-{suffix}"
            suffix += 1
        seen_ids.add(talk_id)

        talks.append({
            "id": talk_id,
            "date": talk_date.isoformat(),
            "time": clean(record.get("time")),
            "mode": mode,
            "location": clean_or_tbd(record.get("location")),
            "speaker": clean_or_tbd(record.get("speaker")),
            "affiliation": clean_or_tbd(record.get("affiliation")),
            "role": clean_or_tbd(record.get("role")),
            "title": clean_or_tbd(record.get("title")),
            "abstract": clean_or_tbd(record.get("abstract")),
            "bio": clean_or_tbd(record.get("bio")),
            "tags": tags,
            "youtube_url": yt_url,
            "youtube_id": youtube_id(yt_url),
            "status": "past" if talk_date <= date.today() else "upcoming",
            "notes": clean(record.get("notes")),
            "links": {"scholar": "TBD", "homepage": "", "verified": False},
            "slides_url": find_slides(talk_id),
            "avatar_url": find_avatar(record.get("speaker")),
        })
    return talks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=DEFAULT_SOURCE)
    parser.add_argument("--sheets", default=",".join(DEFAULT_SHEETS))
    args = parser.parse_args()

    source = Path(args.source)
    if not source.exists():
        sys.exit(f"xlsx not found: {source}")

    wb = openpyxl.load_workbook(source, data_only=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_talks = []
    for sheet_name in args.sheets.split(","):
        if sheet_name not in wb.sheetnames:
            print(f"skip: sheet '{sheet_name}' not found", file=sys.stderr)
            continue
        mode = "online" if "online" in sheet_name else "in-person"
        talks = parse_sheet(wb[sheet_name], mode)
        out_path = OUTPUT_DIR / f"{sheet_name}.yaml"

        existing = {}
        if out_path.exists():
            prior = yaml.safe_load(out_path.read_text()) or {}
            existing = {t["id"]: t for t in prior.get("talks", [])}

        for talk in talks:
            prior_talk = existing.get(talk["id"])
            if prior_talk and prior_talk.get("links"):
                talk["links"] = prior_talk["links"]

        out_path.write_text(yaml.safe_dump(
            {"talks": talks}, sort_keys=False, allow_unicode=True, width=100,
        ))
        print(f"wrote {out_path} ({len(talks)} talks)")
        all_talks.extend(talks)

    all_path = OUTPUT_DIR / "all.yaml"
    all_path.write_text(yaml.safe_dump(
        {"talks": all_talks}, sort_keys=False, allow_unicode=True, width=100,
    ))
    print(f"wrote {all_path} ({len(all_talks)} talks, combined)")


if __name__ == "__main__":
    main()
