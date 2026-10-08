import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from reset_parser import parse_reset_time


@dataclass
class BlockedSession:
    thread_id: str
    turn_id: str
    status: str
    error_message: str
    started_at: Optional[datetime]
    title: str
    cwd: str
    rollout_path: Optional[str]
    reset_time: Optional[datetime]


def get_blocked_sessions(codex_home: Optional[str] = None) -> List[BlockedSession]:
    if codex_home is None:
        codex_home = os.environ.get("CODEX_HOME", os.path.expanduser("~/.codex"))

    history_db = os.path.join(codex_home, "thread_history_1.sqlite")
    state_db = os.path.join(codex_home, "state_5.sqlite")

    if not os.path.exists(history_db) or not os.path.exists(state_db):
        return []

    conn = sqlite3.connect(f"file:{history_db}?mode=ro", uri=True)
    try:
        conn.execute(f'ATTACH DATABASE "file:{state_db}?mode=ro" AS state_db')
        cur = conn.cursor()

        # Get the latest turn for each thread where the status is 'failed' and error is usageLimitExceeded
        query = """
        WITH latest_turns AS (
          SELECT thread_id, turn_id, rollout_ordinal, status, error_json, started_at, completed_at,
                 ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY rollout_ordinal DESC) as rn
          FROM thread_turns
        )
        SELECT lt.thread_id, lt.turn_id, lt.status, lt.error_json, lt.started_at,
               t.title, t.cwd, t.rollout_path
        FROM latest_turns lt
        LEFT JOIN state_db.threads t ON t.id = lt.thread_id
        WHERE lt.rn = 1 AND lt.status = 'failed' AND lt.error_json LIKE '%usageLimitExceeded%'
        ORDER BY lt.started_at DESC;
        """

        cur.execute(query)
        rows = cur.fetchall()

        results: List[BlockedSession] = []
        for row in rows:
            thread_id, turn_id, status, error_json_str, started_at_ts, title, cwd, rollout_path = row

            error_msg = ""
            if error_json_str:
                try:
                    err_obj = json.loads(error_json_str)
                    error_msg = err_obj.get("message", "")
                except Exception:
                    error_msg = str(error_json_str)

            started_at_dt = None
            if started_at_ts:
                started_at_dt = datetime.fromtimestamp(started_at_ts).astimezone()

            reset_dt = parse_reset_time(
                rollout_path=rollout_path,
                error_message=error_msg,
                reference_time=started_at_dt,
            )

            results.append(
                BlockedSession(
                    thread_id=thread_id,
                    turn_id=turn_id,
                    status=status,
                    error_message=error_msg,
                    started_at=started_at_dt,
                    title=title or "(Untitled Session)",
                    cwd=cwd or "",
                    rollout_path=rollout_path,
                    reset_time=reset_dt,
                )
            )

        return results
    finally:
        conn.close()
