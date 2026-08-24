import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

const {
  PatchNotesSocialCardRenderer,
  cardDateLabel,
  latestPatchNoteWithVersion,
  patchNotesCardModel,
  wrapSummaryLines,
} = await import("../dist/services/patch-notes-social-card.js");

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function note(overrides = {}) {
  return {
    slug: "league-of-legends-patch-26-16-notes",
    title: "리그 오브 레전드 26.16 패치 노트",
    summary: "챔피언과 체계 업데이트, 클래식에 찾아온 닌자 등 다양한 변경 사항을 확인해 보세요!",
    publishedAt: "2026-08-11T18:00:00.000Z",
    patchVersion: "26.16",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-16-notes",
    imageUrl: "https://cmsassets.rgpub.io/sanity/images/test/keyart-1920x1080.jpg",
    accentColor: "#231612",
    ...overrides,
  };
}

test("피드에서 버전 있는 최신 패치를 고르고, 카드 모델은 검증된 필드만 담는다", () => {
  const feed = {
    schemaVersion: 1,
    locale: "ko",
    fetchedAt: "2026-08-12T00:00:00.000Z",
    stale: false,
    notes: [note({ patchVersion: undefined, slug: "no-version" }), note(), note({ patchVersion: "26.15" })],
  };
  const latest = latestPatchNoteWithVersion(feed);
  assert.equal(latest?.patchVersion, "26.16");
  assert.equal(latestPatchNoteWithVersion(undefined), undefined);

  const model = patchNotesCardModel(note());
  assert.equal(model?.patchVersion, "26.16");
  assert.equal(model?.imageUrl, note().imageUrl);
  assert.equal(model?.accentColor, "#231612");
  assert.equal(patchNotesCardModel(note({ patchVersion: undefined })), undefined);
  /* 허용 host 밖 이미지·형식 밖 색은 조용히 버립니다 — 카드가 임의 원격을 읽으면 안 됩니다. */
  const stripped = patchNotesCardModel(note({ imageUrl: "https://evil.example/x.jpg", accentColor: "red" }));
  assert.equal(stripped?.imageUrl, undefined);
  assert.equal(stripped?.accentColor, undefined);
});

test("요약 줄바꿈은 최대 2줄 — 한국어는 단어 경계, 일본어는 글자 수, 넘치면 말줄임", () => {
  assert.deepEqual(wrapSummaryLines("", 28), []);
  assert.deepEqual(wrapSummaryLines("짧은 요약", 28), ["짧은 요약"]);
  const ko = wrapSummaryLines("챔피언과 체계 업데이트, 클래식에 찾아온 닌자 등 다양한 변경 사항을 확인해 보세요!", 28);
  assert.equal(ko.length, 2);
  assert.ok([...ko[0]].length <= 28);
  assert.ok(!ko[0].endsWith(" "));
  const ja = wrapSummaryLines("チャンピオンとシステムの調整、あの忍者達がクラシックに参上、その他いろいろ！", 26);
  assert.equal(ja.length, 2);
  assert.ok([...ja[0]].length <= 26);
  const long = wrapSummaryLines("가".repeat(200), 20);
  assert.equal(long.length, 2);
  assert.ok(long[1].endsWith("…"));
});

test("영어 카드 날짜는 en-US 형식이고 발행 기준 시간대는 Asia/Seoul이다", () => {
  /* 18:00Z는 서울 기준 다음 날입니다. locale만 바뀌고 기준 시각은 유지해야 합니다. */
  assert.equal(cardDateLabel("2026-08-11T18:00:00.000Z", "en"), "8/12/2026");
});

test("영어 카드도 폴백형 1200×630 PNG를 만든다", async () => {
  const renderer = new PatchNotesSocialCardRenderer(async () => {
    throw new Error("이 테스트에서는 원격을 호출하면 안 됩니다.");
  });
  const body = await renderer.render(patchNotesCardModel(note({ imageUrl: undefined })), "en");
  const metadata = await sharp(body).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
});

test("키 아트가 없으면 폴백형으로 1200×630 PNG를 만든다", async () => {
  const renderer = new PatchNotesSocialCardRenderer(async () => {
    throw new Error("이 테스트에서는 원격을 호출하면 안 됩니다.");
  });
  const model = patchNotesCardModel(note({ imageUrl: undefined }));
  const body = await renderer.render(model, "ko");
  assert.ok(body.subarray(0, 8).equals(PNG_SIGNATURE));
  const metadata = await sharp(body).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
});

test("키 아트가 있으면 받아서 배경으로 굽고, 같은 버전은 캐시로 재사용한다", async () => {
  const art = await sharp({
    create: { width: 320, height: 180, channels: 3, background: { r: 60, g: 30, b: 20 } },
  }).png().toBuffer();
  let fetchCount = 0;
  const renderer = new PatchNotesSocialCardRenderer(async () => {
    fetchCount += 1;
    return new Response(art, { status: 200, headers: { "content-type": "image/png" } });
  });
  const model = patchNotesCardModel(note());
  const first = await renderer.render(model, "ja");
  const second = await renderer.render(model, "ja");
  assert.equal(fetchCount, 1);
  assert.equal(first, second);
  const metadata = await sharp(first).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
});

test("키 아트 수신이 실패해도 폴백형으로 카드가 나온다", async () => {
  const renderer = new PatchNotesSocialCardRenderer(async () => new Response("nope", { status: 500 }));
  const body = await renderer.render(patchNotesCardModel(note()), "ko");
  assert.ok(body.subarray(0, 8).equals(PNG_SIGNATURE));
  const metadata = await sharp(body).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
});
