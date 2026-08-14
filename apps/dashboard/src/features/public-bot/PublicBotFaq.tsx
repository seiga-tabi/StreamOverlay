import type { PublicBotSection } from "./PublicBotPage";

type BotFaqLocale = "ko" | "ja";
type FaqPage = Exclude<PublicBotSection, "overview">;

type FaqCopy = {
  title: string;
  note: string;
  faq: ReadonlyArray<{ question: string; answer: string }>;
};

/* 자체 작성 카피 — 이 봇의 실제 동작 기준으로만 답합니다(외부 문서 번안 금지). */
const ko: Record<FaqPage, FaqCopy> = {
  gettingStarted: {
    title: "자주 묻는 질문",
    note: "이 안내는 YORO Bot 의 실제 초대·연결 흐름을 기준으로 작성되었습니다. 봇 업데이트로 절차가 바뀌면 이 페이지도 함께 갱신됩니다.",
    faq: [
      { question: "봇을 초대했는데 명령에 응답하지 않아요.", answer: "채널에서 봇의 메시지 보내기·슬래시 명령 권한이 켜져 있는지 먼저 확인하세요. 권한이 정상인데도 응답이 없다면 Dashboard 의 서버 연결 상태에서 봇이 온라인인지 확인할 수 있습니다." },
      { question: "권한을 최소한으로만 주고 싶어요.", answer: "초대 링크의 기본 권한은 명령 실행과 응답에 필요한 범위로 구성되어 있습니다. 관리자 권한은 요구하지 않으며, 특정 채널에서만 쓰려면 해당 채널 권한만 남기고 나머지를 끄면 됩니다." },
      { question: "여러 서버에 설치할 수 있나요?", answer: "네. 서버마다 설정이 독립적으로 저장되므로, 서버별로 명령 활성화 여부와 표시 언어를 다르게 운영할 수 있습니다." },
    ],
  },
  commands: {
    title: "자주 묻는 질문",
    note: "명령 목록은 봇 릴리스와 함께 갱신됩니다. Dashboard 에서 비활성화한 명령은 이 목록과 서버 도움말 양쪽에서 제외됩니다.",
    faq: [
      { question: "명령이 서버에서 보이지 않아요.", answer: "Dashboard 에서 해당 명령이 비활성화되어 있는지 확인하세요. 활성 상태인데도 보이지 않으면 Discord 클라이언트의 슬래시 명령 캐시 문제일 수 있으니 앱 재시작 후 다시 확인하는 것을 권합니다." },
      { question: "응답 언어를 바꾸려면 어떻게 하나요?", answer: "명령 입력은 항상 영어지만, 응답 문구는 서버의 표시 언어 설정을 따릅니다. Dashboard 의 서버 설정에서 한국어·일본어를 선택할 수 있습니다." },
      { question: "명령을 연속으로 입력하면 제한이 있나요?", answer: "서버 보호를 위해 짧은 시간의 과도한 반복 입력에는 응답이 지연되거나 생략될 수 있습니다. 정상 사용 빈도에서는 제한을 체감하지 않도록 설계되어 있습니다." },
    ],
  },
  gameFiles: {
    title: "자주 묻는 질문",
    note: "설정 항목은 게임 전용 서버가 실제로 읽는 옵션 스키마 기준이며, 임의 항목을 추가하지 않습니다. 게임 패치로 옵션이 바뀌면 함께 갱신됩니다.",
    faq: [
      { question: "설정 파일을 적용했는데 서버에 반영되지 않아요.", answer: "전용 서버는 시작 시점에 설정 파일을 읽습니다. 파일을 교체한 뒤 서버를 재시작했는지, 그리고 서버가 실제로 읽는 경로에 저장했는지 확인하세요." },
      { question: "기존 설정이 덮어써질까 걱정됩니다.", answer: "적용 전 기존 파일을 백업해 두는 것을 권합니다. 생성된 파일은 화면에서 설정한 값만 포함하므로, 직접 수정해 둔 다른 항목이 있다면 병합이 필요합니다." },
      { question: "여기서 받은 값이 게임과 다르게 동작해요.", answer: "일부 옵션은 게임 버전에 따라 동작이 달라질 수 있습니다. 이 페이지는 옵션 값을 파일 형식으로 만들어 줄 뿐, 게임 쪽 동작 자체를 바꾸지는 못합니다." },
    ],
  },
};

