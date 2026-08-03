import fs from "node:fs";
import path from "node:path";

const stateRoot = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
if (!stateRoot) {
  process.stderr.write("사용법: remove-retired-tournament-state <state-directory>\n");
  process.exitCode = 2;
} else {
  const target = path.resolve(stateRoot, "tournaments.json");
  if (path.dirname(target) !== stateRoot) {
    process.stderr.write("안전하지 않은 state 경로입니다.\n");
    process.exitCode = 2;
  } else if (!fs.existsSync(target)) {
    process.stdout.write("삭제할 이전 대회 상태 파일이 없습니다.\n");
  } else {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      process.stderr.write("대회 상태 경로가 일반 파일이 아니므로 삭제하지 않았습니다.\n");
      process.exitCode = 2;
    } else {
      const value = JSON.parse(fs.readFileSync(target, "utf8")) as { version?: unknown; tournaments?: unknown };
      if (value.version !== 1 || !Array.isArray(value.tournaments)) {
        process.stderr.write("기존 대회 상태 schema가 아니므로 삭제하지 않았습니다.\n");
        process.exitCode = 2;
      } else {
        fs.unlinkSync(target);
        process.stdout.write("이전 대회 상태 파일을 삭제했습니다.\n");
      }
    }
  }
}
