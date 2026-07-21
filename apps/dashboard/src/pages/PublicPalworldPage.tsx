import { useCallback, useEffect, useState } from "react";
import { AppShell, AppShellFooter, AppShellHeader, AppShellMain } from "../shared/ui/AppShell";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../shared/ui/Toast";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import { setActivePublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { PalworldBreedingPage } from "../features/public-palworld/components/PalworldBreedingPage";
import { ItemDetailModal, PalDetailModal } from "../features/public-palworld/components/PalworldDetailModals";
import { PalworldHeader } from "../features/public-palworld/components/PalworldHeader";
import { PalworldHome } from "../features/public-palworld/components/PalworldHome";
import { PalworldItemsPage } from "../features/public-palworld/components/PalworldItemsPage";
import { PalworldPalsPage } from "../features/public-palworld/components/PalworldPalsPage";
import { PalworldSearchForm } from "../features/public-palworld/components/PalworldSearchForm";
import { PalworldSearchResults } from "../features/public-palworld/components/PalworldSearchResults";
import { palworldI18n, type PalworldLocale } from "../features/public-palworld/i18n/palworld-i18n";
import { PALWORLD_VERSION_MISMATCH_EVENT } from "../features/public-palworld/api/palworld";
import { usePalworldRoute } from "../features/public-palworld/hooks/usePalworldRoute";
import { palworldUrl, setPalworldUrl, withQueryParam } from "../features/public-palworld/utils/routes";

const noServerLocalePreference = async (): Promise<PalworldLocale | undefined> => undefined;

export function PublicPalworldPage() {
  const { locale, changeLocale } = usePublicLocale(noServerLocalePreference);
  const { theme } = usePublicTheme();
  const { page, params } = usePalworldRoute();
  const text = palworldI18n[locale];
  const [versionMismatch, setVersionMismatch] = useState(false);
  const selectedPalId = params.get("pal")?.trim() || undefined;
  // 조작된 URL에 두 상세 ID가 함께 있어도 Modal은 하나만 표시합니다.
  const selectedItemId = selectedPalId ? undefined : params.get("item")?.trim() || undefined;

  setActivePublicLocale(locale);

  useEffect(() => {
    const handleMismatch = () => setVersionMismatch(true);
    window.addEventListener(PALWORLD_VERSION_MISMATCH_EVENT, handleMismatch);
    return () => window.removeEventListener(PALWORLD_VERSION_MISMATCH_EVENT, handleMismatch);
  }, []);

  const handleLocale = useCallback((nextLocale: PalworldLocale) => {
    setActivePublicLocale(nextLocale);
    changeLocale(nextLocale);
  }, [changeLocale]);

  const navigateSearch = useCallback((query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    setPalworldUrl(palworldUrl("search", new URLSearchParams({ q: normalized })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openPalPage = useCallback((id: string) => {
    setPalworldUrl(palworldUrl("pals", new URLSearchParams({ pal: id })));
  }, []);

  const openItemPage = useCallback((id: string) => {
    setPalworldUrl(palworldUrl("items", new URLSearchParams({ item: id })));
  }, []);

  const openPalHere = useCallback((id: string) => {
    const current = `${window.location.pathname}${window.location.search}`;
    setPalworldUrl(withQueryParam(withQueryParam(current, "item"), "pal", id));
  }, []);

  const openItemHere = useCallback((id: string) => {
    const current = `${window.location.pathname}${window.location.search}`;
    setPalworldUrl(withQueryParam(withQueryParam(current, "pal"), "item", id));
  }, []);

  const closeDetail = useCallback(() => {
    const current = `${window.location.pathname}${window.location.search}`;
    setPalworldUrl(withQueryParam(withQueryParam(current, "pal"), "item"), true);
  }, []);

  const headerSearch = page === "home" ? undefined : (
    <PalworldSearchForm
      initialQuery={page === "search" ? params.get("q") ?? "" : ""}
      locale={locale}
      onSearch={navigateSearch}
      onPal={(pal) => openPalPage(pal.id)}
      onItem={(item) => openItemPage(item.id)}
    />
  );

  return (
    <AppShell
      className={`public-lol-shell public-dashboard-shell palworld-shell theme-${theme}`}
      mainId="palworld-main"
      renderRoot={({ children, ...rootProps }) => <main {...rootProps}>{children}</main>}
      showSkipLink={false}
      sidebarMode="drawer"
      variant="public"
    >
      <AppShellHeader as="div" className="palworld-shell-header">
        <PalworldHeader locale={locale} onLocale={handleLocale} page={page} searchContent={headerSearch} />
      </AppShellHeader>
      <AppShellMain className="palworld-main" id="palworld-main">
        {page === "home" ? <PalworldHome locale={locale} onSearch={navigateSearch} onOpenPal={openPalPage} onOpenItem={openItemPage} /> : null}
        {page === "search" ? <PalworldSearchResults locale={locale} query={params.get("q") ?? ""} onOpenPal={openPalHere} onOpenItem={openItemHere} /> : null}
        {page === "pals" ? <PalworldPalsPage locale={locale} params={params} onOpenPal={openPalHere} /> : null}
        {page === "breeding" ? <PalworldBreedingPage locale={locale} onOpenPal={openPalHere} /> : null}
        {page === "items" ? <PalworldItemsPage locale={locale} params={params} onOpenItem={openItemHere} /> : null}
      </AppShellMain>
      <AppShellFooter as="div" className="palworld-footer">
        <strong>YORO.gg</strong>
        <span data-ko="펠월드 데이터는 버전이 고정된 검증 스냅샷을 사용합니다." data-ja="パルワールドデータはバージョン固定の検証済みスナップショットを使用します。">
          {locale === "ja" ? "パルワールドデータはバージョン固定の検証済みスナップショットを使用します。" : "펠월드 데이터는 버전이 고정된 검증 스냅샷을 사용합니다."}
        </span>
      </AppShellFooter>
      <PalDetailModal palId={selectedPalId} locale={locale} onClose={closeDetail} onOpenItem={openItemPage} />
      <ItemDetailModal itemId={selectedItemId} locale={locale} onClose={closeDetail} onOpenPal={openPalPage} onOpenItem={openItemPage} />
      <ToastProvider position="bottom-right">
        <ToastViewport>
          {versionMismatch ? (
            <Toast tone="warning" onDismiss={() => setVersionMismatch(false)}>
              <ToastTitle data-ko={palworldI18n.ko.dataVersion} data-ja={palworldI18n.ja.dataVersion}>{text.dataVersion}</ToastTitle>
              <ToastDescription data-ko={palworldI18n.ko.versionMismatch} data-ja={palworldI18n.ja.versionMismatch}>{text.versionMismatch}</ToastDescription>
              <ToastCloseButton aria-label={text.close}>×</ToastCloseButton>
            </Toast>
          ) : null}
        </ToastViewport>
      </ToastProvider>
      <span className="palworld-sr-version" aria-live="polite">{text.dataVersion}</span>
    </AppShell>
  );
}
