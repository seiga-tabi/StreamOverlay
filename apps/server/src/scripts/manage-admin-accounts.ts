/*
 * 관리자 부분 권한 계정 관리 CLI.
 *
 * 사용법:
 *   tsx src/scripts/manage-admin-accounts.ts create --label "김운영" --permissions streamer_approval
 *   tsx src/scripts/manage-admin-accounts.ts list
 *   tsx src/scripts/manage-admin-accounts.ts disable --id <accountId>
 *   tsx src/scripts/manage-admin-accounts.ts enable --id <accountId>
 *
 * create는 토큰을 무작위로 생성해 화면에 "한 번만" 출력합니다 — 저장소에는
 * sha256 해시만 남기고 평문 토큰은 어디에도 보관하지 않으므로, 출력된 값을
 * 그 자리에서 반드시 복사해 두어야 합니다(분실 시 재발급 = 새 계정 생성).
 *
 * 이 스크립트는 서버 프로세스와 무관하게 admin-accounts.json 파일을 직접
 * 읽고 씁니다. 실행 중인 서버는 서브 계정 로그인 직전과 기존 서브 계정
 * 세션의 다음 인증 요청 직전에 파일을 재로드하므로 재시작할 필요가 없습니다.
 *
 * admin-accounts.json과 상위 디렉터리는 서버 프로세스가 읽을 수 있어야 하므로
 * 서버와 CLI를 같은 OS 사용자 권한으로 실행합니다. 다른 사용자로 실행하면
 * EACCES로 readiness가 unhealthy가 될 수 있습니다. 또한 이 CLI를 동시에 여러
 * 개 실행하면 마지막 저장이 다른 변경을 덮을 수 있으므로 직렬 실행합니다.
 */
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { appConfig } from "../config.js";
import { Store, type AdminAccount } from "../services/store.js";
import { ADMIN_PERMISSIONS, type AdminPermission } from "../security/auth.js";

function parseArgs(argv: string[]): { command: string; options: Record<string, string> } {
  const [command, ...rest] = argv;
  const options: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = rest[i + 1] && !rest[i + 1]!.startsWith("--") ? rest[i + 1]! : "";
    if (value) i += 1;
    options[key] = value;
  }
  return { command: command ?? "", options };
}

function printAccount(account: AdminAccount): void {
  console.log(`- id: ${account.id}`);
  console.log(`  label: ${account.label}`);
  console.log(`  permissions: ${account.permissions.join(", ")}`);
  console.log(`  createdAt: ${account.createdAt}`);
  console.log(`  disabled: ${account.disabled === true}`);
}

function createStore(): Store {
  return new Store({
    adminAccountStatePath: `${appConfig.paths.state}/admin-accounts.json`,
    onPersistenceError: (failure) => {
      console.error(`[persistence_error] scope=${failure.scope} operation=${failure.operation} error=${failure.error}`);
    }
  });
}

function printMutationWarnings(): void {
  console.warn("경고: admin-accounts.json은 서버 프로세스와 동일한 OS 사용자 권한으로 생성·수정해야 합니다.");
  console.warn("경고: 다른 OS 사용자로 실행하면 서버가 파일을 읽지 못해 readiness가 unhealthy가 될 수 있습니다.");
  console.warn("경고: 이 CLI를 동시에 실행하면 마지막 저장이 다른 변경을 덮을 수 있으므로 반드시 직렬로 실행하세요.");
}

function main(): void {
  const { command, options } = parseArgs(process.argv.slice(2));
  const store = createStore();

  if (command === "create") {
    const label = options.label?.trim();
    if (!label) {
      console.error("사용법: create --label <이름> --permissions <권한1,권한2,...>");
      process.exitCode = 1;
      return;
    }
    const requestedPermissions = [...new Set(
      (options.permissions ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )];
    if (requestedPermissions.length === 0) {
      console.error(`--permissions는 최소 1개 필요합니다. 사용 가능한 값: ${ADMIN_PERMISSIONS.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    const invalidPermissions = requestedPermissions.filter(
      (permission) => !ADMIN_PERMISSIONS.includes(permission as AdminPermission)
    );
    if (invalidPermissions.length > 0) {
      console.error(`알 수 없는 권한: ${invalidPermissions.join(", ")}. 사용 가능한 값: ${ADMIN_PERMISSIONS.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = store.hashAdminToken(token);
    const account = store.createAdminAccount({
      label,
      tokenHash,
      permissions: requestedPermissions as AdminPermission[]
    });
    console.log("관리자 계정이 생성되었습니다. 실행 중인 서버에는 다음 서브 계정 로그인부터 반영됩니다.");
    console.log("아래 토큰은 이번 한 번만 출력됩니다 — 반드시 지금 복사해 두세요.");
    console.log("");
    console.log(`TOKEN: ${token}`);
    console.log("");
    printAccount(account);
    printMutationWarnings();
    return;
  }

  if (command === "list") {
    const accounts = store.listAdminAccounts();
    if (accounts.length === 0) {
      console.log("등록된 관리자 서브 계정이 없습니다.");
      return;
    }
    for (const account of accounts) printAccount(account);
    return;
  }

  if (command === "disable" || command === "enable") {
    const id = options.id?.trim();
    if (!id) {
      console.error(`사용법: ${command} --id <accountId>`);
      process.exitCode = 1;
      return;
    }
    const updated = store.setAdminAccountDisabled(id, command === "disable");
    if (!updated) {
      console.error(`id가 ${id}인 계정을 찾을 수 없습니다.`);
      process.exitCode = 1;
      return;
    }
    console.log(command === "disable"
      ? "계정이 비활성화되었습니다. 실행 중인 서버는 이 계정의 다음 인증 요청에서 기존 세션을 모두 회수합니다."
      : "계정이 활성화되었습니다. 실행 중인 서버에는 다음 로그인부터 반영됩니다.");
    printAccount(updated);
    printMutationWarnings();
    return;
  }

  console.error("사용법: create | list | disable | enable");
  console.error("  create --label <이름> --permissions <권한1,권한2,...>");
  console.error(`    사용 가능한 권한: ${ADMIN_PERMISSIONS.join(", ")}`);
  console.error("  list");
  console.error("  disable --id <accountId>");
  console.error("  enable --id <accountId>");
  process.exitCode = 1;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) main();
