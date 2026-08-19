import { useMemo, useState } from "react";
import {
  changedPalworldSettingKeys,
  createDefaultPalworldSettingValues,
  generatePalworldSettingsIni,
  palworldSettingDefinitions,
  validatePalworldSettingValues,
  type PalworldSettingCategory,
  type PalworldSettingDefinition,
  type PalworldSettingsLocale,
} from "./palworld-server-settings";

const settingsText = {
  ko: {
    eyebrow: "PALWORLD DEDICATED SERVER",
    title: "전용 서버 설정 만들기",
    description: "필요한 옵션만 조정해 PalWorldSettings.ini 파일을 만드세요. 모든 작업은 이 브라우저 안에서만 처리됩니다.",
    officialVersion: "Palworld 공식 서버 문서 1.0.2 기준",
    localOnly: "입력값은 YORO 서버로 전송하거나 계정에 저장하지 않습니다.",
    secretWarning: "관리자·접속 비밀번호는 미리보기에서 숨겨집니다. 복사·다운로드한 파일에는 입력한 값이 포함되므로 안전하게 보관하세요.",
    installTitle: "파일 적용 위치",
    installDescription: "서버를 한 번 실행해 설정 디렉터리를 만든 뒤 서버를 종료하고 파일을 교체하세요. DefaultPalWorldSettings.ini를 직접 수정해도 적용되지 않습니다.",
    windows: "Windows (Steam / SteamCMD)",
    linux: "Linux (SteamCMD)",
    officialGuide: "Palworld 공식 설정 문서",
    categories: "설정 분류",
    all: "전체",
    world: "월드",
    pal: "팰",
    player: "플레이어",
    base: "거점",
    server: "서버",
    system: "시스템",
    searchLabel: "설정 검색",
    searchPlaceholder: "설정 이름 또는 옵션 키 검색",
    resultCount: "개 설정",
    overrideCount: "개 변경됨",
    defaultValue: "기본값",
    changed: "변경됨",
    resetSetting: "이 설정 초기화",
    resetAll: "전체 초기화",
    noResults: "검색 조건에 맞는 설정이 없습니다.",
    previewTitle: "INI 미리보기",
    previewDescription: "게임 업데이트의 기본값 변경 영향을 줄이기 위해 변경한 옵션만 생성합니다.",
    noOverrides: "설정을 변경하면 이곳에 INI 미리보기가 표시됩니다.",
    copy: "INI 복사",
    download: "PalWorldSettings.ini 다운로드",
    copied: "INI 내용을 클립보드에 복사했습니다.",
    downloaded: "PalWorldSettings.ini 다운로드를 시작했습니다.",
    copyFailed: "클립보드 복사에 실패했습니다. 브라우저 권한을 확인하세요.",
    invalid: "입력 오류를 수정하면 복사하거나 다운로드할 수 있습니다.",
    errorInvalidNumber: "유효한 숫자를 입력하세요.",
    errorInteger: "정수만 입력할 수 있습니다.",
    errorMin: "최솟값보다 작습니다.",
    errorMax: "최댓값보다 큽니다.",
    errorControl: "줄바꿈과 제어 문자는 사용할 수 없습니다.",
    errorLength: "입력 가능한 길이를 초과했습니다.",
    errorFormat: "IP 주소 형식의 문자만 입력하세요.",
    errorUnsupported: "지원하지 않는 값을 선택했습니다.",
    securityTitle: "공개 포트 보안",
    securityDescription: "REST API와 RCON은 기본적으로 비활성 상태입니다. 활성화하더라도 인터넷에 직접 노출하지 말고 방화벽, VPN 또는 접근 제어 프록시를 사용하세요.",
  },
  ja: {
    eyebrow: "PALWORLD DEDICATED SERVER",
    title: "専用サーバー設定を作成",
    description: "必要なオプションだけを調整して PalWorldSettings.ini を作成できます。すべての処理はこのブラウザ内だけで行われます。",
    officialVersion: "Palworld公式サーバー文書 1.0.2準拠",
    localOnly: "入力値をYOROサーバーへ送信したり、アカウントへ保存したりしません。",
    secretWarning: "管理者・接続パスワードはプレビューで非表示になります。コピー・ダウンロードしたファイルには入力値が含まれるため、安全に保管してください。",
    installTitle: "ファイルの配置先",
    installDescription: "サーバーを一度起動して設定ディレクトリを作成し、サーバーを停止してからファイルを置き換えてください。DefaultPalWorldSettings.iniを直接編集しても反映されません。",
    windows: "Windows (Steam / SteamCMD)",
    linux: "Linux (SteamCMD)",
    officialGuide: "Palworld公式設定文書",
    categories: "設定カテゴリー",
    all: "すべて",
    world: "ワールド",
    pal: "パル",
    player: "プレイヤー",
    base: "拠点",
    server: "サーバー",
    system: "システム",
    searchLabel: "設定検索",
    searchPlaceholder: "設定名またはオプションキーを検索",
    resultCount: "件の設定",
    overrideCount: "件変更",
    defaultValue: "デフォルト",
    changed: "変更済み",
    resetSetting: "この設定をリセット",
    resetAll: "すべてリセット",
    noResults: "検索条件に一致する設定がありません。",
    previewTitle: "INIプレビュー",
    previewDescription: "ゲーム更新によるデフォルト値変更の影響を抑えるため、変更したオプションだけを生成します。",
    noOverrides: "設定を変更すると、ここにINIプレビューが表示されます。",
    copy: "INIをコピー",
    download: "PalWorldSettings.iniをダウンロード",
    copied: "INI内容をクリップボードへコピーしました。",
    downloaded: "PalWorldSettings.iniのダウンロードを開始しました。",
    copyFailed: "クリップボードへのコピーに失敗しました。ブラウザ権限を確認してください。",
    invalid: "入力エラーを修正するとコピーまたはダウンロードできます。",
    errorInvalidNumber: "有効な数値を入力してください。",
    errorInteger: "整数のみ入力できます。",
    errorMin: "最小値を下回っています。",
    errorMax: "最大値を超えています。",
    errorControl: "改行と制御文字は使用できません。",
    errorLength: "入力可能な長さを超えています。",
    errorFormat: "IPアドレス形式の文字だけを入力してください。",
    errorUnsupported: "対応していない値です。",
    securityTitle: "公開ポートのセキュリティ",
    securityDescription: "REST APIとRCONはデフォルトで無効です。有効にする場合もインターネットへ直接公開せず、ファイアウォール、VPN、またはアクセス制御プロキシを使用してください。",
  },
} as const;

