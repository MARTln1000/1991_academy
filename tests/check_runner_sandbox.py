"""Hostile C++ programs against the real runner container: each must fail, or
be stopped, and the runner must keep working afterwards.

Runs INSIDE the app container, which reaches the runner the way
/api/run-cpp does (minus the per-IP rate limit), so it checks the real
lockdown: docker-compose.yml, runner/Dockerfile and runner/cpp_runner.py
together. CI runs it after starting the site:

    docker compose exec -T app python - < tests/check_runner_sandbox.py

Prints one line per check, exits 1 if any failed. (Not a pytest file: it needs
the running containers.)
"""
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, "/app")
import app  # noqa: E402

HEADERS = "".join("#include <%s>\n" % h for h in (
    "unistd.h", "sys/socket.h", "sys/un.h", "netinet/in.h", "arpa/inet.h", "fstream", "cstring", "cerrno"))


def run(body):
    raw = app._run_cpp_program(app.build_cpp_program(HEADERS + body, "int main() { attack(); return 0; }"))
    return app.cpp_response(raw)


def kind(r):
    return (r.get("error") or {}).get("kind")


CHECKS = [
    ("programs run as an unprivileged user, with no capabilities", r'''
void attack() { ifstream s("/proc/self/status"); string l;
  while (getline(s, l)) if (l.rfind("Uid:", 0) == 0 || l.rfind("CapEff:", 0) == 0) cout << l << "\n"; }''',
     lambda r: "Uid:\t200" in r["output"] and "Uid:\t0\t" not in r["output"] and "CapEff:\t0000000000000000" in r["output"]),

    ("they can't become root", r'''
void attack() { cout << "setuid(0)=" << setuid(0) << "\n"; }''',
     lambda r: "setuid(0)=-1" in r["output"]),

    ("they have no network", r'''
void attack() { int s = socket(AF_INET, SOCK_STREAM, 0); sockaddr_in a{}; a.sin_family = AF_INET;
  a.sin_port = htons(53); inet_pton(AF_INET, "1.1.1.1", &a.sin_addr);
  cout << "connect=" << connect(s, (sockaddr*)&a, sizeof a) << "\n"; }''',
     lambda r: "connect=-1" in r["output"]),

    ("they can't open the app's socket", r'''
void attack() { int s = socket(AF_UNIX, SOCK_STREAM, 0); sockaddr_un a{}; a.sun_family = AF_UNIX;
  strcpy(a.sun_path, "/run/cpp/runner.sock");
  cout << "connect=" << connect(s, (sockaddr*)&a, sizeof a) << "\n"; }''',
     lambda r: "connect=-1" in r["output"]),

    ("the database, the app and .env aren't there", r'''
void attack() { for (auto p : {"/data/academy.db", "/app/app.py", "/app/.env", "/run/cpp", "/work/.io"}) {
  ifstream f(p); cout << p << (f.good() ? " READABLE" : " no") << "\n"; } }''',
     lambda r: r["output"].count(" no") == 5),

    ("they can't write outside their own folder", r'''
void attack() { ofstream f("/runner/cpp_runner.py", ios::app); ofstream g("/etc/passwd", ios::app);
  cout << "writable=" << f.good() << g.good() << "\n"; }''',
     lambda r: "writable=00" in r["output"]),

    ("a fork bomb is contained", r'''
void attack() { int n = 0; for (int i = 0; i < 1000; i++) { pid_t p = fork(); if (p == 0) { pause(); _exit(0); }
  if (p < 0) break; n++; } cout << "forked " << n << "\n"; }''',
     lambda r: r["output"].startswith("forked ") and int(r["output"].split()[1]) < 20),

    ("a memory hog is stopped", r'''
void attack() { for (int i = 0; i < 64; i++) { char* p = (char*)malloc(64 << 20);
  if (!p) { cout << "stopped at " << i * 64 << " MB\n"; return; } memset(p, 1, 64 << 20); } cout << "got 4 GB\n"; }''',
     lambda r: "got 4 GB" not in r["output"]),

    ("a disk filler is stopped", r'''
void attack() { ofstream f("big.bin"); string mb(1 << 20, 'x'); for (int i = 0; i < 200; i++) f << mb;
  cout << "wrote 200 MB\n"; }''',
     lambda r: kind(r) == "output_limit" and "wrote 200 MB" not in r["output"]),

    ("an endless loop times out", "void attack() { volatile long x = 0; for (;;) x++; }",
     lambda r: kind(r) == "timeout"),

    ("endless printing is capped", "void attack() { for (;;) puts(\"spam spam spam spam\"); }",
     lambda r: kind(r) == "output_limit" and len(r["output"]) <= app.CPP_OUTPUT_KEEP),

    ("a process left in the background is ended", r'''
void attack() { if (fork() == 0) { setsid(); if (fork() == 0) { for (;;) sleep(1); } _exit(0); }
  cout << "left one behind\n"; }''',
     lambda r: "left one behind" in r["output"]),
]


def main():
    ok = True
    for name, body, expect in CHECKS:
        started = time.time()
        r = run(body)
        passed = kind(r) not in ("unavailable", "busy", "compile") and expect(r)
        ok &= passed
        detail = (r.get("output") or "").strip().replace("\n", " | ")[:100]
        print("%s  %-58s %4.1fs  %s %s" % ("ok  " if passed else "FAIL", name, time.time() - started,
                                          r.get("error") or "", detail), flush=True)

    # After all that: the runner still works, for several learners at once
    started = time.time()
    with ThreadPoolExecutor(6) as pool:
        replies = list(pool.map(lambda i: run('void attack() { cout << "still fine %d"; }' % i), range(6)))
    passed = all(r["output"] == "still fine %d" % i and not r.get("error") for i, r in enumerate(replies))
    ok &= passed
    print("%s  %-58s %4.1fs" % ("ok  " if passed else "FAIL", "6 programs at once all run, afterwards",
                               time.time() - started))
    print("ALL CONTAINED" if ok else "SOME CHECKS FAILED")
    sys.exit(0 if ok else 1)


main()
