import type { PalworldLocale } from "./palworld-i18n";

/* 공개 정보 페이지의 자체 작성 가이드 카피 — 검색 도구만 있는 화면이 되지 않도록
 * 각 페이지에서만 얻을 수 있는 사용법·데이터 해석·갱신 기준·FAQ 를 담습니다.
 * 게임 위키·공식 설명문을 복사·번안하지 않고 이 서비스의 실제 동작을 설명합니다. */

export type PalworldGuidePage = "pals" | "items" | "technology" | "skills";

type GuideCopy = {
  leadTitle: string;
  lead: string;
  howTitle: string;
  how: readonly string[];
  readTitle: string;
  read: ReadonlyArray<{ term: string; description: string }>;
  dataTitle: string;
  data: string;
  faqTitle: string;
  faq: ReadonlyArray<{ question: string; answer: string }>;
};

const ko: Record<PalworldGuidePage, GuideCopy> = {
  pals: {
    leadTitle: "팰 도감 — 스탯·작업 적성·서식지를 한 곳에서",
    lead: "전체 팰의 전투 스탯, 거점 작업 적성, 드롭 아이템, 서식지 지도를 필터로 좁혀 볼 수 있는 도감입니다. 카드를 열면 상세 화면에서 파트너 스킬과 스폰 위치 지도까지 이어집니다.",
    howTitle: "이 페이지 사용법",
    how: [
      "이름·도감 번호로 검색하거나, 속성·작업 적성 필터를 조합해 목록을 좁힙니다.",
      "카드를 누르면 상세 화면이 열립니다 — 스탯, 파트너 스킬, 드롭, 서식지 지도를 한 번에 확인합니다.",
      "거점 자동화를 계획한다면 작업 적성 필터로 채집·운반·발전 등 필요한 적성만 모아 비교하세요.",
      "교배 조합이 필요하면 교배 계산기로 이동해 부모·결과 팰을 역방향으로도 찾을 수 있습니다.",
    ],
    readTitle: "데이터 읽는 법",
    read: [
      { term: "작업 적성 레벨", description: "숫자가 높을수록 같은 작업을 더 빠르게 처리합니다. 거점에 배치했을 때의 자동화 효율을 좌우하는 핵심 수치입니다." },
      { term: "속성", description: "전투 상성의 기준이자 일부 파트너 스킬의 발동 조건입니다. 복수 속성 팰은 두 속성의 상성을 모두 받습니다." },
      { term: "서식지 지도", description: "게임 데이터의 스폰 영역을 지도에 표시한 것입니다. 시간대·날씨 조건이 있는 스폰은 표시 범위 안에서도 등장하지 않을 수 있습니다." },
      { term: "드롭 아이템", description: "처치·포획 시 획득 가능한 아이템 목록입니다. 확률 수치는 원본 데이터가 제공하는 범위에서만 표시합니다." },
    ],
    dataTitle: "데이터 출처와 갱신 기준",
    data: "게임 클라이언트 데이터를 빌드 시점에 검증 임포트한 카탈로그를 사용합니다. 게임 패치가 나오면 카탈로그를 재생성해 반영하며, 원본 데이터에 없는 값은 임의로 채우지 않고 \"원본 데이터 미제공\"으로 표시합니다.",
    faqTitle: "자주 묻는 질문",
    faq: [
      { question: "교배 조합은 어디서 확인하나요?", answer: "상단 메뉴의 교배 조합 페이지에서 부모 두 마리로 결과를 계산하거나, 원하는 결과 팰에서 거꾸로 부모 조합을 찾을 수 있습니다." },
      { question: "게임에서 본 수치와 다른 값이 있어요.", answer: "패치 직후에는 카탈로그 재생성 전까지 이전 버전 수치가 남을 수 있습니다. 갱신 후에도 다르다면 게임 내 버프·패시브 보정이 적용되지 않은 기본치 기준이기 때문일 수 있습니다." },
      { question: "필터를 초기화하려면 어떻게 하나요?", answer: "적용된 필터 칩의 지우기 버튼을 누르거나 필터 패널에서 전체 해제를 사용하면 됩니다. 필터 상태는 URL 에 저장되어 공유할 수 있습니다." },
    ],
  },
  items: {
    leadTitle: "아이템 도감 — 장비 스탯과 제작 재료의 연결",
    lead: "무기·방어구·소재·소모품의 스탯, 제작 재료, 입수 경로를 정리한 도감입니다. 상세 화면에서 제작 재료를 따라가면 필요한 소재의 입수처까지 이어집니다.",
    howTitle: "이 페이지 사용법",
    how: [
      "분류 필터로 장비·소재·소모품을 나누거나 이름으로 검색합니다.",
      "카드를 열면 스탯과 제작 재료가 표시됩니다 — 재료 아이템을 눌러 연쇄적으로 입수 경로를 추적하세요.",
      "장비를 비교할 때는 같은 분류 안에서 공격력·방어력과 내구도를 함께 보는 것이 정확합니다.",
    ],
    readTitle: "데이터 읽는 법",
    read: [
      { term: "희귀도", description: "카드 테두리 색으로 표시합니다. 희귀도가 높을수록 같은 계열에서 스탯 상한이 높지만, 제작 재료 부담도 함께 커집니다." },
      { term: "공격력·방어력", description: "장비 자체의 기본치입니다. 게임 내 최종 수치는 캐릭터 스탯·패시브 보정이 더해진 값이라 더 높게 표시될 수 있습니다." },
      { term: "제작 재료", description: "해당 아이템 1개 제작 기준 수량입니다. 제작대 종류와 해금 기술은 기술 해금 페이지에서 확인할 수 있습니다." },
    ],
    dataTitle: "데이터 출처와 갱신 기준",
    data: "게임 클라이언트 데이터를 빌드 시점에 검증 임포트한 카탈로그를 사용합니다. 패치 반영 주기는 팰 도감과 동일하며, 시세·거래가처럼 원본에 없는 정보는 만들지 않습니다.",
    faqTitle: "자주 묻는 질문",
    faq: [
      { question: "이 장비를 만들려면 어떤 기술이 필요한가요?", answer: "상세 화면의 제작 정보에서 요구 기술을 확인하고, 기술 해금 페이지에서 해당 레벨의 기술 포인트 비용을 볼 수 있습니다." },
      { question: "아이템 판매 가격이나 시세도 제공하나요?", answer: "원본 데이터가 제공하는 상점 가격만 표시합니다. 유저 간 거래 시세는 수집하지 않으며 임의 추정치도 싣지 않습니다." },
      { question: "찾는 아이템이 목록에 없어요.", answer: "이벤트·미출시 데이터는 카탈로그 검증 단계에서 제외될 수 있습니다. 패치 후 새 아이템은 카탈로그 재생성 시점에 추가됩니다." },
    ],
  },
  technology: {
    leadTitle: "기술 해금 — 레벨별 해금 순서 계획",
    lead: "레벨마다 해금할 수 있는 기술과 필요한 기술 포인트를 정리했습니다. 일반 기술과 고대 기술을 구분해, 어느 레벨에서 무엇을 먼저 열지 계획할 때 쓰는 페이지입니다.",
    howTitle: "이 페이지 사용법",
    how: [
      "레벨 타임라인을 따라 내려가며 각 구간에서 열리는 기술을 확인합니다.",
      "이름 검색으로 특정 제작대·장비가 몇 레벨 기술인지 바로 찾을 수 있습니다.",
      "기술 카드에서 해금되는 아이템을 누르면 아이템 상세의 제작 재료로 이어집니다.",
    ],
    readTitle: "데이터 읽는 법",
    read: [
      { term: "기술 포인트", description: "레벨 업 시 지급되는 일반 포인트입니다. 대부분의 제작·건축 기술이 여기에 속합니다." },
      { term: "고대 기술 포인트", description: "보스 토벌 등 특정 콘텐츠에서만 얻는 별도 포인트입니다. 고대 기술 카드는 배지로 구분됩니다." },
      { term: "해금 조건", description: "선행 기술 없이 캐릭터 레벨과 포인트만 충족하면 열 수 있습니다. 순서는 자유지만 포인트 총량이 한정되어 우선순위 계획이 중요합니다." },
    ],
    dataTitle: "데이터 출처와 갱신 기준",
    data: "게임 클라이언트 데이터를 빌드 시점에 검증 임포트한 카탈로그를 사용합니다. 패치로 기술 트리가 바뀌면 카탈로그 재생성 시 반영됩니다.",
    faqTitle: "자주 묻는 질문",
    faq: [
      { question: "기술 포인트가 부족하면 어떻게 하나요?", answer: "레벨 업 외에도 게임 내 특정 수집 요소로 추가 포인트를 얻을 수 있습니다. 이 페이지에서는 각 기술의 비용을 미리 합산해 우선순위를 정하는 것을 권합니다." },
      { question: "고대 기술은 어떻게 구분하나요?", answer: "카드의 고대 기술 배지로 구분합니다. 필요한 포인트 종류가 다르므로 일반 기술과 비용을 섞어 계산하지 않도록 주의하세요." },
    ],
  },
  skills: {
    leadTitle: "스킬 사전 — 위력·속성·쿨타임 비교",
    lead: "팰이 사용하는 액티브 스킬과 패시브 스킬을 위력·속성·쿨타임 기준으로 비교하는 사전입니다. 도감 상세와 연결되어 어떤 팰이 해당 스킬을 배우는지 함께 볼 수 있습니다.",
    howTitle: "이 페이지 사용법",
    how: [
      "액티브·패시브 탭을 전환하고 속성 필터로 원하는 계열만 모아 봅니다.",
      "위력과 쿨타임을 함께 비교하세요 — 위력이 높아도 쿨타임이 길면 실전 DPS 는 낮을 수 있습니다.",
      "패시브는 등급 표기를 기준으로 긍정·부정 효과를 구분해 교배 목표를 세울 때 활용합니다.",
    ],
    readTitle: "데이터 읽는 법",
    read: [
      { term: "위력", description: "스킬의 기본 위력입니다. 실제 피해는 팰의 공격 스탯, 속성 상성, 패시브 보정이 곱해진 값입니다." },
      { term: "쿨타임", description: "재사용 대기 시간(초)입니다. 전투 중 스킬 3개 슬롯의 순환을 계획할 때 위력만큼 중요한 수치입니다." },
      { term: "패시브 등급", description: "긍정 효과는 상향 화살표, 부정 효과는 하향 화살표 계열로 표시합니다. 교배로 원하는 패시브를 물려줄 때 목표 설정 기준이 됩니다." },
    ],
    dataTitle: "데이터 출처와 갱신 기준",
    data: "게임 클라이언트 데이터를 빌드 시점에 검증 임포트한 카탈로그를 사용합니다. 스킬 밸런스 패치는 카탈로그 재생성 시 반영되며, 원본에 없는 계수는 추정하지 않습니다.",
    faqTitle: "자주 묻는 질문",
    faq: [
      { question: "이 스킬을 배우는 팰은 어떻게 찾나요?", answer: "스킬 상세에서 습득 팰 목록을 제공하는 범위에서 표시하며, 팰 도감 상세의 스킬 목록에서도 역방향으로 확인할 수 있습니다." },
      { question: "패시브는 어떻게 얻나요?", answer: "포획 개체가 무작위로 지니거나 교배로 부모의 패시브가 일정 확률로 유전됩니다. 원하는 패시브 조합은 교배 계산기와 함께 계획하세요." },
    ],
  },
};

