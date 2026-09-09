#!/usr/bin/env python3
"""실제 Docker 없이 격리된 임시 경로와 PATH 모의 명령으로 배포 흐름을 검증한다."""
import json
import os
import re
import sys
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("deploy.sh")
MOCK = r'''#!/usr/bin/env python3
import hashlib, json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
args = sys.argv[1:]
root = Path(os.environ["MOCK_ROOT"])
scenario = os.environ["MOCK_SCENARIO"]
with (root / "calls").open("a") as log:
    log.write(json.dumps([name, *args]) + "\n")
def emit(value, code=0):
    print(json.dumps(value))
    sys.exit(code)
def count(key):
    p = root / key
    n = int(p.read_text()) + 1 if p.exists() else 1
    p.write_text(str(n))
    return n
if name == "git":
    if args == ["status", "--short"] and scenario == "dirty": print(" M example.txt")
    elif args == ["rev-parse", "--short", "HEAD"]: print("abc1234")
elif name == "flock":
    sys.exit(1 if scenario == "locked" else 0)
elif name == "sha256sum":
    if args[0] == "-c":
        if scenario == "checksum_fail": sys.exit(1)
        digest, filename = Path(args[1]).read_text().strip().split("  ", 1)
        sys.exit(0 if hashlib.sha256(Path(filename).read_bytes()).hexdigest() == digest else 1)
    print(hashlib.sha256(Path(args[0]).read_bytes()).hexdigest() + "  " + args[0])
elif name == "df":
    if scenario == "disk_query_fail": sys.exit(1)
    print("Filesystem 1024-blocks Used Available Capacity Mounted on")
    available = "broken" if scenario == "disk_invalid" else "1048576" if scenario == "disk_low" else "104857600"
    print(f"fixture 209715200 1 {available} 1% /backup")
elif name == "curl":
    body = Path(args[args.index("-o") + 1])
    body.write_text('{"ok":false,"reason":"fixture"}' if scenario in ("health_fail", "pending_health_fail") else '{"ok":true}')
    print("503" if scenario in ("health_fail", "pending_health_fail") else "200", end="")
elif name == "docker":
    if args[:2] == ["image", "inspect"]:
        n = count("image-count")
        print("sha256:changed" if (scenario == "image_changed" and n > 3) or (scenario == "image_changed_before_apply" and n > 4) else "sha256:fixture")
    elif args[:2] == ["compose", "config"]:
        if "--format" in args:
            if scenario == "config_fallback": sys.exit(1)
            emit({"services": {"server": {"image": "fixture-server"}, "postgres": {
                "image": "postgres:16.6-bookworm", "environment": {
                    "POSTGRES_USER": "custom_user", "POSTGRES_DB": "custom_db",
                    "POSTGRES_PASSWORD": "DO_NOT_PRINT_FIXTURE_SECRET"}}}})
    elif args[:2] == ["compose", "build"]:
        if scenario == "build_fail": sys.exit(1)
    elif args[:2] == ["compose", "run"]:
        command = args[args.index("apps/server/dist/scripts/database-migrate.js") + 1]
        if command == "check":
            n = count("check-count")
            if scenario == "check_exec_fail": sys.exit(1)
            if scenario == "invalid_json": print("garbage"); sys.exit(0)
            status = "ready" if scenario in ("ready", "dirty", "up_fail", "health_fail", "bot_unhealthy") or n > 1 else "pending"
            if scenario == "mismatch": status = "mismatch"
            if scenario == "post_pending": status = "pending"
            emit({"command": "check", "status": status, "applied": 27 if status != "ready" else 28,
                  "pending": 0 if status == "ready" else 1},
                 0 if status == "ready" or scenario == "bad_exit" else 2)
        elif command == "plan":
            n = count("plan-count")
            if scenario == "plan_mismatch": emit({"command": "plan", "status": "mismatch", "pending": []})
            if scenario == "plan_empty": emit({"command": "plan", "status": "pending", "pending": []})
            emit({"command": "plan", "status": "pending", "pending": [{
                "id": "0029_changed" if scenario == "plan_changed" and n > 1 else "0028_fixture",
                "description": "검증용 migration", "transaction": True,
                "destructive": scenario == "destructive" or (scenario == "final_destructive" and n > 1)}]})
        elif command == "apply":
            # 실패해도 유효한 결과를 출력해 JSON 검증과 종료 코드 검증을 분리한다.
            emit({"command": "apply", "applied": 1, "migrationIds": ["0029_unexpected" if scenario == "apply_ids_changed" else "0028_fixture"]}, 1 if scenario == "apply_fail" else 0)
        else: sys.exit(97)
    elif args[:2] == ["compose", "exec"]:
        if "psql" in args:
            if scenario == "db_size_fail": print("1048576"); sys.exit(1)
            print("invalid" if scenario == "db_size_invalid" else "1048576")
            sys.exit(0)
        print("fixture-archive")
        if scenario == "backup_fail": sys.exit(1)
    elif args[:2] == ["run", "--rm"]:
        if "--list" in args:
            # TOC 일부를 출력한 뒤 실패해도 종료 코드만으로 반드시 중단해야 한다.
            if scenario != "archive_empty": print("123; 1259 456 TABLE public fixture owner")
            if scenario == "archive_fail": sys.exit(1)
        elif args[args.index("pg_restore") + 1:][:2] == ["-f", "/dev/null"]:
            if scenario == "archive_data_fail": sys.exit(1)
        else: sys.exit(96)
    elif args[:2] == ["compose", "up"]:
        if scenario == "up_fail": print("fixture config-check failure"); sys.exit(1)
    elif args[:2] == ["compose", "stop"]:
        if scenario == "stop_fail": sys.exit(1)
    elif args[:2] == ["compose", "ps"]:
        if "--format" in args:
            emit([{"Service": service, "State": "running", "Health":
                   "unhealthy" if scenario == "bot_unhealthy" and service == "discord-bot" else "healthy"}
                  for service in ("server", "discord-bot")])
    else:
        print("예상하지 못한 Docker 명령", file=sys.stderr)
        sys.exit(98)
else: sys.exit(99)
'''


