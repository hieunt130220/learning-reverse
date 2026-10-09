#!/usr/bin/env python3
import argparse
import os
import sys
import time
from datetime import datetime, timedelta, timezone

# Ensure local modules can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_reader import BlockedSession, get_blocked_sessions
from orca_trigger import send_notification, trigger_orca_continue, trigger_session_continue
from state_store import StateStore


def format_remaining(reset_time: datetime, now: datetime) -> str:
    diff = (reset_time - now).total_seconds()
    if diff <= 0:
        overdue_sec = abs(int(diff))
        if overdue_sec < 60:
            return f"Overdue {overdue_sec}s"
        return f"Overdue {overdue_sec // 60}m {overdue_sec % 60}s"

    secs = int(diff)
    hours = secs // 3600
    minutes = (secs % 3600) // 60
    seconds = secs % 60
    if hours > 0:
        return f"in {hours}h {minutes}m {seconds}s"
    elif minutes > 0:
        return f"in {minutes}m {seconds}s"
    return f"in {seconds}s"


def cmd_status(args: argparse.Namespace) -> None:
    state_store = StateStore()
    sessions = get_blocked_sessions()
    now = datetime.now().astimezone()

    print(f"\n[CODEX QUOTA MONITOR] Thời gian hiện tại: {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    if not sessions:
        print("Không có session nào đang bị quota limit.")
        return

    print(f"Tìm thấy {len(sessions)} session(s) có turn kết thúc với usageLimitExceeded:\n")
    header = f"{'Thread ID':<38} | {'Reset Time':<22} | {'Remaining':<18} | {'Status':<14} | {'Runtime Home':<16} | {'Title'}"
    print(header)
    print("-" * 145)

    for s in sessions:
        is_processed = state_store.is_turn_processed(s.turn_id, reset_time=s.reset_time)
        if s.reset_time:
            reset_str = s.reset_time.strftime("%Y-%m-%d %H:%M:%S")
            remaining_str = format_remaining(s.reset_time, now)
            if is_processed:
                status_str = "Resumed"
            elif (s.reset_time - now).total_seconds() <= 0:
                # If reset was more than 12 hours ago, mark as Expired / Stale
                if (now - s.reset_time).total_seconds() > 12 * 3600:
                    status_str = "Stale (Old)"
                else:
                    status_str = "Ready"
            else:
                status_str = "Waiting"
        else:
            reset_str = "Unknown"
            remaining_str = "N/A"
            status_str = "Resumed" if is_processed else "Unknown Time"

        title_display = s.title.replace("\n", " ").strip()
        if len(title_display) > 28:
            title_display = title_display[:25] + "..."

        home_label = "Orca-Shared" if "orca" in s.home_dir.lower() else "Codex-Default"
        row = f"{s.thread_id:<38} | {reset_str:<22} | {remaining_str:<18} | {status_str:<14} | {home_label:<16} | {title_display}"
        print(row)
    print()


def cmd_resume(args: argparse.Namespace) -> None:
    thread_id = args.thread_id
    state_store = StateStore()
    sessions = get_blocked_sessions()

    matched = [s for s in sessions if s.thread_id == thread_id or s.thread_id.startswith(thread_id)]
    target_session = matched[0] if matched else None

    title = target_session.title if target_session else thread_id
    print(f"[RESUME] Bắt đầu kích hoạt cho session: {thread_id} ({title})")

    success = trigger_session_continue(
        thread_id=target_session.thread_id if target_session else thread_id,
        message=args.message,
        home_dir=target_session.home_dir if target_session else None,
        dry_run=args.dry_run,
    )
    if success:
        if not args.dry_run and target_session:
            state_store.mark_turn_processed(
                turn_id=target_session.turn_id,
                thread_id=target_session.thread_id,
                metadata={"title": target_session.title, "manual": True},
            )
        send_notification("Codex Quota Monitor", f"Đã kích hoạt resume cho session {title[:30]}")
    else:
        sys.exit(1)


def cmd_watch(args: argparse.Namespace) -> None:
    buffer_sec = args.buffer_seconds
    interval_sec = args.interval
    max_age_hours = args.max_age_hours
    message = args.message
    dry_run = args.dry_run
    state_store = StateStore()

    print("\n" + "=" * 65)
    print(f" CODEX QUOTA MONITOR DAEMON")
    print(f" - Polling interval   : {interval_sec}s")
    print(f" - Buffer an toàn     : {buffer_sec}s sau thời điểm reset")
    print(f" - Giới hạn session cũ: Chỉ quét session trong vòng {max_age_hours} giờ qua")
    print(f" - Tin nhắn trigger   : '{message}'")
    print(f" - Chế độ Dry-run     : {'BẬT (không gửi phím thật)' if dry_run else 'TẮT (gửi phím thật)'}")
    print("=" * 65 + "\n")

    try:
        while True:
            now = datetime.now().astimezone()
            cutoff_time = now - timedelta(hours=max_age_hours)
            sessions = get_blocked_sessions()

            # Filter for sessions that:
            # 1. Have NOT been validly resumed yet (respecting reset_time)
            # 2. Have a known reset time
            # 3. Failed recently (within max_age_hours) or whose reset time is in the future
            recent_pending = [
                s
                for s in sessions
                if not state_store.is_turn_processed(s.turn_id, reset_time=s.reset_time)
                and s.reset_time
                and (
                    s.reset_time > now  # upcoming reset
                    or (s.started_at and s.started_at >= cutoff_time)  # failed recently
                )
            ]

            ready_to_trigger = []
            upcoming = []

            for s in recent_pending:
                effective_trigger_time = s.reset_time + timedelta(seconds=buffer_sec)
                if now >= effective_trigger_time:
                    ready_to_trigger.append(s)
                else:
                    upcoming.append(s)

            if ready_to_trigger:
                print(f"\n[{now.strftime('%H:%M:%S')}] Phát hiện {len(ready_to_trigger)} session sẵn sàng reset!")
                for i, s in enumerate(ready_to_trigger):
                    title_short = s.title.replace('\n', ' ')[:35]
                    switch_pane = (i > 0)
                    print(f" -> Kích hoạt ({i+1}/{len(ready_to_trigger)}): {s.thread_id} ({title_short})...")

                    ok = trigger_session_continue(
                        thread_id=s.thread_id,
                        message=message,
                        home_dir=s.home_dir,
                        dry_run=dry_run,
                        switch_pane=switch_pane,
                    )
                    if ok and not dry_run:
                        state_store.mark_turn_processed(
                            turn_id=s.turn_id,
                            thread_id=s.thread_id,
                            metadata={"title": s.title, "reset_time": str(s.reset_time), "home": s.home_dir},
                        )
                        send_notification(
                            "Codex Quota Monitor",
                            f"Quota đã reset! Đã gửi '{message}' vào Orca cho session: {title_short}",
                        )
                    # Delay to ensure keystrokes settle
                    time.sleep(1.5)

            if upcoming:
                earliest_reset = min(s.reset_time for s in upcoming)
                wait_sec = (earliest_reset + timedelta(seconds=buffer_sec) - now).total_seconds()
                sleep_duration = max(2.0, min(float(interval_sec), wait_sec))
                print(
                    f"[{now.strftime('%H:%M:%S')}] Đang chờ {len(upcoming)} session. "
                    f"Mốc reset kế tiếp {format_remaining(earliest_reset, now)}. "
                    f"Ngủ {int(sleep_duration)}s...",
                    end="\r",
                    flush=True,
                )
            else:
                sleep_duration = float(interval_sec)
                print(
                    f"[{now.strftime('%H:%M:%S')}] Không có session nào chờ quota. Kiểm tra lại sau {int(sleep_duration)}s...",
                    end="\r",
                    flush=True,
                )

            time.sleep(sleep_duration)

    except KeyboardInterrupt:
        print("\n\n[INFO] Đã dừng Codex Quota Monitor Daemon.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Codex Quota Monitor - Tự động phát hiện và tiếp tục session Codex khi reset quota"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: status
    parser_status = subparsers.add_parser("status", help="Xem danh sách các session đang bị quota limit")
    parser_status.set_defaults(func=cmd_status)

    # Subcommand: resume
    parser_resume = subparsers.add_parser("resume", help="Kích hoạt tiếp tục một session cụ thể")
    parser_resume.add_argument("thread_id", help="Thread ID hoặc tiền tố UUID của session")
    parser_resume.add_argument("--message", default="tiếp tục", help="Nội dung gửi vào terminal (mặc định: 'tiếp tục')")
    parser_resume.add_argument("--dry-run", action="store_true", help="Chạy thử không gửi phím thật")
    parser_resume.set_defaults(func=cmd_resume)

    # Subcommand: watch
    parser_watch = subparsers.add_parser("watch", help="Chạy chế độ daemon theo dõi và tự động kích hoạt")
    parser_watch.add_argument(
        "--buffer-seconds",
        type=int,
        default=15,
        help="Số giây chờ thêm sau mốc reset để đảm bảo quota đã mở hoàn toàn (mặc định: 15s)",
    )
    parser_watch.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Khoảng thời gian polling tối đa (giây, mặc định: 30s)",
    )
    parser_watch.add_argument(
        "--max-age-hours",
        type=int,
        default=12,
        help="Chỉ quét các session xảy ra trong vòng số giờ này (mặc định: 12h)",
    )
    parser_watch.add_argument("--message", default="tiếp tục", help="Nội dung gửi vào terminal (mặc định: 'tiếp tục')")
    parser_watch.add_argument("--dry-run", action="store_true", help="Chạy thử không gửi phím thật")
    parser_watch.set_defaults(func=cmd_watch)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
