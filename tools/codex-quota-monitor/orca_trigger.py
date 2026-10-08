import shutil
import subprocess
from typing import Optional


def is_orca_running() -> bool:
    try:
        # Check if process named Orca exists
        res = subprocess.run(["pgrep", "-x", "Orca"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return res.returncode == 0
    except Exception:
        return False


def send_notification(title: str, message: str, subtitle: Optional[str] = None) -> bool:
    try:
        script_parts = [f'display notification "{message}" with title "{title}"']
        if subtitle:
            script_parts[0] += f' subtitle "{subtitle}"'

        script = script_parts[0]
        res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
        return res.returncode == 0
    except Exception:
        return False


def trigger_orca_continue(
    message: str = "tiếp tục",
    dry_run: bool = False,
    delay_sec: float = 0.5,
    switch_pane: bool = False,
) -> bool:
    prefix = "[DRY-RUN] [SWITCH-PANE] " if (dry_run and switch_pane) else ("[DRY-RUN] " if dry_run else "")
    if switch_pane:
        action_desc = f"Chuyển pane (Cmd + ]), dán '{message}' (Cmd + V) và ấn Enter"
    else:
        action_desc = f"Dán vào pane hiện tại '{message}' (Cmd + V) và ấn Enter"

    if dry_run:
        print(f"{prefix}Sẽ activate Orca, {action_desc}")
        return True

    if not is_orca_running():
        print("[ERROR] Ứng dụng Orca hiện không chạy. Không thể gửi lệnh.")
        send_notification("Codex Quota Monitor", "Orca không chạy! Vui lòng mở Orca để tiếp tục.")
        return False

    escaped_msg = message.replace('"', '\\"')
    switch_script = """
    tell application "System Events"
        -- Switch to next pane in Orca (Cmd + ])
        key code 30 using command down
        delay 0.4
    end tell
    """ if switch_pane else ""

    # Use clipboard paste (Cmd + V) instead of keystroke:
    # 1. Bypasses Vietnamese Telex/VNI IME mangling (e.g. 'tiếp tục' -> 'tiap tac').
    # 2. Avoids IME composing state that swallows the Enter key.
    # 3. Ctrl + U clears any existing draft text in the prompt before pasting.
    apple_script = f"""
    set savedClip to ""
    try
        set savedClip to the clipboard
    end try

    set the clipboard to "{escaped_msg}"

    tell application "Orca" to activate
    delay {delay_sec}
    {switch_script}
    tell application "System Events"
        -- Clear any partial/stray text in current input line (Ctrl + U)
        keystroke "u" using control down
        delay 0.1
        -- Paste clean UTF-8 text directly via clipboard (Cmd + V)
        keystroke "v" using command down
        delay 0.25
        -- Submit prompt
        key code 36
    end tell

    delay 0.4
    try
        if savedClip is not "" then
            set the clipboard to savedClip
        end if
    end try
    """

    try:
        res = subprocess.run(
            ["osascript", "-e", apple_script],
            capture_output=True,
            text=True,
        )
        if res.returncode == 0:
            print(f"[SUCCESS] Đã kích hoạt Orca ({action_desc}) thành công.")
            return True
        else:
            print(f"[ERROR] Lỗi khi thực thi AppleScript: {res.stderr.strip()}")
            return False
    except Exception as e:
        print(f"[ERROR] Ngoại lệ khi kích hoạt Orca: {e}")
        return False
