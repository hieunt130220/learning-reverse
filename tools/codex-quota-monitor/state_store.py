import json
import os
import tempfile
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class StateStore:
    def __init__(self, path: Optional[str] = None) -> None:
        if path is None:
            codex_home = os.environ.get("CODEX_HOME", os.path.expanduser("~/.codex"))
            self.path = os.path.join(codex_home, "quota_monitor_state.json")
        else:
            self.path = os.path.abspath(path)

        self._ensure_storage_dir()
        self.state: Dict[str, Any] = self._load()

    def _ensure_storage_dir(self) -> None:
        parent_dir = os.path.dirname(self.path)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)

    def _load(self) -> Dict[str, Any]:
        if not os.path.exists(self.path):
            return {"processed_turns": {}}
        try:
            with open(self.path, "r", encoding="utf-8") as fp:
                data = json.load(fp)
                if isinstance(data, dict) and "processed_turns" in data:
                    return data
                return {"processed_turns": {}}
        except Exception:
            return {"processed_turns": {}}

    def _save(self) -> None:
        self._ensure_storage_dir()
        parent_dir = os.path.dirname(self.path)
        tmp_fd, tmp_path = tempfile.mkstemp(dir=parent_dir, prefix="state_", suffix=".tmp")
        try:
            with os.fdopen(tmp_fd, "w", encoding="utf-8") as fp:
                json.dump(self.state, fp, indent=2, ensure_ascii=False)
            os.replace(tmp_path, self.path)
        except Exception:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            raise

    def is_turn_processed(self, turn_id: str) -> bool:
        return turn_id in self.state.get("processed_turns", {})

    def get_processed_info(self, turn_id: str) -> Optional[Dict[str, Any]]:
        return self.state.get("processed_turns", {}).get(turn_id)

    def mark_turn_processed(
        self,
        turn_id: str,
        thread_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()
        info: Dict[str, Any] = {
            "thread_id": thread_id,
            "processed_at": now_iso,
            "status": "resumed",
        }
        if metadata:
            info.update(metadata)

        if "processed_turns" not in self.state:
            self.state["processed_turns"] = {}

        self.state["processed_turns"][turn_id] = info
        self._save()
