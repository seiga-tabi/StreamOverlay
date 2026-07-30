export type PalworldSettingsLocale = "ko" | "ja";
export type PalworldSettingCategory =
  | "world"
  | "pal"
  | "player"
  | "base"
  | "server"
  | "system";
export type PalworldSettingKind = "boolean" | "number" | "password" | "select" | "text";

type LocalizedText = Record<PalworldSettingsLocale, string>;

export type PalworldSettingOption = {
  label: LocalizedText;
  value: string;
};

export type PalworldSettingDefinition = {
  category: PalworldSettingCategory;
  defaultValue: string;
  description: LocalizedText;
  integer?: boolean;
  key: string;
  kind: PalworldSettingKind;
  label: LocalizedText;
  max?: number;
  maxLength?: number;
  min?: number;
  options?: readonly PalworldSettingOption[];
  precision?: number;
  step?: number;
  valueFormat?: "ip";
};

export type PalworldSettingValues = Record<string, string>;

export type PalworldSettingValidationCode =
  | "control_character"
  | "integer_required"
  | "invalid_format"
  | "invalid_number"
  | "max_exceeded"
  | "min_exceeded"
  | "too_long"
  | "unsupported_value";

export type PalworldSettingValidationError = {
  code: PalworldSettingValidationCode;
  key: string;
};

const booleanOptions = [
  { value: "true", label: { ko: "사용", ja: "有効" } },
  { value: "false", label: { ko: "사용 안 함", ja: "無効" } },
] as const;

const numberSetting = (
  key: string,
  category: PalworldSettingCategory,
  defaultValue: number,
  label: LocalizedText,
  description: LocalizedText,
  options: Pick<PalworldSettingDefinition, "integer" | "max" | "min" | "precision" | "step">,
): PalworldSettingDefinition => ({
  category,
  defaultValue: String(defaultValue),
  description,
  key,
  kind: "number",
  label,
  ...options,
});

const booleanSetting = (
  key: string,
  category: PalworldSettingCategory,
  defaultValue: boolean,
  label: LocalizedText,
  description: LocalizedText,
): PalworldSettingDefinition => ({
  category,
  defaultValue: String(defaultValue),
  description,
  key,
  kind: "boolean",
  label,
  options: booleanOptions,
});

