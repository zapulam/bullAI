"""
Start application.

Written by: zapulam
"""

import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
VENV_DIR = REPO_ROOT / ".venv"

BACKEND_HEALTH_URL = "http://127.0.0.1:5000/health"
BACKEND_READY_POLL_SEC = 0.35
BACKEND_HEALTH_OPEN_TIMEOUT_SEC = 2

# ANSI for terminal colors
GREEN = "\033[32m"
CYAN = "\033[36m"
RESET = "\033[0m"


def get_venv_python():
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def resolve_command_executable(command):
    if not command:
        raise ValueError("Command cannot be empty")
    executable = command[0]
    resolved = shutil.which(executable)
    if resolved:
        return [resolved, *command[1:]]
    if os.name == "nt" and not executable.lower().endswith((".exe", ".cmd", ".bat")):
        for ext in (".cmd", ".exe", ".bat"):
            resolved = shutil.which(f"{executable}{ext}")
            if resolved:
                return [resolved, *command[1:]]
    raise FileNotFoundError(f"Executable not found on PATH: {executable}")


def start_process(command, cwd, capture_output=False):
    resolved_command = resolve_command_executable(command)
    kwargs = {"cwd": str(cwd)}
    if capture_output:
        kwargs["stdout"] = subprocess.PIPE
        kwargs["stderr"] = subprocess.STDOUT
        kwargs["text"] = True
        kwargs["bufsize"] = 1
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        return subprocess.Popen(resolved_command, **kwargs)
    kwargs["preexec_fn"] = os.setsid
    return subprocess.Popen(resolved_command, **kwargs)


def stop_process(proc, timeout=5):
    if proc.poll() is not None:
        return
    try:
        if os.name == "nt":
            proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except Exception:
        pass

    try:
        proc.wait(timeout=timeout)
        return
    except Exception:
        pass

    try:
        proc.terminate()
        proc.wait(timeout=timeout)
        return
    except Exception:
        pass

    try:
        proc.kill()
    except Exception:
        pass


def relay_output(pipe, prefix, lock, color=None):
    """Read lines from pipe and print with prefix, holding lock to avoid interleaving."""
    try:
        for line in pipe:
            with lock:
                if color:
                    sys.stdout.write(color + prefix + line + RESET)
                else:
                    sys.stdout.write(prefix + line)
                if not line.endswith("\n"):
                    sys.stdout.write("\n")
                sys.stdout.flush()
    except (ValueError, OSError):
        pass


def wait_for_backend_ready(backend_proc):
    """Block until /health returns 200; raise if the backend process dies first."""
    while True:
        if backend_proc.poll() is not None:
            raise RuntimeError("Backend process exited before it became ready.")
        try:
            with urllib.request.urlopen(
                BACKEND_HEALTH_URL,
                timeout=BACKEND_HEALTH_OPEN_TIMEOUT_SEC,
            ) as resp:
                if resp.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        time.sleep(BACKEND_READY_POLL_SEC)


def main():
    venv_python = get_venv_python()
    if not venv_python.exists():
        raise RuntimeError("Virtual environment not found. Run scripts/setup.py first.")

    # Python is used here to provide consistent process and signal control across OSes.
    backend_cmd = [str(venv_python), "-m", "uvicorn", "main:app", "--reload", "--port", "5000", "--no-access-log"]
    frontend_cmd = ["node", "node_modules/vite/bin/vite.js"]

    output_lock = threading.Lock()

    with output_lock:
        print()
        print("  🏜️  bullAI")
        print("  Backend:  http://127.0.0.1:5000")
        print("  Frontend: http://localhost:3000")
        print()
        print("Starting backend...")
    backend_proc = start_process(backend_cmd, BACKEND_DIR, capture_output=True)
    backend_relay = threading.Thread(
        target=relay_output,
        args=(backend_proc.stdout, "[backend] ", output_lock),
        kwargs={"color": GREEN},
        daemon=True,
    )
    backend_relay.start()

    try:
        with output_lock:
            print("Waiting for backend (GET /health)...")
            sys.stdout.flush()
        wait_for_backend_ready(backend_proc)
        with output_lock:
            print("Backend is ready.")
            sys.stdout.flush()
    except RuntimeError as exc:
        with output_lock:
            print(f"Error: {exc}", file=sys.stderr)
            sys.stderr.flush()
        stop_process(backend_proc)
        raise SystemExit(1) from exc

    with output_lock:
        print("Starting frontend...")
        print()
    frontend_proc = start_process(frontend_cmd, REPO_ROOT, capture_output=True)
    frontend_relay = threading.Thread(
        target=relay_output,
        args=(frontend_proc.stdout, "[frontend] ", output_lock),
        kwargs={"color": CYAN},
        daemon=True,
    )
    frontend_relay.start()

    stopping = {"value": False}

    def request_shutdown():
        if stopping["value"]:
            return
        stopping["value"] = True
        with output_lock:
            print("Stopping processes...\n")
            sys.stdout.flush()
        stop_process(frontend_proc)
        stop_process(backend_proc)

    def handle_signal(signum, frame):
        request_shutdown()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        while True:
            backend_done = backend_proc.poll() is not None
            frontend_done = frontend_proc.poll() is not None

            if backend_done and frontend_done:
                break
            if backend_done or frontend_done:
                request_shutdown()
                break
            if stopping["value"]:
                break

            time.sleep(0.2)
    except KeyboardInterrupt:
        request_shutdown()


if __name__ == "__main__":
    main()
