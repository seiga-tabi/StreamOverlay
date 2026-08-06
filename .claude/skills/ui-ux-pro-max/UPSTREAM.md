# Upstream metadata

- Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Version: `2.13.0`
- Commit: `abb7f2fd5a083fa1ff55c326a963ff0d95c33f99`
- Installed: `2026-08-06`
- License: MIT (`LICENSE` 참고)

## 로컬 적용 사항

프로젝트 skill과 nested working directory에서 모두 실행할 수 있도록
`SKILL.md`의 검색 명령 경로를 `${CLAUDE_PLUGIN_ROOT}/.claude/...`에서
`${CLAUDE_SKILL_DIR}/...`로 변경했다.

## 업데이트 절차

1. 새 버전의 `SKILL.md`, `data/`, `references/`, `scripts/`를 임시 디렉터리에서 검토한다.
2. 네트워크 접근, 외부 프로세스 실행, 삭제 및 쓰기 범위를 다시 감사한다.
3. 이 디렉터리를 갱신하되 위의 프로젝트 로컬 경로 변경을 유지한다.
4. `UPSTREAM.md`의 버전과 커밋을 갱신한다.
5. 아래 검증 명령을 실행한다.

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/validate_data.py
python3 -m unittest discover .claude/skills/ui-ux-pro-max/scripts/tests
```
