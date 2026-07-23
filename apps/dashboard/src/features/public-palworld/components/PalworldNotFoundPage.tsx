import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle
} from "../../../shared/ui/EmptyState";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import { palworldUrl, setPalworldUrl } from "../utils/routes";

const text = {
  ko: {
    title: "페이지를 찾을 수 없습니다.",
    description: "요청한 Palworld 공개 경로가 존재하지 않습니다.",
    home: "Palworld 홈으로 이동"
  },
  ja: {
    title: "ページが見つかりません。",
    description: "指定された Palworld 公開ページは存在しません。",
    home: "Palworld ホームへ移動"
  }
} as const;

export function PalworldNotFoundPage({ locale }: { locale: PalworldLocale }) {
  const localized = text[locale];
  return (
    <section className="palworld-page-section" aria-labelledby="palworld-not-found-title">
      <EmptyState variant="error">
        <EmptyStateIcon>404</EmptyStateIcon>
        <EmptyStateTitle
          id="palworld-not-found-title"
          data-ko={text.ko.title}
          data-ja={text.ja.title}
        >
          {localized.title}
        </EmptyStateTitle>
        <EmptyStateDescription data-ko={text.ko.description} data-ja={text.ja.description}>
          {localized.description}
        </EmptyStateDescription>
        <EmptyStateActions>
          <Button
            variant="secondary"
            onClick={() => setPalworldUrl(palworldUrl("home"))}
            data-ko={text.ko.home}
            data-ja={text.ja.home}
          >
            {localized.home}
          </Button>
        </EmptyStateActions>
      </EmptyState>
    </section>
  );
}