const ja: Record<PalworldGuidePage, GuideCopy> = {
  pals: {
    leadTitle: "パルズ図鑑 — ステータス・作業適性・生息地をひとつに",
    lead: "全パルの戦闘ステータス、拠点作業適性、ドロップ、生息地マップをフィルターで絞り込める図鑑です。カードを開くと詳細画面でパートナースキルとスポーン位置マップまで確認できます。",
    howTitle: "このページの使い方",
    how: [
      "名前・図鑑番号で検索するか、属性・作業適性フィルターを組み合わせて一覧を絞り込みます。",
      "カードを押すと詳細画面が開きます — ステータス、パートナースキル、ドロップ、生息地マップを一度に確認できます。",
      "拠点の自動化を計画するなら、作業適性フィルターで採集・運搬・発電など必要な適性だけを集めて比較しましょう。",
      "配合を調べたいときは配合計算機へ — 親からも、目的の子からも逆引きできます。",
    ],
    readTitle: "データの読み方",
    read: [
      { term: "作業適性レベル", description: "数字が高いほど同じ作業を速く処理します。拠点配置時の自動化効率を左右する中心的な数値です。" },
      { term: "属性", description: "戦闘相性の基準で、一部パートナースキルの発動条件でもあります。複数属性のパルは両方の相性を受けます。" },
      { term: "生息地マップ", description: "ゲームデータのスポーン領域を地図に表示したものです。時間帯・天候条件のあるスポーンは範囲内でも出現しない場合があります。" },
      { term: "ドロップ", description: "討伐・捕獲時に入手できるアイテムの一覧です。確率は元データが提供する範囲でのみ表示します。" },
    ],
    dataTitle: "データの出典と更新基準",
    data: "ゲームクライアントのデータをビルド時に検証インポートしたカタログを使用しています。パッチが出るとカタログを再生成して反映し、元データにない値は補完せず「元データ未提供」と表示します。",
    faqTitle: "よくある質問",
    faq: [
      { question: "配合の組み合わせはどこで確認できますか？", answer: "上部メニューの配合計算機で、親2体から結果を計算するか、目的のパルから親の組み合わせを逆引きできます。" },
      { question: "ゲーム内の数値と違う値があります。", answer: "パッチ直後はカタログ再生成まで旧バージョンの数値が残ることがあります。更新後も異なる場合は、バフ・パッシブ補正前の基本値基準であるためです。" },
      { question: "フィルターをリセットするには？", answer: "適用中のフィルターチップの解除ボタン、またはフィルターパネルの全解除を使ってください。フィルター状態は URL に保存され共有できます。" },
    ],
  },
  items: {
    leadTitle: "アイテム図鑑 — 装備ステータスと素材のつながり",
    lead: "武器・防具・素材・消耗品のステータス、クラフト素材、入手経路を整理した図鑑です。詳細画面で素材をたどれば、必要な材料の入手先まで連鎖して確認できます。",
    howTitle: "このページの使い方",
    how: [
      "分類フィルターで装備・素材・消耗品を分けるか、名前で検索します。",
      "カードを開くとステータスとクラフト素材が表示されます — 素材アイテムを押して入手経路を連鎖的にたどれます。",
      "装備を比較するときは、同じ分類の中で攻撃力・防御力と耐久値を合わせて見るのが正確です。",
    ],
    readTitle: "データの読み方",
    read: [
      { term: "レアリティ", description: "カード枠の色で表示します。高いほど同系統でステータス上限が高い一方、素材の負担も大きくなります。" },
      { term: "攻撃力・防御力", description: "装備自体の基本値です。ゲーム内の最終値はキャラクターステータスやパッシブ補正が加わるため高く表示されることがあります。" },
      { term: "クラフト素材", description: "アイテム1個あたりの必要数です。作業台の種類と解放テクノロジーはテクノロジーページで確認できます。" },
    ],
    dataTitle: "データの出典と更新基準",
    data: "ゲームクライアントのデータをビルド時に検証インポートしたカタログを使用しています。更新周期はパルズ図鑑と同じで、相場・取引価格のような元データにない情報は作りません。",
    faqTitle: "よくある質問",
    faq: [
      { question: "この装備にはどのテクノロジーが必要ですか？", answer: "詳細画面のクラフト情報で必要テクノロジーを確認し、テクノロジーページで該当レベルのポイント消費を確認できます。" },
      { question: "販売価格や相場も提供していますか？", answer: "元データが提供するショップ価格のみ表示します。ユーザー間の相場は収集せず、推定値も掲載しません。" },
      { question: "探しているアイテムが一覧にありません。", answer: "イベント・未実装データはカタログ検証で除外されることがあります。パッチ後の新アイテムはカタログ再生成時に追加されます。" },
    ],
  },
  technology: {
    leadTitle: "テクノロジー — レベル別の解放順を計画",
    lead: "レベルごとに解放できるテクノロジーと必要ポイントを整理しました。通常と古代を区別して、どのレベルで何を先に開けるか計画するためのページです。",
    howTitle: "このページの使い方",
    how: [
      "レベルのタイムラインに沿って、各区間で解放されるテクノロジーを確認します。",
      "名前検索で、特定の作業台・装備が何レベルのテクノロジーかすぐに調べられます。",
      "テクノロジーカードから解放アイテムを押すと、アイテム詳細のクラフト素材につながります。",
    ],
    readTitle: "データの読み方",
    read: [
      { term: "テクノロジーポイント", description: "レベルアップで支給される通常ポイントです。ほとんどのクラフト・建築テクノロジーがここに属します。" },
      { term: "古代テクノロジーポイント", description: "ボス討伐など特定コンテンツでのみ得られる別枠のポイントです。古代のカードはバッジで区別されます。" },
      { term: "解放条件", description: "前提テクノロジーはなく、レベルとポイントを満たせば解放できます。順序は自由ですが、ポイント総量が限られるため優先順位が重要です。" },
    ],
    dataTitle: "データの出典と更新基準",
    data: "ゲームクライアントのデータをビルド時に検証インポートしたカタログを使用しています。パッチでツリーが変わればカタログ再生成時に反映されます。",
    faqTitle: "よくある質問",
    faq: [
      { question: "ポイントが足りないときは？", answer: "レベルアップ以外にも、ゲーム内の特定の収集要素で追加ポイントを得られます。このページで各テクノロジーの消費を合算し、優先順位を決めるのがおすすめです。" },
      { question: "古代テクノロジーはどう見分けますか？", answer: "カードの古代バッジで区別します。必要なポイントの種類が異なるため、通常テクノロジーと混ぜて計算しないよう注意してください。" },
    ],
  },
  skills: {
    leadTitle: "スキル辞典 — 威力・属性・クールタイムの比較",
    lead: "パルのアクティブスキルとパッシブスキルを、威力・属性・クールタイム基準で比較する辞典です。図鑑詳細とつながり、どのパルが覚えるかも合わせて確認できます。",
    howTitle: "このページの使い方",
    how: [
      "アクティブ・パッシブを切り替え、属性フィルターで欲しい系統だけを集めます。",
      "威力とクールタイムをセットで比較しましょう — 威力が高くてもクールタイムが長いと実戦 DPS は低いことがあります。",
      "パッシブは等級表示を基準に正負を区別し、配合の目標設定に活用してください。",
    ],
    readTitle: "データの読み方",
    read: [
      { term: "威力", description: "スキルの基本威力です。実ダメージはパルの攻撃ステータス、属性相性、パッシブ補正を掛けた値になります。" },
      { term: "クールタイム", description: "再使用までの秒数です。戦闘中の3枠ローテーションを組む際、威力と同じくらい重要です。" },
      { term: "パッシブ等級", description: "正の効果は上向き、負の効果は下向きの矢印系で表示します。配合で狙うパッシブの目標基準になります。" },
    ],
    dataTitle: "データの出典と更新基準",
    data: "ゲームクライアントのデータをビルド時に検証インポートしたカタログを使用しています。バランス調整はカタログ再生成時に反映し、元データにない係数は推定しません。",
    faqTitle: "よくある質問",
    faq: [
      { question: "このスキルを覚えるパルはどう探しますか？", answer: "スキル詳細で提供範囲の習得パル一覧を表示し、パルズ図鑑詳細のスキル一覧からも逆引きできます。" },
      { question: "パッシブはどうやって入手しますか？", answer: "捕獲個体がランダムに持つか、配合で親のパッシブが一定確率で遺伝します。狙いの組み合わせは配合計算機と合わせて計画してください。" },
    ],
  },
};