class DeployTest(unittest.TestCase):
    def run_case(self, scenario, flags=(), stdin="", success=False):
        with tempfile.TemporaryDirectory(prefix="yoro-deploy-test-") as folder:
            root = Path(folder)
            bindir = root / "bin"
            bindir.mkdir()
            for command in ("docker", "git", "flock", "curl", "sha256sum", "df"):
                executable = bindir / command
                executable.write_text(MOCK)
                executable.chmod(0o755)
            # 운영 경로를 테스트 사본에서만 치환한다. 실제 스크립트에는 우회 옵션이 없다.
            content = SCRIPT.read_text().replace("/var/run/yoro-deploy.lock", str(root / "deploy.lock"))
            content = content.replace("/var/backups/yoro/postgres", str(root / "backups"))
            if scenario in ("health_fail", "bot_unhealthy", "pending_health_fail"):
                content = content.replace("SECONDS + 180", "SECONDS + 1")
            script = root / "deploy.sh"
            script.write_text(content)
            result = subprocess.run(["bash", str(script), *flags], input=stdin, text=True,
                                    capture_output=True, timeout=15, env={**os.environ,
                                    "PATH": str(bindir) + os.pathsep + os.environ["PATH"],
                                    "MOCK_ROOT": str(root), "MOCK_SCENARIO": scenario})
            output = result.stdout + result.stderr
            self.assertEqual(result.returncode == 0, success, output)
            self.assertNotIn("DO_NOT_PRINT_FIXTURE_SECRET", output)
            calls = [json.loads(line) for line in (root / "calls").read_text().splitlines()]
            self.assertFalse(any("--allow-destructive" in c for c in calls))
            self.assertFalse(any("down" in c for c in calls))
            for call in calls:
                if call[:3] == ["docker", "compose", "run"]:
                    self.assertIn("-T", call)
            dumps = list((root / "backups").glob("*.dump"))
            partials = list((root / "backups").glob("*.partial"))
            if scenario == "backup_fail":
                self.assertEqual(len(partials), 1)
                self.assertEqual(dumps, [])
            for dump in dumps:
                self.assertEqual(dump.stat().st_mode & 0o777, 0o600)
                self.assertEqual(Path(str(dump) + ".sha256").stat().st_mode & 0o777, 0o600)
                self.assertEqual(dump.parent.stat().st_mode & 0o777, 0o700)
            return calls, output

    @staticmethod
    def has(calls, token):
        return any(token in call for call in calls)

    def test_ready(self):
        calls, _ = self.run_case("ready", success=True)
        for token in ("plan", "pg_dump", "stop", "apply"):
            self.assertFalse(self.has(calls, token))
        self.assertTrue(self.has(calls, "up"))

    def test_pending(self):
        calls, output = self.run_case("pending", stdin="yes\n", success=True)
        operations = [token for c in calls for token in c
                      if token in ("build", "check", "plan", "psql", "pg_dump", "pg_restore", "stop", "apply", "up")]
        self.assertEqual(operations, ["build", "check", "plan", "psql", "pg_dump", "pg_restore", "pg_restore",
                                      "stop", "plan", "apply", "check", "up"])
        dump = next(c for c in calls if "pg_dump" in c)
        self.assertIn("custom_user", dump)
        self.assertIn("custom_db", dump)
        archives = [c for c in calls if "pg_restore" in c]
        self.assertEqual(len(archives), 2)
        self.assertIn("--list", archives[0])
        self.assertEqual(archives[1][archives[1].index("pg_restore") + 1:][:2], ["-f", "/dev/null"])
        for archive in archives:
            for token in ("--network", "none", "--read-only", "--tmpfs"):
                self.assertIn(token, archive)
        apply = next(c for c in calls if "apply" in c)
        self.assertEqual(apply[apply.index("apply"):], ["apply", "--apply", "--confirm-production"])
        self.assertLess(next(i for i, c in enumerate(calls) if c[0] == "df"),
                        next(i for i, c in enumerate(calls) if "pg_dump" in c))
        self.assertIn("0028_fixture", output)

    def test_auto_confirm(self):
        self.run_case("pending", ("--yes",), success=True)
        self.run_case("pending", ("--auto-confirm",), success=True)

    def test_pre_apply_failures(self):
        for scenario in ("destructive", "backup_fail", "archive_fail", "archive_empty",
                         "checksum_fail", "plan_changed", "final_destructive", "mismatch",
                         "archive_data_fail", "plan_mismatch", "plan_empty", "invalid_json", "bad_exit", "locked", "build_fail", "stop_fail", "image_changed"):
            with self.subTest(scenario=scenario):
                calls, _ = self.run_case(scenario, ("--yes",))
                self.assertFalse(self.has(calls, "apply"))
                self.assertFalse(self.has(calls, "up"))

    def test_no_restart_after_apply_failure(self):
        for scenario in ("apply_fail", "post_pending", "apply_ids_changed"):
            with self.subTest(scenario=scenario):
                calls, output = self.run_case(scenario, ("--yes",))
                self.assertTrue(self.has(calls, "apply"))
                self.assertFalse(self.has(calls, "up"))
                self.assertIn("자동 down 없음", output)
                if scenario == "apply_fail":
                    self.assertIn("일부 migration은 이미 commit", output)
                else:
                    self.assertNotIn("일부 migration은 이미 commit", output)
                if scenario == "post_pending":
                    self.assertIn('이후 check: {"command":"check","status":"pending"', output)

    def test_approval(self):
        for stdin in ("", "no\n"):
            calls, _ = self.run_case("pending", stdin=stdin)
            self.assertFalse(self.has(calls, "pg_dump"))
        calls, _ = self.run_case("dirty", ("--yes",))
        self.assertFalse(self.has(calls, "build"))
        self.run_case("dirty", ("--yes",), stdin="yes\n", success=True)

    def test_dry_run(self):
        for scenario in ("ready", "pending", "destructive"):
            calls, _ = self.run_case(scenario, ("--dry-run",), success=scenario != "destructive")
            for token in ("build", "pg_dump", "stop", "apply", "up"):
                self.assertFalse(self.has(calls, token))
            for c in calls:
                if c[:3] == ["docker", "compose", "run"]:
                    self.assertIn("--no-deps", c)
                    self.assertIn("--pull", c)
                    self.assertIn("never", c)

    def test_health_and_up_failure_report(self):
        for scenario in ("health_fail", "bot_unhealthy", "up_fail"):
            calls, output = self.run_case(scenario)
            self.assertIn("마지막 응답 본문", output)
            self.assertIn("배포 기록", output)
            self.assertEqual(calls[-1], ["docker", "compose", "ps", "-a"])
        self.assertIn("fixture config-check failure", output)

    def test_config_extraction_fails_closed(self):
        for flags in (("--yes",), ("--dry-run",)):
            calls, output = self.run_case("config_fallback", flags)
            self.assertIn("Compose 설정 추출 실패", output)
            for token in ("inspect", "check", "pg_dump", "stop", "apply", "up"):
                self.assertFalse(self.has(calls, token))

    def test_disk_preflight(self):
        for scenario in ("disk_low", "disk_query_fail", "disk_invalid", "db_size_fail", "db_size_invalid"):
            with self.subTest(scenario=scenario):
                calls, _ = self.run_case(scenario, ("--yes",))
                for token in ("pg_dump", "stop", "apply", "up"):
                    self.assertFalse(self.has(calls, token))

    def test_check_diagnostics(self):
        for scenario, message in (("check_exec_fail", "의존 서비스 config-check"),
                                  ("mismatch", "migration 이력 mismatch"),
                                  ("invalid_json", "check 결과 JSON 형식/상태 오류")):
            with self.subTest(scenario=scenario):
                calls, output = self.run_case(scenario, ("--yes",))
                self.assertIn(message, output)
                self.assertFalse(self.has(calls, "apply"))
                if scenario == "check_exec_fail":
                    self.assertNotIn("mismatch", output)
                    self.assertNotIn("JSON 형식/상태 오류", output)

    def test_health_failure_after_ready(self):
        calls, output = self.run_case("pending_health_fail", ("--yes",))
        self.assertTrue(self.has(calls, "apply"))
        self.assertTrue(self.has(calls, "up"))
        self.assertIn("DB migration 상태는 ready", output)
        self.assertNotIn("일부 migration은 이미 commit", output)
        self.assertNotIn("writer가 중지", output)

    def test_image_failure_before_apply(self):
        calls, output = self.run_case("image_changed_before_apply", ("--yes",))
        self.assertTrue(self.has(calls, "stop"))
        self.assertFalse(self.has(calls, "apply"))
        self.assertFalse(self.has(calls, "up"))
        self.assertIn("server 이미지가 바뀌었습니다", output)
        self.assertNotIn("일부 migration은 이미 commit", output)

    def test_health_budget(self):
        budget = re.search(r"deadline=\$\(\(SECONDS \+ (\d+)\)\)", SCRIPT.read_text())
        self.assertIsNotNone(budget)
        self.assertGreaterEqual(int(budget.group(1)), 150)


