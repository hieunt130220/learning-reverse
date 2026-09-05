"""Shared provenance rules for verified transferred Phase 2 artifacts."""
from __future__ import annotations

import re


_GIT_REVISION = re.compile(r"^[0-9a-f]{40}$")
_TRANSFER_COMPATIBLE_REVISIONS = {
    "aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288": frozenset({
        "8ca1f93990dcd06a0b7d6ee6251100e67a155365",
    }),
}


def revision_matches_recorded(current: str, recorded: object) -> bool:
    """Accept equality or one explicitly approved current-to-recorded pair."""
    return (
        isinstance(recorded, str)
        and _GIT_REVISION.fullmatch(current) is not None
        and _GIT_REVISION.fullmatch(recorded) is not None
        and (
            current == recorded
            or recorded in _TRANSFER_COMPATIBLE_REVISIONS.get(current, ())
        )
    )
