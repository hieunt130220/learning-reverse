"""Unbiased manual labeling for Avatar fishing image matching (Giai đoạn A).

This module is the single integrity-critical component of the labeling pipeline:
*all ground truth derives from a human choosing, per query image, which reference
image it depicts.* The tool deliberately computes, suggests, or preselects **no**
mapping — it only records the human's choices, atomically.

Public surface
--------------
- :class:`LabelSession` — pure, UI-agnostic session state. Holds the human's
  choices as ``new_index -> img_index`` and exposes ``select``, ``previous``,
  ``next``, ``mark_ambiguous``, ``to_label``.
- :func:`main` — ``fishing-label`` console command: loads a manifest, restores an
  existing label if present, and opens the Tkinter labeling UI. The GUI writes the
  complete or ambiguous label atomically on demand.

Integrity guarantees (enforced exactly)
---------------------------------------
1. Restores existing choices when a label already exists for the batch.
2. Permits repeated ``img_index`` for different queries (many-to-one is VALID). No
   one-to-one constraint is enforced.
3. Rejects out-of-range indices: ``new_index`` must be a valid ``images_new``
   index; ``img_index`` must be a valid ``images`` index.
4. Requires every query (``images_new``) selected exactly once before a
   complete-save; otherwise refuses and reports what is missing.
5. ``mark_ambiguous()`` yields ``BatchLabel(status="ambiguous", matches=())`` and
   clears all selections.
6. Atomic writes: temp sibling + fsync + ``os.replace`` (delegated to
   :func:`fishing_ml.schema.atomic_write_json`); a partial label never persists if
   the process dies.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Mapping

from .schema import (
    SCHEMA_VERSION,
    BatchLabel,
    BatchManifest,
    LabelError,
    MatchLabel,
    atomic_write_json,
    load_label,
    load_manifest,
)

__all__ = [
    "LabelSessionError",
    "LabelSession",
    "label_path_for",
    "load_existing_label",
    "run_label_ui",
    "main",
]


class LabelSessionError(ValueError):
    """Raised for invalid session operations (out-of-range indices, incomplete)."""


def _valid_new_indices(manifest: BatchManifest) -> frozenset[int]:
    return frozenset(e.index for e in manifest.images_new)


def _valid_img_indices(manifest: BatchManifest) -> frozenset[int]:
    return frozenset(e.index for e in manifest.images)


class LabelSession:
    """UI-agnostic manual-labeling session.

    State is the human's *choices only*. ``selections`` maps each query image
    index (``images_new``) to the reference image index (``images``) the human
    picked. A query may be re-selected (its choice is simply overwritten); the
    same reference may be chosen for many queries (many-to-one is allowed).
    """

    def __init__(
        self,
        manifest: BatchManifest,
        existing: BatchLabel | None = None,
        *,
        start_index: int = 0,
    ) -> None:
        self.manifest = manifest
        self.selections: dict[int, int] = {}
        # ``current`` is a *position* into the images_new tuple (0-based), used for
        # Previous/Next navigation. Because manifest indices are contiguous from 0,
        # this position also equals the new_index at that slot.
        total = len(manifest.images_new)
        if total == 0:
            raise LabelSessionError("manifest has no images_new queries to label")
        if start_index < 0 or start_index >= total:
            raise LabelSessionError(f"start_index {start_index} out of range [0, {total})")
        self.current = start_index
        if existing is not None:
            self.restore(existing)

    # --- dataset introspection ------------------------------------------------
    @property
    def total_queries(self) -> int:
        return len(self.manifest.images_new)

    @property
    def completed(self) -> int:
        return len(self.selections)

    @property
    def current_new_index(self) -> int:
        return self.manifest.images_new[self.current].index

    def is_selected(self, new_index: int) -> bool:
        return new_index in self.selections

    def selected_for(self, new_index: int) -> int | None:
        return self.selections.get(new_index)

    def missing_queries(self) -> list[int]:
        """Query indices (images_new) not yet selected, sorted ascending."""
        valid = _valid_new_indices(self.manifest)
        return sorted(valid - self.selections.keys())

    # --- restoration ----------------------------------------------------------
    def restore(self, existing: BatchLabel) -> None:
        """Re-apply a previously saved label's complete choices (if any).

        An ``ambiguous`` label carries no matches, so nothing is restored; the
        session simply starts empty. A ``complete`` label's matches are replayed
        through :meth:`select`, which re-validates every index against the current
        manifest (guards against a stale/foreign label).
        """
        if existing.batch_id != self.manifest.batch_id:
            raise LabelSessionError(
                f"label batch_id {existing.batch_id!r} does not match manifest "
                f"batch_id {self.manifest.batch_id!r}"
            )
        if existing.status == "ambiguous":
            if existing.matches:
                raise LabelSessionError("existing ambiguous label must have empty matches")
            self.selections.clear()
            return
        seen: set[int] = set()
        for match in existing.matches:
            if match.new_index in seen:
                raise LabelSessionError(
                    f"existing label has duplicate new_index {match.new_index}"
                )
            seen.add(match.new_index)
            self.select(match.new_index, match.img_index)
        missing = self.missing_queries()
        if missing:
            raise LabelSessionError(
                "existing complete label must contain exactly one match for every "
                f"query; missing: {missing}"
            )

    # --- navigation -----------------------------------------------------------
    def previous(self) -> int:
        """Move to the previous query; clamps at the first. Returns new index."""
        if self.current > 0:
            self.current -= 1
        return self.current_new_index

    def next(self) -> int:
        """Move to the next query; clamps at the last. Returns new index."""
        if self.current < self.total_queries - 1:
            self.current += 1
        return self.current_new_index

    def goto(self, new_index: int) -> int:
        """Jump navigation to a specific query index (clamped). Returns new index."""
        valid = _valid_new_indices(self.manifest)
        if new_index not in valid:
            raise LabelSessionError(f"query index {new_index} is not a valid images_new index")
        self.current = new_index
        return self.current_new_index

    # --- selection ------------------------------------------------------------
    def select(self, new_index: int, img_index: int) -> None:
        """Record the human's choice: query ``new_index`` depicts ``img_index``.

        Rejects out-of-range indices. Overwrites any prior choice for the same
        query. Many-to-one (the same ``img_index`` for several queries) is allowed.
        """
        valid_new = _valid_new_indices(self.manifest)
        valid_img = _valid_img_indices(self.manifest)
        if new_index not in valid_new:
            raise LabelSessionError(
                f"new_index {new_index} out of range; valid images_new indices: "
                f"{sorted(valid_new)}"
            )
        if img_index not in valid_img:
            raise LabelSessionError(
                f"img_index {img_index} out of range; valid images indices: "
                f"{sorted(valid_img)}"
            )
        self.selections[new_index] = img_index

    def clear(self, new_index: int) -> None:
        """Remove the human's choice for a single query (e.g. "unselect")."""
        self.selections.pop(new_index, None)

    # --- label production -----------------------------------------------------
    def to_label(self) -> BatchLabel:
        """Build a *complete* label from current choices.

        Raises :class:`LabelSessionError` if not every query has been selected.
        """
        missing = self.missing_queries()
        if missing:
            raise LabelSessionError(
                f"cannot save complete label: {len(missing)} query/queries still "
                f"unselected: {missing}"
            )
        matches = tuple(
            MatchLabel(new_index=key, img_index=self.selections[key])
            for key in sorted(self.selections)
        )
        return BatchLabel(
            schema_version=SCHEMA_VERSION,
            batch_id=self.manifest.batch_id,
            status="complete",
            matches=matches,
        )

    def mark_ambiguous(self) -> BatchLabel:
        """Build an *ambiguous* label and clear all selections.

        Many capture batches are unreviewable (e.g. ambiguous duplicates); marking
        ambiguous records that decision with empty matches and discards any
        in-progress selections so no partial complete label can be inferred.
        """
        self.selections.clear()
        return BatchLabel(
            schema_version=SCHEMA_VERSION,
            batch_id=self.manifest.batch_id,
            status="ambiguous",
            matches=(),
        )


