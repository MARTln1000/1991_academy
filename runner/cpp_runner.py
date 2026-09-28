"""Compile and run one C++17 program, inside limits.

This is the only place 1991 Academy runs code it didn't write on a machine it
controls: a learner's C++ has to be compiled, so it can't run in their browser
the way JavaScript and Python do.

In Docker it runs as its own container, `runner` in docker-compose.yml, where
learner code can't reach anything worth reaching:

- The container has no network at all. The app talks to it through a Unix
  socket in a shared volume, and only the app's group may open that socket.
- Nothing else is inside: no database, no .env, no site files.
- Every program is compiled and run as a throwaway user of its own (one per
  slot, never root), with CPU, memory, process, file-size and output limits.
  After each run everything that user started is killed and its files are
  deleted, so nothing carries over to the next learner.

Run directly (python3 cpp_runner.py) it serves that socket. The app imports
run_local() instead when ACADEMY_CPP=1 runs it without Docker, on a developer's
own computer: same limits where the OS supports them, no user switching.

Protocol: one JSON object per connection, one JSON object back.

  {"source": "<a whole C++ program>"}
      -> {"compiled": bool, "compile_output": str,
          "stdout": str, "stderr": str, "results": str,
          "exit_code": int | None, "signal": str | None,
          "timed_out": bool, "output_limit": bool}
  {"ping": true} -> {"ok": true}
  anything wrong -> {"error": "busy" | "bad_request" | "internal"}

"results" is whatever the program wrote to file descriptor 3, which is where
the app's test harness reports each check, apart from the learner's own output.
"""
import json
import os
import shutil
import signal
import socketserver
import subprocess
import sys
import tempfile
import traceback
import queue

CXX = os.environ.get("CPP_COMPILER") or shutil.which("g++") or shutil.which("c++") or shutil.which("clang++")
SOCKET_PATH = os.environ.get("CPP_RUNNER_SOCKET", "/run/cpp/runner.sock")
SOCKET_GROUP = int(os.environ.get("CPP_RUNNER_SOCKET_GID", "10001"))   # the app's group
SLOTS = int(os.environ.get("CPP_SLOTS", "2"))           # programs compiled/run at once
QUEUE_WAIT = 20                                         # s to wait for a free slot
BASE_UID = 20000                                        # slot n runs as uid/gid 20000+n
WORK = os.environ.get("CPP_WORK", "/work")              # tmpfs, mode 1777

MAX_SOURCE = 200_000
MAX_REQUEST = MAX_SOURCE * 2
COMPILE_TIMEOUT = 25                                    # wall-clock seconds
RUN_TIMEOUT = 8
KEEP_OUTPUT = 64_000                                    # chars returned per stream
MB = 1024 * 1024

COMPILE_LIMITS = {"RLIMIT_CPU": 20, "RLIMIT_AS": 2048 * MB, "RLIMIT_FSIZE": 64 * MB,
                  "RLIMIT_NPROC": 32, "RLIMIT_NOFILE": 256, "RLIMIT_CORE": 0}
RUN_LIMITS = {"RLIMIT_CPU": 5, "RLIMIT_AS": 512 * MB, "RLIMIT_FSIZE": 1 * MB,
              "RLIMIT_NPROC": 16, "RLIMIT_NOFILE": 64, "RLIMIT_CORE": 0,
              "RLIMIT_STACK": 64 * MB}

# Sets the limits on itself, enters the job folder, moves the results file to
# descriptor 3, then becomes the real command. Popen's user=/group= switch the
# user without a preexec_fn (which isn't safe in a threaded server), and this
# wrapper covers the rest. It enters the folder itself because Popen's cwd= is
# applied before the user switch, and root here can't enter a slot's folder. With strict set, a limit that can't be applied aborts the run; off
# Linux (a developer's Mac) some limits don't exist, and that's fine there.
LIMITER = r"""
import json, os, resource, signal, sys
cfg = json.loads(sys.argv[1])
# Python ignores SIGXFSZ and SIGPIPE, and exec keeps ignored signals ignored:
# give the program the defaults, so the file-size limit stops it.
for sig in (signal.SIGXFSZ, signal.SIGPIPE, signal.SIGXCPU):
    signal.signal(sig, signal.SIG_DFL)
for name, value in cfg["limits"].items():
    # CPU: SIGXCPU at the limit (reported as a timeout), SIGKILL a second later
    hard = value + 1 if name == "RLIMIT_CPU" else value
    try:
        resource.setrlimit(getattr(resource, name), (value, hard))
    except (AttributeError, ValueError, OSError):
        if cfg["strict"]:
            sys.stderr.write("runner: cannot apply " + name + "\n")
            os._exit(125)
os.chdir(cfg["cwd"])
if cfg.get("fd3") is not None:
    os.dup2(cfg["fd3"], 3)
    if cfg["fd3"] != 3:
        os.close(cfg["fd3"])
os.execvp(sys.argv[2], sys.argv[2:])
"""

