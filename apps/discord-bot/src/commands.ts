import {
  SlashCommandBuilder
} from "discord.js";

export const yoroCommand = new SlashCommandBuilder()
  .setName("yoro")
  .setDescription("YORO Bot 설정과 도움말")
  .setDescriptionLocalizations({
    ko: "YORO Bot 설정과 도움말",
    ja: "YORO Botの設定とヘルプ"
  })
  .setDMPermission(false)
  .addSubcommand((command) =>
    command
      .setName("setup")
      .setDescription("Discord 서버와 YORO.gg 연결을 시작합니다.")
      .setDescriptionLocalizations({
        ko: "Discord 서버와 YORO.gg 연결을 시작합니다.",
        ja: "DiscordサーバーとYORO.ggの連携を開始します。"
      }))
  .addSubcommand((command) =>
    command
      .setName("help")
      .setDescription("현재 사용할 수 있는 명령을 확인합니다.")
      .setDescriptionLocalizations({
        ko: "현재 사용할 수 있는 명령을 확인합니다.",
        ja: "現在利用できるコマンドを確認します。"
      }))
  .addSubcommand((command) =>
    command
      .setName("dashboard")
      .setDescription("YORO Bot 관리 화면을 엽니다.")
      .setDescriptionLocalizations({
        ko: "YORO Bot 관리 화면을 엽니다.",
        ja: "YORO Bot管理画面を開きます。"
      }));

export const yoroCommandJson = Object.freeze(yoroCommand.toJSON());
