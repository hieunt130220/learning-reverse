import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Union

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
    home_dir: str = ""


def get_default_codex_homes() -> List[str]:
    homes: List[str] = []

    # 1. Standard ~/.codex
    std_home = os.path.abspath(os.path.expanduser("~/.codex"))
    if os.path.exists(std_home):
        homes.append(std_home)

    # 2. Orca shared runtime home
    orca_home = os.path.abspath(os.path.expanduser("~/Library/Application Support/orca/codex-runtime-home/home"))
    if os.path.exists(orca_home) and orca_home not in homes:
        homes.append(orca_home)

    # 3. Environment variable CODEX_HOME
    env_home = os.environ.get("CODEX_HOME")
    if env_home:
        env_abs = os.path.abspath(os.path.expanduser(env_home))
        if env_abs not in homes:
            homes.insert(0, env_abs)

    return homes


def _query_single_home(home_dir: str) -> List[BlockedSession]:
    history_db = os.path.join(home_dir, "thread_history_1.sqlite")
    state_db = os.path.join(home_dir, "state_5.sqlite")

    if not os.path.exists(history_db) or not os.path.exists(state_db):
        return []

    try:
        conn = sqlite3.connect(f"file:{history_db}?mode=ro", uri=True)
    except Exception:
        return []

    try:
        conn.execute(f'ATTACH DATABASE "file:{state_db}?mode=ro" AS state_db')
        cur = conn.cursor()

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
                    home_dir=home_dir,
                )
            )

        return results
    except Exception:
        return []
    finally:
        conn.close()


def get_blocked_sessions(codex_homes: Optional[Union[str, List[str]]] = None) -> List[BlockedSession]:
    if codex_homes is None:
        target_homes = get_default_codex_homes()
    elif isinstance(codex_homes, str):
        target_homes = [os.path.abspath(os.path.expanduser(codex_homes))]
    else:
        target_homes = [os.path.abspath(os.path.expanduser(h)) for h in codex_homes]

    by_thread: dict[str, BlockedSession] = {}
    for home in target_homes:
        sessions = _query_single_home(home)
        for s in sessions:
            if s.thread_id not in by_thread:
                by_thread[s.thread_id] = s
            else:
                # Keep the one with newer started_at
                existing = by_thread[s.thread_id]
                existing_time = existing.started_at or datetime.min.astimezone()
                new_time = s.started_at or datetime.min.astimezone()
                if new_time > existing_time:
                    by_thread[s.thread_id] = s

    results = list(by_thread.values())
    results.sort(
        key=lambda x: x.started_at or datetime.min.astimezone(),
        reverse=True,
    )
    return results