/* 영어 가이드(2026-08-18) — ko 판을 번안한 자체 카피. 게임 위키 복제가 아니라
 * 이 서비스의 실제 동작 설명이라는 원칙은 동일합니다. */
const en: Record<PalworldGuidePage, GuideCopy> = {
  pals: {
    leadTitle: "Paldeck — stats, work suitability and habitats in one place",
    lead: "A catalog of every Pal's combat stats, base work suitability, drops and habitat maps, narrowed with filters. Open a card to continue to partner skills and spawn maps in the detail view.",
    howTitle: "How to use this page",
    how: [
      "Search by name or Paldeck number, or combine element and work suitability filters to narrow the list.",
      "Tap a card to open the detail view — stats, partner skill, drops and habitat map in one place.",
      "Planning base automation? Use work suitability filters to gather only the aptitudes you need — gathering, transporting, generating power and more.",
      "Need breeding pairs? Move to the breeding calculator to search results from parents, or parents from a target Pal.",
    ],
    readTitle: "How to read the data",
    read: [
      { term: "Work suitability level", description: "Higher numbers finish the same work faster. This is the key number for automation efficiency when assigned to your base." },
      { term: "Element", description: "The basis of combat matchups and the trigger of some partner skills. Dual-element Pals take both elements' matchups." },
      { term: "Habitat map", description: "Spawn areas from game data drawn on the map. Spawns with time or weather conditions may not appear even inside the shown area." },
      { term: "Drops", description: "Items obtainable on defeat or capture. Probability figures are shown only where the source data provides them." },
    ],
    dataTitle: "Data source and update policy",
    data: "We use a catalog imported and verified from game client data at build time. When the game is patched we regenerate the catalog; values absent from the source are never invented and are marked \"not provided by source data\".",
    faqTitle: "FAQ",
    faq: [
      { question: "Where do I check breeding pairs?", answer: "On the breeding page in the top menu you can compute the result from two parents, or reverse-search parent pairs from a target Pal." },
      { question: "Some values differ from what I see in game.", answer: "Right after a patch, old values may remain until the catalog is regenerated. If they still differ, the figures here are base values without in-game buff or passive modifiers." },
      { question: "How do I reset filters?", answer: "Press the clear button on an applied filter chip, or use clear-all in the filter panel. Filter state is stored in the URL so it can be shared." },
    ],
  },
  items: {
    leadTitle: "Item catalog — gear stats linked to crafting materials",
    lead: "A catalog of weapons, armor, materials and consumables with their stats, crafting materials and sources. Follow crafting materials in the detail view to trace where each ingredient comes from.",
    howTitle: "How to use this page",
    how: [
      "Split gear, materials and consumables with the category filter, or search by name.",
      "Open a card to see stats and crafting materials — tap an ingredient to keep tracing its sources.",
      "When comparing gear, compare attack, defense and durability within the same category for accuracy.",
    ],
    readTitle: "How to read the data",
    read: [
      { term: "Rarity", description: "Shown as the card border color. Higher rarity raises the stat ceiling within a line, at the cost of heavier crafting materials." },
      { term: "Attack / Defense", description: "The gear's own base values. Final in-game numbers include character stats and passive modifiers, so they can read higher." },
      { term: "Crafting materials", description: "Quantities per single craft. Crafting stations and required technology are on the Technology page." },
    ],
    dataTitle: "Data source and update policy",
    data: "We use a catalog imported and verified from game client data at build time. The patch cadence matches the Paldeck, and information absent from the source — like market prices — is never fabricated.",
    faqTitle: "FAQ",
    faq: [
      { question: "Which technology unlocks this gear?", answer: "Check the required technology in the crafting section of the detail view, then see its point cost per level on the Technology page." },
      { question: "Do you provide sell prices or market rates?", answer: "Only shop prices provided by the source data are shown. We do not collect player trading rates or publish estimates." },
      { question: "An item I am looking for is missing.", answer: "Event or unreleased data can be excluded during catalog verification. New items from a patch are added when the catalog is regenerated." },
    ],
  },
  technology: {
    leadTitle: "Technology — plan your unlock order by level",
    lead: "Technologies unlockable at each level with their point costs, separating regular and Ancient technology. Use this page to plan what to open first at each level.",
    howTitle: "How to use this page",
    how: [
      "Follow the level timeline downward to see what unlocks in each range.",
      "Search by name to find which level a crafting station or gear belongs to.",
      "Tap an unlocked item on a technology card to continue to its crafting materials.",
    ],
    readTitle: "How to read the data",
    read: [
      { term: "Technology points", description: "Regular points granted on level-up. Most crafting and building technologies belong here." },
      { term: "Ancient technology points", description: "A separate currency earned only from specific content such as boss fights. Ancient technology cards carry a badge." },
      { term: "Unlock conditions", description: "No prerequisite tech — only character level and points. Order is free, but total points are limited, so priorities matter." },
    ],
    dataTitle: "Data source and update policy",
    data: "We use a catalog imported and verified from game client data at build time. Technology tree changes from patches are reflected when the catalog is regenerated.",
    faqTitle: "FAQ",
    faq: [
      { question: "What if I run out of technology points?", answer: "Besides leveling, certain in-game collectibles grant extra points. We recommend summing costs on this page to set priorities in advance." },
      { question: "How do I tell Ancient technology apart?", answer: "By the Ancient badge on the card. The point currency differs, so avoid mixing its costs with regular technology." },
    ],
  },
  skills: {
    leadTitle: "Skill dictionary — compare power, element and cooldown",
    lead: "A dictionary of active and passive skills compared by power, element and cooldown, linked with the Paldeck so you can see which Pals learn each skill.",
    howTitle: "How to use this page",
    how: [
      "Switch between active and passive tabs, and use element filters to gather one lineage.",
      "Compare power together with cooldown — high power with a long cooldown can mean lower real DPS.",
      "Use passive tiers to separate positive and negative effects when setting breeding goals.",
    ],
    readTitle: "How to read the data",
    read: [
      { term: "Power", description: "The skill's base power. Actual damage multiplies the Pal's attack stat, element matchup and passive modifiers." },
      { term: "Cooldown", description: "Reuse wait time in seconds. As important as power when planning the rotation of three skill slots in combat." },
      { term: "Passive tier", description: "Positive effects use upward-arrow marks, negative ones downward. The reference for setting targets when passing passives through breeding." },
    ],
    dataTitle: "Data source and update policy",
    data: "We use a catalog imported and verified from game client data at build time. Skill balance patches are reflected on catalog regeneration, and coefficients absent from the source are never estimated.",
    faqTitle: "FAQ",
    faq: [
      { question: "How do I find Pals that learn this skill?", answer: "Skill details list learners where the data provides them, and each Pal's detail view lists its skills for the reverse direction." },
      { question: "How do I get passives?", answer: "Captured Pals carry them at random, or parents pass them down with some probability through breeding. Plan target combinations together with the breeding calculator." },
    ],
  },
};

export const palworldGuideI18n: Record<PalworldLocale, Record<PalworldGuidePage, GuideCopy>> = { ko, ja, en };
