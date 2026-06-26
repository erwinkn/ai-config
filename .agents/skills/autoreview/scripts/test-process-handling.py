#!/usr/bin/env python3
from __future__ import annotations

import importlib.machinery
import importlib.util
import json
import sys
import tempfile
import textwrap
import time
from argparse import Namespace
from pathlib import Path
from types import ModuleType


def load_autoreview() -> ModuleType:
    helper = Path(__file__).resolve().parent / "autoreview"
    loader = importlib.machinery.SourceFileLoader("autoreview_helper", str(helper))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    if spec is None:
        raise RuntimeError(f"unable to load {helper}")
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


def assert_less(value: float, limit: float, label: str) -> None:
    if value >= limit:
        raise AssertionError(f"{label}: expected < {limit:.2f}s, got {value:.2f}s")


def assert_at_least(value: float, limit: float, label: str) -> None:
    if value < limit:
        raise AssertionError(f"{label}: expected >= {limit:.2f}s, got {value:.2f}s")


def test_exited_child_with_inherited_pipe(autoreview: ModuleType) -> None:
    cmd = [
        sys.executable,
        "-c",
        (
            "import subprocess, sys; "
            "subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(5)']); "
            "print('parent done', flush=True)"
        ),
    ]
    started = time.monotonic()
    result = autoreview.run_with_heartbeat(cmd, Path.cwd(), label="fake", heartbeat_seconds=0.2)
    elapsed = time.monotonic() - started
    assert_less(elapsed, 1.5, "exited child with inherited pipe")
    assert result.returncode == 0
    assert "parent done" in result.stdout


def test_stream_completed_probe_cleans_live_process(autoreview: ModuleType) -> None:
    completed = False

    def display(_name: str, line: str) -> None:
        nonlocal completed
        if "completed" in line:
            completed = True
        return None

    cmd = [sys.executable, "-c", "import time; print('completed', flush=True); time.sleep(5)"]
    started = time.monotonic()
    result = autoreview.run_with_heartbeat(
        cmd,
        Path.cwd(),
        label="fake-stream",
        heartbeat_seconds=0.2,
        stream_output=True,
        stream_display=display,
        completion_probe=lambda: completed,
        allow_live_completion=True,
    )
    elapsed = time.monotonic() - started
    assert_less(elapsed, 1.5, "stream completed probe")
    assert result.returncode == 0
    assert "completed" in result.stdout


def test_long_running_process_without_completion_is_not_cut_short(autoreview: ModuleType) -> None:
    cmd = [sys.executable, "-c", "import time; time.sleep(0.7); print('natural done', flush=True)"]
    started = time.monotonic()
    result = autoreview.run_with_heartbeat(
        cmd,
        Path.cwd(),
        label="healthy",
        heartbeat_seconds=0.2,
        stream_output=True,
        completion_probe=lambda: False,
        allow_live_completion=True,
    )
    elapsed = time.monotonic() - started
    assert_at_least(elapsed, 0.65, "healthy long-running process")
    assert result.returncode == 0
    assert "natural done" in result.stdout


def write_fake_codex(path: Path, *, stream: bool) -> None:
    report = {
        "findings": [],
        "overall_correctness": "patch is correct",
        "overall_explanation": "fake review complete",
        "overall_confidence": 0.91,
    }
    script = f"""\
#!/usr/bin/env python3
import json
import subprocess
import sys
import time

report = {json.dumps(report)!r}
output_path = sys.argv[sys.argv.index("--output-last-message") + 1]
with open(output_path, "w", encoding="utf-8") as handle:
    handle.write(report)
if {stream!r}:
    print(json.dumps({{"type": "turn.completed", "usage": {{"input_tokens": 1}}}}), flush=True)
    time.sleep(5)
else:
    subprocess.Popen([sys.executable, "-c", "import time; time.sleep(5)"])
    print("fake codex done", flush=True)
"""
    path.write_text(textwrap.dedent(script))
    path.chmod(0o755)


def codex_args(codex_bin: Path, *, stream: bool) -> Namespace:
    return Namespace(
        tools=True,
        codex_bin=str(codex_bin),
        web_search=False,
        model=None,
        thinking=None,
        stream_engine_output=stream,
    )


def with_short_heartbeat(autoreview: ModuleType, heartbeat_seconds: float = 0.2) -> None:
    original = autoreview.run_with_heartbeat

    def run_with_short_heartbeat(*args: object, **kwargs: object) -> object:
        kwargs["heartbeat_seconds"] = heartbeat_seconds
        return original(*args, **kwargs)

    autoreview.run_with_heartbeat = run_with_short_heartbeat


def test_run_codex_uses_last_message_when_pipes_remain_open(autoreview: ModuleType) -> None:
    with tempfile.TemporaryDirectory(prefix="autoreview-fake-codex.") as tempdir:
        fake_codex = Path(tempdir) / "codex"
        write_fake_codex(fake_codex, stream=False)
        with_short_heartbeat(autoreview)
        started = time.monotonic()
        raw = autoreview.run_codex(codex_args(fake_codex, stream=False), Path.cwd(), "review")
        elapsed = time.monotonic() - started
    assert_less(elapsed, 1.5, "run_codex last-message with inherited pipe")
    report = json.loads(raw)
    assert report["overall_correctness"] == "patch is correct"


def test_run_codex_stream_completion_cleans_lingering_process(autoreview: ModuleType) -> None:
    with tempfile.TemporaryDirectory(prefix="autoreview-fake-codex.") as tempdir:
        fake_codex = Path(tempdir) / "codex"
        write_fake_codex(fake_codex, stream=True)
        with_short_heartbeat(autoreview)
        started = time.monotonic()
        raw = autoreview.run_codex(codex_args(fake_codex, stream=True), Path.cwd(), "review")
        elapsed = time.monotonic() - started
    assert_less(elapsed, 1.5, "run_codex streaming completion")
    report = json.loads(raw)
    assert report["overall_correctness"] == "patch is correct"


def main() -> int:
    autoreview = load_autoreview()
    tests = [
        test_exited_child_with_inherited_pipe,
        test_stream_completed_probe_cleans_live_process,
        test_long_running_process_without_completion_is_not_cut_short,
        test_run_codex_uses_last_message_when_pipes_remain_open,
        test_run_codex_stream_completion_cleans_lingering_process,
    ]
    for test in tests:
        test(autoreview)
        print(f"ok {test.__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