SIGNALS = {signal.SIGSEGV: "SIGSEGV", signal.SIGABRT: "SIGABRT", signal.SIGFPE: "SIGFPE",
           signal.SIGKILL: "SIGKILL", signal.SIGXCPU: "SIGXCPU", signal.SIGXFSZ: "SIGXFSZ",
           signal.SIGBUS: "SIGBUS", signal.SIGILL: "SIGILL"}


def _read(path, limit=KEEP_OUTPUT):
    try:
        with open(path, "rb") as f:
            data = f.read(limit + 1)
    except FileNotFoundError:
        return "", False
    return data[:limit].decode("utf-8", "replace"), len(data) > limit


def _exec(cmd, *, cwd, io_dir, name, limits, timeout, uid=None, strict=False, results=False):
    """Run cmd under limits with stdout/stderr (and descriptor 3) going to
    files in io_dir, which only this process can read. Files, not pipes: the
    file-size limit then caps how much a program can print, and a program
    printing forever can't fill this process's memory."""
    out_path, err_path, res_path = (os.path.join(io_dir, name + ext) for ext in (".out", ".err", ".res"))
    with open(out_path, "wb") as out, open(err_path, "wb") as err, \
         (open(res_path, "wb") if results else open(os.devnull, "wb")) as res:
        cfg = {"limits": limits, "strict": strict, "cwd": cwd, "fd3": res.fileno() if results else None}
        user_args = {"user": uid, "group": uid, "extra_groups": []} if uid is not None else {}
        proc = subprocess.Popen(
            [sys.executable, "-c", LIMITER, json.dumps(cfg), *cmd],
            cwd="/", stdin=subprocess.DEVNULL, stdout=out, stderr=err,
            pass_fds=(res.fileno(),) if results else (),
            env={"PATH": "/usr/local/bin:/usr/bin:/bin", "LANG": "C.UTF-8", "TMPDIR": cwd, "HOME": cwd},
            start_new_session=True, close_fds=True, **user_args)
        timed_out = False
        try:
            proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
        # The whole process group, whether it finished or not: a program that
        # forked keeps no children running after its turn.
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        proc.wait()
    rc = proc.returncode
    return {
        "timed_out": timed_out,
        "exit_code": rc if rc is not None and rc >= 0 else None,
        "signal": SIGNALS.get(-rc, "signal %d" % -rc) if rc is not None and rc < 0 and not timed_out else None,
        "out_path": out_path, "err_path": err_path, "res_path": res_path,
    }


def _without_nproc(limits):
    # RLIMIT_NPROC counts every process of the user, and a developer's own
    # account already has hundreds: the compiler couldn't even start. In the
    # container each slot is a user of its own, so there it counts just the run.
    return {k: v for k, v in limits.items() if k != "RLIMIT_NPROC"}


def _compile_and_run(source, *, job, io_dir, uid=None, strict=False):
    compile_limits, run_limits = COMPILE_LIMITS, RUN_LIMITS
    if uid is None:
        compile_limits, run_limits = _without_nproc(compile_limits), _without_nproc(run_limits)
    with open(os.path.join(job, "main.cpp"), "w", encoding="utf-8") as f:
        f.write(source)
    if uid is not None:
        # mkdtemp made the folder 0700; handing it over makes it the slot
        # user's private folder. File first: once the folder is theirs, root
        # (without CAP_DAC_OVERRIDE) can't even look inside it.
        for path in (os.path.join(job, "main.cpp"), job):
            os.chown(path, uid, uid)

    comp = _exec([CXX, "-std=c++17", "-O1", "-pipe", "-fdiagnostics-color=never", "main.cpp", "-o", "prog"],
                 cwd=job, io_dir=io_dir, name="compile", limits=compile_limits,
                 timeout=COMPILE_TIMEOUT, uid=uid, strict=strict)
    compile_output = (_read(comp["out_path"])[0] + _read(comp["err_path"])[0]).strip()
    if comp["timed_out"] or comp["exit_code"] != 0:
        return {"compiled": False, "compile_output": compile_output, "timed_out": comp["timed_out"],
                "stdout": "", "stderr": "", "results": "", "exit_code": None, "signal": None,
                "output_limit": False}

    run = _exec(["./prog"], cwd=job, io_dir=io_dir, name="run", limits=run_limits,
                timeout=RUN_TIMEOUT, uid=uid, strict=strict, results=True)
    stdout, cut_out = _read(run["out_path"])
    stderr, cut_err = _read(run["err_path"])
    results, _ = _read(run["res_path"], limit=4 * MB)
    return {
        "compiled": True, "compile_output": compile_output,
        "stdout": stdout, "stderr": stderr, "results": results,
        "exit_code": run["exit_code"], "signal": run["signal"],
        "timed_out": run["timed_out"] or run["signal"] == "SIGXCPU",
        "output_limit": cut_out or cut_err or run["signal"] == "SIGXFSZ",
    }