const categoryOrder: Array<"all" | PalworldSettingCategory> = [
  "all",
  "world",
  "pal",
  "player",
  "base",
  "server",
  "system",
];

function settingErrorText(
  locale: PalworldSettingsLocale,
  code: ReturnType<typeof validatePalworldSettingValues>[number]["code"],
): string {
  const text = settingsText[locale];
  const errors = {
    invalid_number: text.errorInvalidNumber,
    integer_required: text.errorInteger,
    min_exceeded: text.errorMin,
    max_exceeded: text.errorMax,
    control_character: text.errorControl,
    too_long: text.errorLength,
    invalid_format: text.errorFormat,
    unsupported_value: text.errorUnsupported,
  };
  return errors[code];
}

function defaultDisplayValue(definition: PalworldSettingDefinition, locale: PalworldSettingsLocale): string {
  if (definition.options) {
    return definition.options.find((option) => option.value === definition.defaultValue)?.label[locale]
      ?? definition.defaultValue;
  }
  return definition.defaultValue === "" ? "—" : definition.defaultValue;
}

export function PalworldDedicatedServerSettings({ locale }: { locale: PalworldSettingsLocale }) {
  const text = settingsText[locale];
  const [category, setCategory] = useState<"all" | PalworldSettingCategory>("all");
  const [query, setQuery] = useState("");
  const [values, setValues] = useState(createDefaultPalworldSettingValues);
  const [announcement, setAnnouncement] = useState("");
  const changedKeys = useMemo(() => new Set(changedPalworldSettingKeys(values)), [values]);
  const errors = useMemo(() => validatePalworldSettingValues(values), [values]);
  const errorsByKey = useMemo(
    () => new Map(errors.map((error) => [error.key, error.code])),
    [errors],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase(locale === "ko" ? "ko-KR" : "ja-JP");
  const visibleSettings = useMemo(() => palworldSettingDefinitions.filter((definition) => {
    if (category !== "all" && definition.category !== category) return false;
    if (!normalizedQuery) return true;
    return [
      definition.key,
      definition.label[locale],
      definition.description[locale],
    ].some((value) => value.toLocaleLowerCase(locale === "ko" ? "ko-KR" : "ja-JP").includes(normalizedQuery));
  }), [category, locale, normalizedQuery]);
  const preview = changedKeys.size > 0 && errors.length === 0
    ? generatePalworldSettingsIni(values, { redactSecrets: true })
    : "";
  const canExport = changedKeys.size > 0 && errors.length === 0;

  const updateValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setAnnouncement("");
  };

  const resetSetting = (definition: PalworldSettingDefinition) => {
    updateValue(definition.key, definition.defaultValue);
  };

  const resetAll = () => {
    setValues(createDefaultPalworldSettingValues());
    setAnnouncement("");
  };

  const copyIni = async () => {
    if (!canExport) return;
    try {
      await navigator.clipboard.writeText(generatePalworldSettingsIni(values));
      setAnnouncement(text.copied);
    } catch {
      setAnnouncement(text.copyFailed);
    }
  };

  const downloadIni = () => {
    if (!canExport) return;
    const objectUrl = URL.createObjectURL(new Blob(
      [generatePalworldSettingsIni(values)],
      { type: "text/plain;charset=utf-8" },
    ));
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "PalWorldSettings.ini";
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    setAnnouncement(text.downloaded);
  };

  return (
    <section className="palworld-settings-page public-bot-page-section" id="bot-dedicated-server">
      <header className="palworld-settings-page__header">
        <span className="public-bot-eyebrow">{text.eyebrow}</span>
        <h1>{text.title}</h1>
        <p>{text.description}</p>
        <div className="palworld-settings-page__assurances">
          <span>{text.officialVersion}</span>
          <span>{text.localOnly}</span>
        </div>
      </header>

      <aside className="palworld-settings-security" role="note">
        <strong>{text.securityTitle}</strong>
        <p>{text.securityDescription}</p>
        <p>{text.secretWarning}</p>
      </aside>

      <section className="palworld-settings-paths" aria-labelledby="palworld-settings-paths-title">
        <div>
          <h2 id="palworld-settings-paths-title">{text.installTitle}</h2>
          <p>{text.installDescription}</p>
        </div>
        <div className="palworld-settings-paths__grid">
          <article>
            <strong>{text.windows}</strong>
            <code>steamapps\common\PalServer\Pal\Saved\Config\WindowsServer\PalWorldSettings.ini</code>
          </article>
          <article>
            <strong>{text.linux}</strong>
            <code>steamapps/common/PalServer/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini</code>
          </article>
        </div>
        <a href="https://docs.palworldgame.com/settings-and-operation/configuration/" rel="noopener noreferrer" target="_blank">
          {text.officialGuide}
        </a>
      </section>

      <div className="palworld-settings-toolbar">
        <fieldset className="palworld-settings-categories">
          <legend>{text.categories}</legend>
          <div>
            {categoryOrder.map((item) => (
              <button
                aria-pressed={category === item}
                className={category === item ? "is-active" : ""}
                key={item}
                onClick={() => setCategory(item)}
                type="button"
              >
                {text[item]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="palworld-settings-search">
          <span>{text.searchLabel}</span>
          <input
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={text.searchPlaceholder}
            type="search"
            value={query}
          />
        </label>
        <div className="palworld-settings-toolbar__summary" aria-live="polite">
          <span>{visibleSettings.length} {text.resultCount}</span>
          <strong>{changedKeys.size} {text.overrideCount}</strong>
          <button disabled={changedKeys.size === 0} onClick={resetAll} type="button">{text.resetAll}</button>
        </div>
      </div>

      <form className="palworld-settings-form" onSubmit={(event) => event.preventDefault()}>
        {visibleSettings.length > 0 ? visibleSettings.map((definition) => {
          const inputId = `palworld-setting-${definition.key}`;
          const errorId = `${inputId}-error`;
          const errorCode = errorsByKey.get(definition.key);
          const changed = changedKeys.has(definition.key);
          const value = values[definition.key] ?? definition.defaultValue;
          return (
            <article className={`palworld-setting-card${changed ? " is-changed" : ""}`} key={definition.key}>
              <div className="palworld-setting-card__heading">
                <div>
                  <label htmlFor={inputId}>{definition.label[locale]}</label>
                  <code>{definition.key}</code>
                </div>
                {changed ? <span>{text.changed}</span> : null}
              </div>
              <p>{definition.description[locale]}</p>
              <div className="palworld-setting-card__control">
                {definition.kind === "boolean" ? (
                  <label className="palworld-settings-switch">
                    <input
                      checked={value === "true"}
                      id={inputId}
                      onChange={(event) => updateValue(definition.key, String(event.currentTarget.checked))}
                      type="checkbox"
                    />
                    <span aria-hidden="true" />
                    <strong>{definition.options?.find((option) => option.value === value)?.label[locale]}</strong>
                  </label>
                ) : definition.kind === "select" ? (
                  <select
                    aria-describedby={errorCode ? errorId : undefined}
                    aria-invalid={errorCode ? "true" : undefined}
                    id={inputId}
                    onChange={(event) => updateValue(definition.key, event.currentTarget.value)}
                    value={value}
                  >
                    {definition.options?.map((option) => (
                      <option key={option.value} value={option.value}>{option.label[locale]}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-describedby={errorCode ? errorId : undefined}
                    aria-invalid={errorCode ? "true" : undefined}
                    id={inputId}
                    max={definition.max}
                    maxLength={definition.maxLength}
                    min={definition.min}
                    onChange={(event) => updateValue(definition.key, event.currentTarget.value)}
                    step={definition.step}
                    type={definition.kind === "password" ? "password" : definition.kind}
                    value={value}
                  />
                )}
                <small>{text.defaultValue}: {defaultDisplayValue(definition, locale)}</small>
              </div>
              {errorCode ? (
                <p className="palworld-setting-card__error" id={errorId} role="alert">
                  {settingErrorText(locale, errorCode)}
                </p>
              ) : null}
              {changed ? (
                <button
                  aria-label={`${definition.label[locale]}: ${text.resetSetting}`}
                  className="palworld-setting-card__reset"
                  onClick={() => resetSetting(definition)}
                  type="button"
                >
                  {text.resetSetting}
                </button>
              ) : null}
            </article>
          );
        }) : (
          <p className="palworld-settings-empty" role="status">{text.noResults}</p>
        )}
      </form>

      {/* 저장 동선 — 복사·다운로드가 페이지 맨 아래에만 있어(실측 7549px)
          설정을 고친 뒤 끝까지 내려가야 했습니다. 화면 하단 고정 바로 올립니다
          (목업 GameFiles 아트보드). */}
      <div className="palworld-settings-savebar">
        <div aria-live="polite" className="palworld-settings-savebar__state">
          <strong>{changedKeys.size} {text.overrideCount}</strong>
          <small>{text.previewDescription}</small>
        </div>
        <div className="palworld-settings-savebar__actions">
          <button disabled={!canExport} onClick={() => void copyIni()} type="button">{text.copy}</button>
          <button className="is-primary" disabled={!canExport} onClick={downloadIni} type="button">{text.download}</button>
        </div>
      </div>

      <section className="palworld-settings-preview" aria-labelledby="palworld-settings-preview-title">
        <div className="palworld-settings-preview__heading">
          <div>
            <h2 id="palworld-settings-preview-title">{text.previewTitle}</h2>
            <p>{text.secretWarning}</p>
          </div>
        </div>
        {errors.length > 0 ? <p className="palworld-settings-preview__error" role="alert">{text.invalid}</p> : null}
        {preview ? (
          <pre aria-label={text.previewTitle}><code>{preview}</code></pre>
        ) : (
          <p className="palworld-settings-preview__empty">{text.noOverrides}</p>
        )}
        <p aria-live="polite" className="palworld-settings-announcement">{announcement}</p>
      </section>
    </section>
  );
}