export const palworldSettingDefinitions: readonly PalworldSettingDefinition[] = [
  numberSetting(
    "DayTimeSpeedRate",
    "world",
    1,
    { ko: "낮 경과 속도", ja: "昼の経過速度" },
    { ko: "낮 시간의 진행 배율입니다. 낮을수록 낮이 길어집니다.", ja: "昼時間の進行倍率です。低いほど昼が長くなります。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "NightTimeSpeedRate",
    "world",
    1,
    { ko: "밤 경과 속도", ja: "夜の経過速度" },
    { ko: "밤 시간의 진행 배율입니다. 낮을수록 밤이 길어집니다.", ja: "夜時間の進行倍率です。低いほど夜が長くなります。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "ExpRate",
    "world",
    1,
    { ko: "경험치 획득 배율", ja: "経験値倍率" },
    { ko: "플레이어와 팰이 획득하는 경험치 배율입니다.", ja: "プレイヤーとパルが獲得する経験値の倍率です。" },
    { min: 0.1, max: 20, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "CollectionDropRate",
    "world",
    1,
    { ko: "채집 자원량 배율", ja: "採集資源量倍率" },
    { ko: "광석, 나무 등 채집 오브젝트에서 얻는 자원량 배율입니다.", ja: "鉱石や木などの採集オブジェクトから得る資源量の倍率です。" },
    { min: 0.5, max: 3, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "CollectionObjectRespawnSpeedRate",
    "world",
    1,
    { ko: "채집물 재생성 속도", ja: "採集物リスポーン速度" },
    { ko: "채집 오브젝트가 다시 생성되는 속도 배율입니다.", ja: "採集オブジェクトが再生成される速度倍率です。" },
    { min: 0.5, max: 3, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "EnemyDropItemRate",
    "world",
    1,
    { ko: "적 드롭 아이템 배율", ja: "敵ドロップ倍率" },
    { ko: "적이나 팰 처치 시 드롭되는 아이템 수량 배율입니다.", ja: "敵やパルを倒した際のドロップ数倍率です。" },
    { min: 0.5, max: 3, step: 0.1, precision: 6 },
  ),
  {
    category: "world",
    defaultValue: "Item",
    description: {
      ko: "사망 시 떨어뜨리는 소지품 범위를 정합니다.",
      ja: "死亡時に落とす所持品の範囲を設定します。",
    },
    key: "DeathPenalty",
    kind: "select",
    label: { ko: "사망 페널티", ja: "死亡ペナルティ" },
    options: [
      { value: "None", label: { ko: "없음", ja: "なし" } },
      { value: "Item", label: { ko: "아이템", ja: "アイテム" } },
      { value: "ItemAndEquipment", label: { ko: "아이템과 장비", ja: "アイテムと装備" } },
      { value: "All", label: { ko: "아이템·장비·보유 팰", ja: "アイテム・装備・所持パル" } },
    ],
  },
  numberSetting(
    "SupplyDropSpan",
    "world",
    180,
    { ko: "보급품 투하 간격", ja: "補給物資の投下間隔" },
    { ko: "보급품 투하 이벤트 간격입니다. 단위는 분입니다.", ja: "補給物資イベントの間隔です。単位は分です。" },
    { min: 1, max: 999, step: 1, integer: true },
  ),
  numberSetting(
    "PalCaptureRate",
    "pal",
    1,
    { ko: "팰 포획 확률 배율", ja: "パル捕獲率倍率" },
    { ko: "팰 포획 성공률에 적용되는 배율입니다.", ja: "パルの捕獲成功率に適用される倍率です。" },
    { min: 0.5, max: 2, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PalSpawnNumRate",
    "pal",
    1,
    { ko: "팰 출현 수 배율", ja: "パル出現数倍率" },
    { ko: "야생 팰 출현 수 배율입니다. 높은 값은 서버 부하를 늘릴 수 있습니다.", ja: "野生パルの出現数倍率です。高い値はサーバー負荷を増やす場合があります。" },
    { min: 0.5, max: 3, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PalDamageRateAttack",
    "pal",
    1,
    { ko: "팰 공격 피해 배율", ja: "パル攻撃ダメージ倍率" },
    { ko: "팰이 주는 피해량 배율입니다.", ja: "パルが与えるダメージの倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PalDamageRateDefense",
    "pal",
    1,
    { ko: "팰 피격 피해 배율", ja: "パル被ダメージ倍率" },
    { ko: "팰이 받는 피해량 배율입니다.", ja: "パルが受けるダメージの倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PalStomachDecreaceRate",
    "pal",
    1,
    { ko: "팰 허기 감소 배율", ja: "パル空腹減少倍率" },
    { ko: "팰의 허기가 감소하는 속도 배율입니다.", ja: "パルの空腹が減少する速度倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PalStaminaDecreaceRate",
    "pal",
    1,
    { ko: "팰 스태미나 소비 배율", ja: "パルスタミナ消費倍率" },
    { ko: "팰의 스태미나가 소비되는 속도 배율입니다.", ja: "パルのスタミナ消費速度倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PalAutoHPRegeneRate",
    "pal",
    1,
    { ko: "팰 자연 회복 배율", ja: "パル自然回復倍率" },
    { ko: "팰의 자연 체력 회복 배율입니다.", ja: "パルの自然HP回復倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PalEggDefaultHatchingTime",
    "pal",
    1,
    { ko: "거대한 알 부화 시간", ja: "巨大タマゴ孵化時間" },
    { ko: "거대한 알 기준 부화 시간입니다. 단위는 시간입니다.", ja: "巨大タマゴを基準にした孵化時間です。単位は時間です。" },
    { min: 0, max: 240, step: 0.25, precision: 6 },
  ),
  numberSetting(
    "PlayerDamageRateAttack",
    "player",
    1,
    { ko: "플레이어 공격 피해 배율", ja: "プレイヤー攻撃ダメージ倍率" },
    { ko: "플레이어가 주는 피해량 배율입니다.", ja: "プレイヤーが与えるダメージの倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PlayerDamageRateDefense",
    "player",
    1,
    { ko: "플레이어 피격 피해 배율", ja: "プレイヤー被ダメージ倍率" },
    { ko: "플레이어가 받는 피해량 배율입니다.", ja: "プレイヤーが受けるダメージの倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PlayerStomachDecreaceRate",
    "player",
    1,
    { ko: "플레이어 허기 감소 배율", ja: "プレイヤー空腹減少倍率" },
    { ko: "플레이어의 허기가 감소하는 속도 배율입니다.", ja: "プレイヤーの空腹が減少する速度倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PlayerStaminaDecreaceRate",
    "player",
    1,
    { ko: "플레이어 스태미나 소비 배율", ja: "プレイヤースタミナ消費倍率" },
    { ko: "플레이어의 스태미나가 소비되는 속도 배율입니다.", ja: "プレイヤーのスタミナ消費速度倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "PlayerAutoHPRegeneRate",
    "player",
    1,
    { ko: "플레이어 자연 회복 배율", ja: "プレイヤー自然回復倍率" },
    { ko: "플레이어의 자연 체력 회복 배율입니다.", ja: "プレイヤーの自然HP回復倍率です。" },
    { min: 0.1, max: 5, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "ItemWeightRate",
    "player",
    1,
    { ko: "아이템 무게 배율", ja: "アイテム重量倍率" },
    { ko: "모든 아이템 무게에 적용되는 배율입니다.", ja: "すべてのアイテム重量に適用される倍率です。" },
    { min: 0, max: 10, step: 0.1, precision: 6 },
  ),
  booleanSetting(
    "bEnableFastTravel",
    "player",
    true,
    { ko: "빠른 이동", ja: "ファストトラベル" },
    { ko: "월드의 빠른 이동 기능을 사용합니다.", ja: "ワールドのファストトラベル機能を有効にします。" },
  ),
  booleanSetting(
    "bShowPlayerList",
    "player",
    false,
    { ko: "플레이어 목록 표시", ja: "プレイヤーリスト表示" },
    { ko: "ESC 메뉴에 플레이어 목록을 표시합니다.", ja: "ESCメニューにプレイヤーリストを表示します。" },
  ),
  numberSetting(
    "BaseCampMaxNum",
    "base",
    128,
    { ko: "월드 전체 거점 수", ja: "ワールド全体の拠点数" },
    { ko: "월드 전체에 존재할 수 있는 거점의 최대 수입니다.", ja: "ワールド全体に存在できる拠点の最大数です。" },
    { min: 1, step: 1, integer: true },
  ),
  numberSetting(
    "BaseCampMaxNumInGuild",
    "base",
    4,
    { ko: "길드당 거점 수", ja: "ギルドごとの拠点数" },
    { ko: "길드 하나가 보유할 수 있는 거점의 최대 수입니다.", ja: "1ギルドが所有できる拠点の最大数です。" },
    { min: 1, max: 10, step: 1, integer: true },
  ),
  numberSetting(
    "BaseCampWorkerMaxNum",
    "base",
    15,
    { ko: "거점 작업 팰 수", ja: "拠点作業パル数" },
    { ko: "거점 한 곳에 배치할 수 있는 작업 팰의 최대 수입니다.", ja: "1拠点に配置できる作業パルの最大数です。" },
    { min: 1, max: 50, step: 1, integer: true },
  ),
  numberSetting(
    "BuildObjectDamageRate",
    "base",
    1,
    { ko: "건축물 피격 피해 배율", ja: "建築物被ダメージ倍率" },
    { ko: "건축물이 받는 피해량 배율입니다.", ja: "建築物が受けるダメージの倍率です。" },
    { min: 0.5, max: 3, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "BuildObjectDeteriorationDamageRate",
    "base",
    1,
    { ko: "건축물 노후 피해 배율", ja: "建築物劣化ダメージ倍率" },
    { ko: "거점 밖 건축물이 자연 노후되는 속도 배율입니다. 0이면 비활성화됩니다.", ja: "拠点外の建築物が自然劣化する速度倍率です。0で無効になります。" },
    { min: 0, max: 10, step: 0.1, precision: 6 },
  ),
  numberSetting(
    "MaxBuildingLimitNum",
    "base",
    0,
    { ko: "플레이어당 건축물 제한", ja: "プレイヤーごとの建築物上限" },
    { ko: "플레이어당 건축물 수 제한입니다. 0은 제한 없음입니다.", ja: "プレイヤーごとの建築物数上限です。0は無制限です。" },
    { min: 0, step: 1, integer: true },
  ),
  {
    category: "server",
    defaultValue: "Palworld Server",
    description: { ko: "서버 목록에 표시할 이름입니다.", ja: "サーバー一覧に表示する名前です。" },
    key: "ServerName",
    kind: "text",
    label: { ko: "서버 이름", ja: "サーバー名" },
    maxLength: 80,
  },
  {
    category: "server",
    defaultValue: "Palworld Server",
    description: { ko: "서버 목록에 표시할 설명입니다.", ja: "サーバー一覧に表示する説明です。" },
    key: "ServerDescription",
    kind: "text",
    label: { ko: "서버 설명", ja: "サーバー説明" },
    maxLength: 200,
  },
  {
    category: "server",
    defaultValue: "",
    description: { ko: "관리자 권한 획득에 사용하는 비밀번호입니다.", ja: "管理者権限の取得に使用するパスワードです。" },
    key: "AdminPassword",
    kind: "password",
    label: { ko: "관리자 비밀번호", ja: "管理者パスワード" },
    maxLength: 128,
  },
  {
    category: "server",
    defaultValue: "",
    description: { ko: "플레이어가 서버 접속 시 입력할 비밀번호입니다.", ja: "プレイヤーがサーバー接続時に入力するパスワードです。" },
    key: "ServerPassword",
    kind: "password",
    label: { ko: "서버 접속 비밀번호", ja: "サーバー接続パスワード" },
    maxLength: 128,
  },
  numberSetting(
    "ServerPlayerMaxNum",
    "server",
    32,
    { ko: "최대 동시 접속 인원", ja: "最大同時接続人数" },
    { ko: "서버에 동시에 접속할 수 있는 최대 플레이어 수입니다.", ja: "サーバーに同時接続できる最大プレイヤー数です。" },
    { min: 1, step: 1, integer: true },
  ),
  {
    category: "server",
    defaultValue: "(Steam,Xbox,PS5,Mac)",
    description: { ko: "서버 접속을 허용할 플랫폼 목록입니다.", ja: "サーバー接続を許可するプラットフォーム一覧です。" },
    key: "CrossplayPlatforms",
    kind: "select",
    label: { ko: "크로스플레이 플랫폼", ja: "クロスプレイプラットフォーム" },
    options: [
      { value: "(Steam,Xbox,PS5,Mac)", label: { ko: "전체 플랫폼", ja: "全プラットフォーム" } },
      { value: "(Steam)", label: { ko: "Steam만", ja: "Steamのみ" } },
      { value: "(Xbox)", label: { ko: "Xbox만", ja: "Xboxのみ" } },
      { value: "(PS5)", label: { ko: "PS5만", ja: "PS5のみ" } },
      { value: "(Mac)", label: { ko: "Mac만", ja: "Macのみ" } },
    ],
  },
  booleanSetting(
    "bAllowClientMod",
    "server",
    true,
    { ko: "클라이언트 모드 허용", ja: "クライアントMOD許可" },
    { ko: "모드를 활성화한 클라이언트의 접속을 허용합니다.", ja: "MODを有効にしたクライアントの接続を許可します。" },
  ),
  booleanSetting(
    "bIsShowJoinLeftMessage",
    "server",
    true,
    { ko: "접속·퇴장 메시지", ja: "参加・退出メッセージ" },
    { ko: "플레이어 접속과 퇴장 메시지를 게임 안에 표시합니다.", ja: "プレイヤーの参加・退出メッセージをゲーム内に表示します。" },
  ),
  booleanSetting(
    "bIsUseBackupSaveData",
    "server",
    true,
    { ko: "자동 백업 세이브", ja: "自動バックアップセーブ" },
    { ko: "월드 세이브 데이터의 자동 백업을 사용합니다. 디스크 사용량이 늘 수 있습니다.", ja: "ワールドセーブデータの自動バックアップを有効にします。ディスク使用量が増える場合があります。" },
  ),
  numberSetting(
    "PublicPort",
    "system",
    8211,
    { ko: "외부 공개 포트", ja: "外部公開ポート" },
    { ko: "커뮤니티 서버 목록에 공개할 포트입니다. 실제 수신 포트는 실행 인수와 방화벽도 확인해야 합니다.", ja: "コミュニティサーバー一覧に公開するポートです。実際の待受ポートは起動引数とファイアウォールも確認してください。" },
    { min: 1, max: 65535, step: 1, integer: true },
  ),
  {
    category: "system",
    defaultValue: "",
    description: { ko: "커뮤니티 서버에 명시할 공인 IP입니다. 자동 감지를 사용하려면 비워 둡니다.", ja: "コミュニティサーバーに明示するグローバルIPです。自動検出を使う場合は空欄にします。" },
    key: "PublicIP",
    kind: "text",
    label: { ko: "공개 IP", ja: "公開IP" },
    maxLength: 45,
    valueFormat: "ip",
  },
  booleanSetting(
    "RESTAPIEnabled",
    "system",
    false,
    { ko: "REST API", ja: "REST API" },
    { ko: "Palworld REST API를 활성화합니다. 인터넷에 직접 공개하지 마세요.", ja: "Palworld REST APIを有効にします。インターネットへ直接公開しないでください。" },
  ),
  numberSetting(
    "RESTAPIPort",
    "system",
    8212,
    { ko: "REST API 포트", ja: "REST APIポート" },
    { ko: "REST API가 수신할 TCP 포트입니다.", ja: "REST APIが待ち受けるTCPポートです。" },
    { min: 1, max: 65535, step: 1, integer: true },
  ),
  booleanSetting(
    "RCONEnabled",
    "system",
    false,
    { ko: "RCON", ja: "RCON" },
    { ko: "RCON 원격 관리 기능을 활성화합니다. 외부 공개는 권장하지 않습니다.", ja: "RCONリモート管理を有効にします。外部公開は推奨しません。" },
  ),
  numberSetting(
    "RCONPort",
    "system",
    25575,
    { ko: "RCON 포트", ja: "RCONポート" },
    { ko: "RCON이 수신할 TCP 포트입니다.", ja: "RCONが待ち受けるTCPポートです。" },
    { min: 1, max: 65535, step: 1, integer: true },
  ),
  {
    category: "system",
    defaultValue: "Text",
    description: { ko: "서버 로그 저장 형식입니다.", ja: "サーバーログの保存形式です。" },
    key: "LogFormatType",
    kind: "select",
    label: { ko: "로그 형식", ja: "ログ形式" },
    options: [
      { value: "Text", label: { ko: "텍스트", ja: "テキスト" } },
      { value: "Json", label: { ko: "JSON", ja: "JSON" } },
    ],
  },
  numberSetting(
    "ChatPostLimitPerMinute",
    "system",
    30,
    { ko: "분당 채팅 제한", ja: "1分あたりのチャット上限" },
    { ko: "플레이어 한 명이 1분 동안 보낼 수 있는 채팅 수입니다.", ja: "プレイヤー1人が1分間に送信できるチャット数です。" },
    { min: 0, step: 1, integer: true },
  ),
  numberSetting(
    "ServerReplicatePawnCullDistance",
    "system",
    15000,
    { ko: "플레이어·팰 동기화 거리", ja: "プレイヤー・パル同期距離" },
    { ko: "서버가 플레이어와 팰을 동기화하는 거리입니다. 단위는 cm입니다.", ja: "サーバーがプレイヤーとパルを同期する距離です。単位はcmです。" },
    { min: 5000, max: 15000, step: 100, precision: 6 },
  ),
] as const;

const definitionsByKey = new Map(palworldSettingDefinitions.map((definition) => [
  definition.key,
  definition,
]));

export function createDefaultPalworldSettingValues(): PalworldSettingValues {
  return Object.fromEntries(
    palworldSettingDefinitions.map((definition) => [definition.key, definition.defaultValue]),
  );
}

export function changedPalworldSettingKeys(values: PalworldSettingValues): string[] {
  return palworldSettingDefinitions
    .filter((definition) => values[definition.key] !== definition.defaultValue)
    .map((definition) => definition.key);
}

export function validatePalworldSetting(
  definition: PalworldSettingDefinition,
  value: string,
): PalworldSettingValidationCode | undefined {
  if (definition.kind === "number") {
    if (value.trim() === "" || !Number.isFinite(Number(value))) return "invalid_number";
    const numberValue = Number(value);
    if (definition.integer && !Number.isInteger(numberValue)) return "integer_required";
    if (definition.min !== undefined && numberValue < definition.min) return "min_exceeded";
    if (definition.max !== undefined && numberValue > definition.max) return "max_exceeded";
    return undefined;
  }

  if (definition.kind === "boolean" || definition.kind === "select") {
    if (!definition.options?.some((option) => option.value === value)) return "unsupported_value";
    return undefined;
  }

  if (/[\u0000-\u001f\u007f]/u.test(value)) return "control_character";
  if (definition.maxLength !== undefined && [...value].length > definition.maxLength) return "too_long";
  if (definition.valueFormat === "ip" && value !== "" && !/^[0-9a-f:.]+$/iu.test(value)) {
    return "invalid_format";
  }
  return undefined;
}

export function validatePalworldSettingValues(
  values: PalworldSettingValues,
): PalworldSettingValidationError[] {
  return changedPalworldSettingKeys(values).flatMap((key) => {
    const definition = definitionsByKey.get(key);
    if (!definition) return [{ code: "unsupported_value" as const, key }];
    const code = validatePalworldSetting(definition, values[key] ?? "");
    return code ? [{ code, key }] : [];
  });
}

function quoteIniString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function serializedValue(
  definition: PalworldSettingDefinition,
  value: string,
  redactSecrets: boolean,
): string {
  if (definition.kind === "boolean") return value === "true" ? "True" : "False";
  if (definition.kind === "number") {
    const parsed = Number(value);
    if (definition.integer) return String(parsed);
    return definition.precision === undefined ? String(parsed) : parsed.toFixed(definition.precision);
  }
  if (definition.kind === "select") return value;
  if (definition.kind === "password" && redactSecrets && value !== "") return quoteIniString("••••••••");
  return quoteIniString(value);
}

export function generatePalworldSettingsIni(
  values: PalworldSettingValues,
  options: { redactSecrets?: boolean } = {},
): string {
  const errors = validatePalworldSettingValues(values);
  if (errors.length > 0) {
    throw new Error(`palworld_settings_invalid:${errors[0]?.key ?? "unknown"}`);
  }

  const changedKeys = new Set(changedPalworldSettingKeys(values));
  const settings = palworldSettingDefinitions
    .filter((definition) => changedKeys.has(definition.key))
    .map((definition) => (
      `${definition.key}=${serializedValue(
        definition,
        values[definition.key] ?? definition.defaultValue,
        options.redactSecrets === true,
      )}`
    ));

  return [
    "[/Script/Pal.PalGameWorldSettings]",
    `OptionSettings=(${settings.join(",")})`,
    "",
  ].join("\n");
}