def run_local(source):
    """Without Docker, on a developer's own computer (ACADEMY_CPP=1): the same
    compile and run, as the current user. Never on a public server."""
    if CXX is None:
        raise RuntimeError("no C++ compiler found")
    job = tempfile.mkdtemp(prefix="academy-cpp-")
    try:
        return _compile_and_run(source, job=job, io_dir=job)
    finally:
        shutil.rmtree(job, ignore_errors=True)


# ------------------------------------------------------------ the container

_slots = queue.Queue()


def _cleanup_as(uid, job):
    """As the slot's own user: kill every process it still has (kill(-1)
    reaches all of them, however they detached, and nobody else's), then
    delete its files. Running this as that user, not as root, is what makes
    'everything it started' exact."""
    subprocess.run(
        [sys.executable, "-c",
         "import os, shutil, signal, sys\n"
         "try:\n    os.kill(-1, signal.SIGKILL)\nexcept ProcessLookupError:\n    pass\n"
         "shutil.rmtree(sys.argv[1], ignore_errors=True)\n", job],
        user=uid, group=uid, extra_groups=[], cwd="/", env={"PATH": "/usr/bin:/bin"},
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20)


def run_sandboxed(source):
    try:
        slot = _slots.get(timeout=QUEUE_WAIT)
    except queue.Empty:
        return {"error": "busy"}
    uid = BASE_UID + slot
    job = tempfile.mkdtemp(dir=WORK, prefix="job-")
    io_dir = tempfile.mkdtemp(dir=os.path.join(WORK, ".io"))
    try:
        return _compile_and_run(source, job=job, io_dir=io_dir, uid=uid, strict=True)
    finally:
        try:
            _cleanup_as(uid, job)
        finally:
            shutil.rmtree(io_dir, ignore_errors=True)
            _slots.put(slot)


class _Handler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            line = self.rfile.readline(MAX_REQUEST + 1)
            request = json.loads(line)
            if request.get("ping"):
                reply = {"ok": True, "compiler": bool(CXX)}
            elif isinstance(request.get("source"), str) and len(request["source"]) <= MAX_SOURCE:
                reply = run_sandboxed(request["source"])
            else:
                reply = {"error": "bad_request"}
        except (ValueError, AttributeError):
            reply = {"error": "bad_request"}
        except Exception:  # noqa: BLE001 — answer, and keep serving
            traceback.print_exc()
            reply = {"error": "internal"}
        self.wfile.write(json.dumps(reply).encode() + b"\n")


class _Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True


def serve():
    if CXX is None:
        sys.exit("runner: no C++ compiler in this image")
    if os.getuid() != 0:
        sys.exit("runner: must start as root to switch to the per-slot users (see docker-compose.yml)")
    for n in range(SLOTS):
        _slots.put(n)
    # Output files: readable by this process only, never by learner programs.
    os.makedirs(os.path.join(WORK, ".io"), mode=0o700, exist_ok=True)
    os.chmod(os.path.join(WORK, ".io"), 0o700)
    # The socket: the app's group may connect, learner programs (other users,
    # other groups) can't even enter its folder.
    folder = os.path.dirname(SOCKET_PATH)
    os.makedirs(folder, exist_ok=True)
    os.chown(folder, 0, SOCKET_GROUP)
    os.chmod(folder, 0o750)
    if os.path.exists(SOCKET_PATH):
        os.unlink(SOCKET_PATH)
    server = _Server(SOCKET_PATH, _Handler)
    os.chown(SOCKET_PATH, 0, SOCKET_GROUP)
    os.chmod(SOCKET_PATH, 0o660)
    print("runner: %d slot(s), compiler %s, socket %s" % (SLOTS, CXX, SOCKET_PATH), flush=True)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    server.serve_forever()


def ping(path=SOCKET_PATH):
    """For the container's health check."""
    import socket
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
        s.settimeout(5)
        s.connect(path)
        s.sendall(b'{"ping": true}\n')
        return json.loads(s.makefile().readline())["ok"]


if __name__ == "__main__":
    if sys.argv[1:] == ["ping"]:
        sys.exit(0 if ping() else 1)
    serve()
