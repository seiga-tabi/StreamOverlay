import {
  SlashCommandBuilder
} from "discord.js";

export const yoroCommand = new SlashCommandBuilder()
  .setName("yoro")
  .setDescription("YORO Bot setup and help")
  .setDescriptionLocalizations({
    ko: "YORO Bot 설정과 도움말",
    ja: "YORO Botの設定とヘルプ"
  })
  .setDMPermission(false)
  .addSubcommand((command) =>
    command
      .setName("setup")
      .setDescription("Connect this Discord server to YORO.gg.")
      .setDescriptionLocalizations({
        ko: "Discord 서버와 YORO.gg 연결을 시작합니다.",
        ja: "DiscordサーバーとYORO.ggの連携を開始します。"
      }))
  .addSubcommand((command) =>
    command
      .setName("help")
      .setDescription("Show the commands that are currently available.")
      .setDescriptionLocalizations({
        ko: "현재 사용할 수 있는 명령을 확인합니다.",
        ja: "現在利用できるコマンドを確認します。"
      }))
  .addSubcommand((command) =>
    command
      .setName("dashboard")
      .setDescription("Open YORO Bot management.")
      .setDescriptionLocalizations({
        ko: "YORO Bot 관리 화면을 엽니다.",
        ja: "YORO Bot管理画面を開きます。"
      }))
  .addSubcommand((command) =>
    command
      .setName("participation")
      .setNameLocalizations({
        ko: "참여",
        ja: "参加"
      })
      .setDescription("Open the viewer participation page privately.")
      .setDescriptionLocalizations({
        ko: "현재 모집 중인 시청자 참여 방송을 비공개로 확인합니다.",
        ja: "現在募集中の視聴者参加配信を非公開で確認します。"
      }))
  .addSubcommand((command) =>
    command
      .setName("language")
      .setDescription("Set the language used in YORO Bot messages.")
      .setDescriptionLocalizations({
        ko: "YORO Bot 메시지 언어를 설정합니다.",
        ja: "YORO Botのメッセージ言語を設定します。"
      })
      .addStringOption((option) =>
        option
          .setName("locale")
          .setDescription("Message language")
          .setDescriptionLocalizations({
            ko: "메시지 언어",
            ja: "メッセージ言語"
          })
          .setRequired(true)
          .addChoices(
            { name: "Discord default", value: "auto" },
            { name: "한국어", value: "ko" },
            { name: "日本語", value: "ja" },
            { name: "English", value: "en" }
          )))
  .addSubcommand((command) =>
    command
      .setName("status")
      .setDescription("Check the Palworld server status privately.")
      .setDescriptionLocalizations({
        ko: "Palworld 서버 상태를 비공개로 확인합니다.",
        ja: "Palworldサーバー状態を非公開で確認します。"
      }))
  .addSubcommand((command) =>
    command
      .setName("player")
      .setDescription("Check connected players or a profile privately.")
      .setDescriptionLocalizations({
        ko: "접속 플레이어 또는 프로필을 비공개로 확인합니다.",
        ja: "接続プレイヤーまたはプロフィールを非公開で確認します。"
      })
      .addStringOption((option) =>
        option
          .setName("nickname")
          .setDescription("In-game nickname to search")
          .setDescriptionLocalizations({
            ko: "조회할 게임 내 닉네임",
            ja: "検索するゲーム内ニックネーム"
          })
          .setMinLength(1)
          .setMaxLength(80)
          .setRequired(false)))
  .addSubcommand((command) =>
    command
      .setName("guide")
      .setDescription("Open the Palworld dedicated server guide privately.")
      .setDescriptionLocalizations({
        ko: "Palworld 전용 서버 설정 안내를 비공개로 확인합니다.",
        ja: "Palworld専用サーバー設定ガイドを非公開で確認します。"
      }));

export const yoroCommandJson = Object.freeze(yoroCommand.toJSON());
