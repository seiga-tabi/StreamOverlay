# Palworld 전용 서버 설정 생성기

YORO Bot 공개 페이지의 `/bot/dedicated-server`는 Palworld 전용 서버용
`PalWorldSettings.ini`를 브라우저에서 생성하는 도구다.

## 설계 기준

- 비교 대상: [OP.GG 전용 서버 설정](https://op.gg/ko/palworld/dedicated-server-setting)
- 옵션과 경로의 기준: [Palworld 공식 Configuration parameters](https://docs.palworldgame.com/settings-and-operation/configuration/)
- 지원 문서 버전: Palworld Server Guide 1.0.2
- 지원 언어: 한국어, 일본어
- 지원 옵션: 공식 문서에서 확인한 주요 월드·팰·플레이어·거점·서버·시스템 옵션 48개

OP.GG의 분류, 검색, 옵션 키 표시, 범위 안내, INI 미리보기와 다운로드 흐름은
기능 분석에만 사용했다. YORO의 화면 구조, 문구, 설정 스키마와 보안 처리는
독립적으로 구현했다.

## 생성 정책

설정 생성기는 현재 기본값과 다른 옵션만 `OptionSettings`에 기록한다. 게임
업데이트로 기본값이 바뀌거나 더 이상 사용하지 않는 옵션이 생길 때 전체
기본값을 고정해서 덮어쓰는 위험을 줄이기 위한 정책이다.

문자열은 따옴표와 역슬래시를 이스케이프한다. 숫자 범위, 정수 여부, enum
allowlist, 제어 문자와 길이 제한을 검증하며 오류가 하나라도 있으면 복사와
다운로드를 차단한다.

## 비밀정보

`AdminPassword`와 `ServerPassword`는 React 메모리에만 유지한다.

- 서버 API로 전송하지 않는다.
- `localStorage`, cookie, URL, 로그에 저장하지 않는다.
- INI 미리보기에는 원문 대신 마스킹 문자를 표시한다.
- 사용자가 복사 또는 다운로드 버튼을 직접 누를 때만 원문이 INI에 포함된다.
- 페이지 새로고침 후 복원하지 않는다.

REST API와 RCON은 기본 비활성 상태이며, 화면에서 인터넷 직접 공개를 경고한다.
이 도구는 방화벽 변경, 포트 개방, 서버 재시작 또는 원격 명령 실행을 하지 않는다.

## 적용 경로

Windows:

```text
steamapps\common\PalServer\Pal\Saved\Config\WindowsServer\PalWorldSettings.ini
```

Linux:

```text
steamapps/common/PalServer/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini
```

서버를 한 번 실행해 디렉터리를 생성한 뒤 서버를 종료하고 파일을 교체한다.
`DefaultPalWorldSettings.ini`를 직접 수정해도 서버 설정에는 반영되지 않는다.

## 제한사항

- 모든 내부·deprecated·향후 예약 옵션을 제공하지 않는다.
- 서버 파일을 자동으로 업로드하거나 적용하지 않는다.
- 실제 수신 포트, NAT, 방화벽과 실행 인수는 별도로 설정해야 한다.
- Palworld 버전 업데이트 시 공식 문서와 기본 설정 파일을 다시 대조해야 한다.
