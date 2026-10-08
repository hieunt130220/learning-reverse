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
) -> bool:
    if dry_run:
        print(f"[DRY-RUN] Sẽ activate Orca và gửi phím: '{message}' + Enter")
        return True

    if not is_orca_running():
        print("[ERROR] Ứng dụng Orca hiện không chạy. Không thể gửi lệnh.")
        send_notification("Codex Quota Monitor", "Orca không chạy! Vui lòng mở Orca để tiếp tục.")
        return False

    # AppleScript to activate Orca, delay briefly, and send keystroke followed by return
    # key code 36 is Return / Enter in macOS
    escaped_msg = message.replace('"', '\\"')
    apple_script = f"""
    tell application "Orca" to activate
    delay {delay_sec}
    tell application "System Events"
        keystroke "{escaped_msg}"
        key code 36
    end tell
    """

    try:
        res = subprocess.run(
            ["osascript", "-e", apple_script],
            capture_output=True,
            text=True,
        )
        if res.returncode == 0:
            print(f"[SUCCESS] Đã gửi lệnh '{message}' vào Orca thành công.")
            return True
        else:
            print(f"[ERROR] Lỗi khi thực thi AppleScript: {res.stderr.strip()}")
            return False
    except Exception as e:
        print(f"[ERROR] Ngoại lệ khi kích hoạt Orca: {e}")
        return False
