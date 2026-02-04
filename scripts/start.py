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

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
VENV_DIR = REPO_ROOT / ".venv"

# ANSI for terminal colors (whole backend line in green)
GREEN = "\033[32m"
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


def main():
    venv_python = get_venv_python()
    if not venv_python.exists():
        raise RuntimeError("Virtual environment not found. Run scripts/setup.py first.")

    # Python is used here to provide consistent process and signal control across OSes.
    backend_cmd = [str(venv_python), "-m", "uvicorn", "main:app", "--reload", "--port", "5000"]
    frontend_cmd = ["npm", "run", "dev"]

    output_lock = threading.Lock()

    with output_lock:
        print("Starting backend...")
    backend_proc = start_process(backend_cmd, BACKEND_DIR, capture_output=True)
    backend_relay = threading.Thread(
        target=relay_output,
        args=(backend_proc.stdout, "[backend] ", output_lock),
        kwargs={"color": GREEN},
        daemon=True,
    )
    backend_relay.start()

    with output_lock:
        print("Starting frontend...")
    frontend_proc = start_process(frontend_cmd, REPO_ROOT, capture_output=True)
    frontend_relay = threading.Thread(
        target=relay_output,
        args=(frontend_proc.stdout, "[frontend] ", output_lock),
        daemon=True,
    )
    frontend_relay.start()

    stopping = {"value": False}

    def request_shutdown():
        if stopping["value"]:
            return
        stopping["value"] = True
        with output_lock:
            print("Stopping processes...")
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