def run_mutations():
    """운영 파일 대신 임시 사본에서 안전장치 6종을 하나씩 무력화한다."""
    global SCRIPT
    original = SCRIPT
    source = original.read_text()
    mutations = [
        ("destructive 차단 제거", "destructive", "if jq -e 'any(.pending[]; .destructive)'", "if false && jq -e 'any(.pending[]; .destructive)'"),
        ("pg_dump 종료 코드 무시", "backup_fail", 'fail "pg_dump 실패. 조사용 파일을 보존했습니다: $backup_path.partial (백업으로 사용 금지)"', "true"),
        ("pg_restore TOC 종료 코드 무시", "archive_fail", "fail 'pg_restore --list 실패. 백업을 확인하십시오. apply하지 않습니다.'", "true"),
        ("TOC 빈 목록 차단 제거", "archive_empty", "fail '복원 가능한 archive 목록이 비어 있습니다. apply하지 않습니다.'", "true"),
        ("checksum 실패 무시", "checksum_fail", "fail '백업 checksum 검증 실패. 파일 손상·경로·권한을 확인하십시오. apply하지 않습니다.'", "true"),
        ("apply 종료 코드 무시", "apply_fail", "fail 'apply 실패. 런북 §10·§11에 따라 실패 ID, timeout, advisory lock 및 백업을 확인하십시오.'", "true"),
    ]
    detected = 0
    try:
        with tempfile.TemporaryDirectory(prefix="yoro-deploy-mutations-") as folder:
            SCRIPT = Path(folder) / "deploy.sh"
            for label, scenario, old, new in mutations:
                if source.count(old) != 1:
                    raise RuntimeError(f"변이 대상이 유일하지 않습니다: {label}")
                SCRIPT.write_text(source.replace(old, new, 1))
                case = DeployTest()
                try:
                    calls, _ = case.run_case(scenario, ("--yes",))
                    case.assertFalse(case.has(calls, "up"))
                    if scenario != "apply_fail":
                        case.assertFalse(case.has(calls, "apply"))
                except AssertionError:
                    detected += 1
                    print(f"탐지: {label}")
                else:
                    print(f"미탐지: {label}")
    finally:
        SCRIPT = original
    print(f"변이 탐지: {detected}/{len(mutations)}")
    return 0 if detected == len(mutations) else 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--mutations"]:
        sys.exit(run_mutations())
    unittest.main(verbosity=2)
