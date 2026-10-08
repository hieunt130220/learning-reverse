import json
import os
import re
from datetime import datetime, timedelta
from typing import Optional


def _parse_rollout_file(rollout_path: str) -> Optional[datetime]:
    if not os.path.exists(rollout_path):
        return None

    try:
        with open(rollout_path, "r", encoding="utf-8", errors="replace") as fp:
            # Read last 150 lines efficiently
            fp.seek(0, os.SEEK_END)
            file_size = fp.tell()
            buffer_size = min(file_size, 128 * 1024)  # 128 KB
            fp.seek(file_size - buffer_size)
            lines = fp.readlines()

        for line in reversed(lines):
            if "rate_limits" not in line or "resets_at" not in line:
                continue
            try:
                data = json.loads(line.strip())
                payload = data.get("payload", {})
                rate_limits = payload.get("rate_limits", {})
                primary = rate_limits.get("primary") or {}
                resets_at = primary.get("resets_at")
                if not resets_at:
                    secondary = rate_limits.get("secondary") or {}
                    resets_at = secondary.get("resets_at")

                if resets_at and isinstance(resets_at, (int, float)):
                    dt = datetime.fromtimestamp(resets_at).astimezone()
                    return dt
            except Exception:
                continue
    except Exception:
        pass

    return None


def _clean_ordinal_suffix(text: str) -> str:
    return re.sub(r"(\d+)(st|nd|rd|th)", r"\1", text)


def _parse_error_string(error_message: str, ref_time: Optional[datetime] = None) -> Optional[datetime]:
    if not error_message:
        return None

    if ref_time is None:
        ref_time = datetime.now().astimezone()

    # Pattern 1: Full date & time, e.g. "try again at Aug 20th, 2026 10:36 AM"
    match_full = re.search(
        r"(?:try again at|resets? at)\s+([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)",
        error_message,
        re.IGNORECASE,
    )
    if match_full:
        date_str = _clean_ordinal_suffix(match_full.group(1))
        for fmt in ("%b %d, %Y %I:%M %p", "%B %d, %Y %I:%M %p"):
            try:
                parsed = datetime.strptime(date_str, fmt)
                return parsed.replace(tzinfo=ref_time.tzinfo)
            except ValueError:
                continue

    # Pattern 2: Time only, e.g. "try again at 3:30 PM" or "try again at 12:49 PM."
    match_time = re.search(
        r"(?:try again at|resets? at)\s+(\d{1,2}:\d{2}\s+[AP]M)",
        error_message,
        re.IGNORECASE,
    )
    if match_time:
        time_str = match_time.group(1)
        try:
            t = datetime.strptime(time_str, "%I:%M %p").time()
            dt = datetime.combine(ref_time.date(), t).replace(tzinfo=ref_time.tzinfo)
            # If the calculated reset time was much earlier today (e.g. error at 11 PM, reset at 1 AM), roll over to tomorrow
            if dt < ref_time - timedelta(hours=2):
                dt += timedelta(days=1)
            return dt
        except ValueError:
            pass

    return None


def parse_reset_time(
    rollout_path: Optional[str] = None,
    error_message: str = "",
    reference_time: Optional[datetime] = None,
) -> Optional[datetime]:
    if rollout_path:
        rollout_dt = _parse_rollout_file(rollout_path)
        if rollout_dt:
            return rollout_dt

    return _parse_error_string(error_message, ref_time=reference_time)