const ja: Record<FaqPage, FaqCopy> = {
  gettingStarted: {
    title: "よくある質問",
    note: "この案内は YORO Bot の実際の招待・接続フローを基準に作成しています。手順が変わればこのページも合わせて更新します。",
    faq: [
      { question: "ボットを招待したのにコマンドに応答しません。", answer: "まずチャンネルでボットのメッセージ送信・スラッシュコマンド権限が有効か確認してください。権限が正常でも応答がない場合は、Dashboard のサーバー接続状態でボットがオンラインか確認できます。" },
      { question: "権限を最小限にしたいです。", answer: "招待リンクの既定権限は、コマンドの実行と応答に必要な範囲で構成されています。管理者権限は要求しません。特定チャンネルのみで使う場合は、そのチャンネルの権限だけ残して他を無効にしてください。" },
      { question: "複数のサーバーに導入できますか？", answer: "はい。設定はサーバーごとに独立して保存されるため、コマンドの有効化や表示言語をサーバー別に運用できます。" },
    ],
  },
  commands: {
    title: "よくある質問",
    note: "コマンド一覧はボットのリリースと共に更新されます。Dashboard で無効化したコマンドは、この一覧とサーバー内ヘルプの両方から除外されます。",
    faq: [
      { question: "コマンドがサーバーに表示されません。", answer: "Dashboard で該当コマンドが無効化されていないか確認してください。有効なのに表示されない場合は Discord クライアントのキャッシュの可能性があるため、アプリ再起動後の確認をおすすめします。" },
      { question: "応答言語を変えるには？", answer: "コマンド入力は常に英語ですが、応答文はサーバーの表示言語設定に従います。Dashboard のサーバー設定で韓国語・日本語を選択できます。" },
      { question: "連続入力に制限はありますか？", answer: "サーバー保護のため、短時間の過度な連続入力には応答が遅延・省略されることがあります。通常の使用頻度では制限を感じない設計です。" },
    ],
  },
  gameFiles: {
    title: "よくある質問",
    note: "設定項目はゲーム専用サーバーが実際に読み込むオプションのスキーマ基準で、独自項目は追加しません。パッチでオプションが変われば合わせて更新します。",
    faq: [
      { question: "設定ファイルを適用してもサーバーに反映されません。", answer: "専用サーバーは起動時に設定ファイルを読み込みます。ファイル差し替え後にサーバーを再起動したか、サーバーが実際に読むパスに保存したかを確認してください。" },
      { question: "既存の設定が上書きされないか心配です。", answer: "適用前に既存ファイルのバックアップをおすすめします。生成ファイルには画面で設定した値のみ含まれるため、手動で編集した他の項目がある場合はマージが必要です。" },
      { question: "ここで作った値がゲームと違う動きをします。", answer: "一部のオプションはゲームのバージョンによって挙動が変わることがあります。このページはオプション値をファイル形式にするだけで、ゲーム側の挙動自体は変更できません。" },
    ],
  },
};

const copy = { ko, ja } as const;

export function PublicBotFaq({ locale, page }: { locale: BotFaqLocale; page: FaqPage }) {
  const text = copy[locale][page];
  return (
    <section aria-labelledby={`bot-faq-${page}`} className="public-bot-faq public-bot-page-section">
      <h2 data-ja={copy.ja[page].title} data-ko={copy.ko[page].title} id={`bot-faq-${page}`}>{text.title}</h2>
      {text.faq.map((entry) => (
        <details className="public-bot-faq__item" key={entry.question}>
          <summary>{entry.question}</summary>
          <p>{entry.answer}</p>
        </details>
      ))}
      <p className="public-bot-faq__note" role="note">{text.note}</p>
    </section>
  );
}