# ---------------------------------------------------------------------------
# Console / CLI plumbing
# ---------------------------------------------------------------------------

def label_path_for(labels_root: Path, batch_id: str) -> Path:
    """Return the canonical flat label path under ``labels_root``."""
    return Path(labels_root) / f"{batch_id}.json"


def load_existing_label(labels_root: Path, batch_id: str) -> BatchLabel | None:
    """Load an existing label for the batch, or ``None`` only if absent."""
    path = label_path_for(labels_root, batch_id)
    if not path.exists():
        return None
    try:
        return load_label(path)
    except (LabelError, ValueError, OSError) as exc:
        raise LabelSessionError(f"failed to load existing label {path}: {exc}") from exc


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="fishing-label",
        description="Unbiased manual labeling tool for Avatar fishing image matching.",
    )
    parser.add_argument(
        "--raw-root",
        required=True,
        type=Path,
        help="Root where immutable raw batches live (manifest at <raw-root>/<batch-id>/manifest.json).",
    )
    parser.add_argument(
        "--labels-root",
        required=True,
        type=Path,
        help="Root where labels are written (<labels-root>/<batch-id>.json).",
    )
    parser.add_argument(
        "--batch-id",
        required=True,
        type=str,
        help="Batch identifier to label.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Console entry point for ``fishing-label``."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    manifest_path = args.raw_root / args.batch_id / "manifest.json"
    manifest = load_manifest(manifest_path)
    existing = load_existing_label(args.labels_root, args.batch_id)
    session = LabelSession(manifest, existing=existing)

    labels_root = Path(args.labels_root)
    label_path = label_path_for(labels_root, args.batch_id)

    def save_complete() -> BatchLabel:
        label = session.to_label()
        atomic_write_json(label_path, _label_to_doc(label))
        return label

    def save_ambiguous() -> BatchLabel:
        label = session.mark_ambiguous()
        atomic_write_json(label_path, _label_to_doc(label))
        return label

    run_label_ui(session, args.raw_root / args.batch_id, save_complete, save_ambiguous)
    return 0


def _label_to_doc(label: BatchLabel) -> Mapping[str, object]:
    """Serialize a label to the canonical document form (mirrors schema.label_to_json)."""
    from .schema import label_to_json

    return label_to_json(label)


# ---------------------------------------------------------------------------
# Tkinter UI — importable & runnable; not exercised headlessly in CI.
# ---------------------------------------------------------------------------

def run_label_ui(
    session: LabelSession,
    batch_dir: Path,
    on_save_complete,
    on_mark_ambiguous,
) -> None:
    """Open the labeling window. Blocks until the window is closed.

    ``batch_dir`` is the raw batch directory (used to resolve image ``path``
    fields). ``on_save_complete`` / ``on_mark_ambiguous`` are callables that
    produce and persist the label; they are invoked from the Save / Ambiguous
    buttons. The tool never computes a baseline — it only reflects the human's
    clicks.
    """
    import tkinter as tk
    from tkinter import messagebox, ttk

    from PIL import Image, ImageTk

    THUMB = (96, 96)

    root = tk.Tk()
    root.title(f"Label — {session.manifest.batch_id}")
    root.update_idletasks()
    _w, _h = root.winfo_width(), root.winfo_height()
    _sw, _sh = root.winfo_screenwidth(), root.winfo_screenheight()
    root.geometry(f"+{(_sw - _w) // 2 - _w}+{(_sh - _h) // 2 - _h}")  # center on screen

    def load_thumb(entry):
        path = Path(batch_dir) / entry.path
        try:
            with Image.open(path) as img:
                img = img.convert("RGB")
                img.thumbnail(THUMB, Image.LANCZOS)
                return ImageTk.PhotoImage(img, master=root), entry.index
        except Exception:  # noqa: BLE001 - missing/corrupt image -> placeholder
            return None, entry.index

    # Pre-load reference (images) thumbs once; queries (images_new) loaded lazily.
    ref_thumbs: dict[int, tk.PhotoImage | None] = {}
    for entry in session.manifest.images:
        photo, idx = load_thumb(entry)
        ref_thumbs[idx] = photo

    # --- reference panel (all indexed references, with clear indices) ---------
    ref_frame = ttk.LabelFrame(root, text="References (arrImg)")
    ref_frame.grid(row=0, column=0, padx=8, pady=8, sticky="nsew")
    ref_canvas = tk.Canvas(ref_frame)
    ref_scroll = ttk.Scrollbar(ref_frame, orient="vertical", command=ref_canvas.yview)
    ref_inner = ttk.Frame(ref_canvas)
    ref_inner.bind(
        "<Configure>",
        lambda e: ref_canvas.configure(scrollregion=ref_canvas.bbox("all")),
    )
    ref_canvas.create_window((0, 0), window=ref_inner, anchor="nw")
    ref_canvas.configure(yscrollcommand=ref_scroll.set)
    ref_canvas.grid(row=0, column=0, sticky="nsew")
    ref_scroll.grid(row=0, column=1, sticky="ns")
    # Fixed width for the reference column; height is content-driven (see build_refs).
    ref_canvas.configure(width=THUMB[0] + 24)

    def _on_ref_wheel(event):  # mouse wheel / trackpad scroll for reference panel
        if event.delta:
            ref_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        elif event.num == 4:
            ref_canvas.yview_scroll(-1, "units")
        elif event.num == 5:
            ref_canvas.yview_scroll(1, "units")

    ref_canvas.bind("<MouseWheel>", _on_ref_wheel)
    ref_canvas.bind("<Button-4>", _on_ref_wheel)
    ref_canvas.bind("<Button-5>", _on_ref_wheel)

    def choose(img_index: int) -> None:
        session.select(session.current_new_index, img_index)
        refresh()

    ref_buttons: dict[int, ttk.Button] = {}

    def build_refs() -> None:
        for widget in ref_inner.winfo_children():
            widget.destroy()
        ref_buttons.clear()
        for entry in session.manifest.images:
            photo = ref_thumbs.get(entry.index)
            btn = ttk.Button(
                ref_inner,
                text=f"#{entry.index}",
                image=photo,
                compound="top" if photo else "left",
                command=lambda i=entry.index: choose(i),
            )
            btn.pack(padx=2, pady=2, anchor="w")
            ref_buttons[entry.index] = btn
        # Auto-size canvas height to the reference count, capped to the screen
        # so very large reference sets still fit and the scrollbar is the fallback.
        _ref_count = len(session.manifest.images)
        _per_btn = THUMB[1] + 8  # 96px thumb + ~8px padding
        _desired = _ref_count * _per_btn + 8
        _max_h = int(root.winfo_screenheight() * 0.85)
        ref_canvas.configure(height=min(_desired, _max_h))

    # --- query panel ----------------------------------------------------------
    query_frame = ttk.LabelFrame(root, text="Current query (arrImgNew)")
    query_frame.grid(row=0, column=1, padx=8, pady=8, sticky="nsew")

    query_img_label = ttk.Label(query_frame)
    query_img_label.pack(padx=4, pady=4)
    query_idx_label = ttk.Label(query_frame, text="")
    query_idx_label.pack(padx=4)
    sel_label = ttk.Label(query_frame, text="")
    sel_label.pack(padx=4)

    progress_label = ttk.Label(query_frame, text="")
    progress_label.pack(padx=4, pady=(4, 0))

    nav = ttk.Frame(query_frame)
    nav.pack(pady=4)
    prev_btn = ttk.Button(nav, text="< Previous", command=lambda: (session.previous(), refresh()))
    prev_btn.grid(row=0, column=0, padx=4)
    next_btn = ttk.Button(nav, text="Next >", command=lambda: (session.next(), refresh()))
    next_btn.grid(row=0, column=1, padx=4)

    # Per-query re-selection: a dropdown of valid references for the current query.
    reselect_var = tk.StringVar()
    reselect_combo = ttk.Combobox(
        query_frame,
        textvariable=reselect_var,
        state="readonly",
        values=[f"#{e.index}" for e in session.manifest.images],
    )
    reselect_combo.pack(padx=4, pady=(4, 0))
    reselect_combo.bind(
        "<<ComboboxSelected>>",
        lambda e: (session.select(session.current_new_index, _parse_idx(reselect_var.get())), refresh()),
    )

    # --- footer actions -------------------------------------------------------
    actions = ttk.Frame(root)
    actions.grid(row=1, column=0, columnspan=2, pady=8)

    def do_save_complete() -> None:
        try:
            label = on_save_complete()
        except LabelSessionError as exc:
            messagebox.showerror("Cannot save", str(exc))
            return
        messagebox.showinfo(
            "Saved",
            f"Complete label written ({len(label.matches)} matches).",
        )
        root.destroy()

    def do_mark_ambiguous() -> None:
        on_mark_ambiguous()
        messagebox.showinfo("Marked ambiguous", "Ambiguous label written; selections cleared.")
        root.destroy()

    ttk.Button(actions, text="Save Complete", command=do_save_complete).grid(
        row=0, column=0, padx=8
    )
    ttk.Button(actions, text="Mark Ambiguous", command=do_mark_ambiguous).grid(
        row=0, column=1, padx=8
    )

    # --- keyboard shortcuts ---------------------------------------------------
    # Left/Right navigate queries; Enter saves the complete label. Bound on the
    # root window so they fire regardless of widget focus (no editable text
    # fields exist; the reference combobox is readonly).
    root.bind("<Left>", lambda e: (session.previous(), refresh()))
    root.bind("<Right>", lambda e: (session.next(), refresh()))
    root.bind("<Return>", lambda e: do_save_complete())

    # --- refresh --------------------------------------------------------------
    def refresh() -> None:
        entry = session.manifest.images_new[session.current]
        photo, _ = load_thumb(entry)
        if photo is not None:
            query_img_label.configure(image=photo, text="")
            query_img_label.image = photo  # keep ref alive
        else:
            query_img_label.configure(image="", text=f"(missing {entry.path})")
        query_idx_label.configure(text=f"query index: #{entry.index}")
        sel = session.selected_for(entry.index)
        sel_label.configure(text=f"selected reference: {f'#{sel}' if sel is not None else '(none)'}")
        progress_label.configure(
            text=f"progress: {session.completed}/{session.total_queries} queries selected"
        )
        for idx, btn in ref_buttons.items():
            btn.state(["!pressed"])
            if session.selected_for(entry.index) == idx:
                btn.state(["pressed"])
        cur = session.selected_for(entry.index)
        reselect_var.set(f"#{cur}" if cur is not None else "")

    build_refs()
    refresh()
    root.mainloop()


def _parse_idx(value: str) -> int:
    """Parse a '#12' style label back into the integer index."""
    return int(value.lstrip("#"))


if __name__ == "__main__":
    raise SystemExit(main())
