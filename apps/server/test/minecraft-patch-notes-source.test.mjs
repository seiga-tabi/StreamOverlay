import test from "node:test";
import assert from "node:assert/strict";

const {
  MINECRAFT_JAVA_PATCH_NOTES_HUB_URL,
  MINECRAFT_JAVA_VERSION_MANIFEST_URL,
  fetchMinecraftJavaPatchEntries,
  minecraftJavaPatchEntriesFromManifest
} = await import("../dist/services/minecraft-patch-notes-source.js");
const {
  MINECRAFT_FEEDBACK_SECTION_IDS,
  applyMinecraftJavaOfficialUrls,
  bedrockVersionsFromFeedbackTitle,
  fetchMinecraftFeedbackSectionArticles,
  javaVersionsFromFeedbackTitle,
  minecraftBedrockPatchEntriesFromArticles
} = await import("../dist/services/minecraft-patch-notes-feedback-source.js");

function sourceEntry(id, type, releaseTime) {
  return {
    id,
    type,
    url: `https://piston-meta.mojang.com/v1/packages/${"a".repeat(40)}/${id}.json`,
    time: releaseTime,
    releaseTime,
    sha1: "a".repeat(40),
    complianceLevel: 1
  };
}

function manifest() {
  return {
    latest: { release: "26.2", snapshot: "26.3-snapshot-8" },
    versions: [
      sourceEntry("26.2", "release", "2026-06-16T09:00:00+00:00"),
      sourceEntry("b1.8.1", "old_beta", "2011-09-19T00:00:00+00:00"),
      sourceEntry("26.3-snapshot-8", "snapshot", "2026-08-12T09:39:37+00:00"),
      sourceEntry("25w42a", "snapshot", "2025-10-14T12:00:00+00:00")
    ]
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function feedbackArticle(id, sectionId, title, createdAt = "2026-08-14T17:00:33Z") {
  return {
    id,
    section_id: sectionId,
    locale: "en-us",
    draft: false,
    title,
    created_at: createdAt,
    html_url: `https://feedback.minecraft.net/hc/en-us/articles/${id}-Minecraft-Changelog`
  };
}

function feedbackPage(sectionId, articles, options = {}) {
  const page = options.page ?? 1;
  const pageCount = options.pageCount ?? 1;
  const count = options.count ?? articles.length;
  return {
    articles,
    count,
    next_page: page < pageCount
      ? `https://feedback.minecraft.net/api/v2/help_center/en-us/sections/${sectionId}/articles.json?page=${page + 1}&per_page=100&sort_by=created_at&sort_order=desc`
      : null,
    page,
    page_count: pageCount,
    per_page: 100,
    previous_page: page > 1 ? "https://feedback.minecraft.net/previous" : null,
    sort_by: "created_at",
    sort_order: "desc"
  };
}

test("Mojang Java manifest를 계약 형식으로 바꾸고 발행일 내림차순으로 정렬한다", () => {
  const entries = minecraftJavaPatchEntriesFromManifest(manifest());
  assert.deepEqual(entries.map((entry) => entry.version), ["26.3-snapshot-8", "26.2", "25w42a"]);
  assert.deepEqual(entries.map((entry) => entry.type), ["snapshot", "release", "snapshot"]);
  assert.equal(entries[0].publishedAt, "2026-08-12T09:39:37.000Z");
  assert.equal(entries[0].officialUrl, MINECRAFT_JAVA_PATCH_NOTES_HUB_URL);
  assert.equal(entries[0].title, undefined, "기계 요약을 생성하지 않습니다.");
});

test("Java 수집 URL은 외부 입력과 무관한 Mojang 공식 endpoint로 고정한다", () => {
  assert.equal(
    MINECRAFT_JAVA_VERSION_MANIFEST_URL,
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
  );
});

test("현재 release/snapshot 엔트리가 손상되면 부분 결과 대신 fail-closed한다", () => {
  const tampered = manifest();
  tampered.versions[0].url = "https://evil.example/release.json";
  assert.throws(
    () => minecraftJavaPatchEntriesFromManifest(tampered),
    /MINECRAFT_JAVA_MANIFEST_ENTRY_INVALID/u
  );
  assert.throws(
    () => minecraftJavaPatchEntriesFromManifest({ versions: [] }),
    /MINECRAFT_JAVA_MANIFEST_SIZE_INVALID/u
  );
});

test("일시적인 upstream 오류는 제한된 횟수만 재시도한다", async () => {
  let calls = 0;
  const sleeps = [];
  const entries = await fetchMinecraftJavaPatchEntries({
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({}, 503);
      if (calls === 2) return jsonResponse({}, 429);
      return jsonResponse(manifest());
    },
    sleepImpl: async (delay) => { sleeps.push(delay); }
  });
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [250, 500]);
  assert.equal(entries.length, 3);
});

test("재시도해도 의미 없는 4xx와 크기 초과 응답은 즉시 거부한다", async () => {
  let calls = 0;
  await assert.rejects(
    fetchMinecraftJavaPatchEntries({
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({}, 404);
      },
      sleepImpl: async () => undefined
    }),
    /MINECRAFT_JAVA_MANIFEST_STATUS_404/u
  );
  assert.equal(calls, 1);
  await assert.rejects(
    fetchMinecraftJavaPatchEntries({
      fetchImpl: async () => new Response("{}", {
        headers: {
          "content-type": "application/json",
          "content-length": String(3 * 1024 * 1024)
        }
      })
    }),
    /MINECRAFT_JAVA_MANIFEST_TOO_LARGE/u
  );
});

test("공식 Help Center 섹션 ID를 고정하고 Bedrock release·preview 제목만 strict 파싱한다", () => {
  assert.deepEqual(MINECRAFT_FEEDBACK_SECTION_IDS, {
    release: 360001186971,
    bedrockPreview: 360001185332,
    javaSnapshot: 360002267532
  });
  assert.deepEqual(
    bedrockVersionsFromFeedbackTitle("Minecraft - 1.21.132 (Bedrock)", "release"),
    ["1.21.132"]
  );
  assert.deepEqual(
    bedrockVersionsFromFeedbackTitle(
      "Minecraft: Bedrock Edition 26.41/42/43 Hotfix Changelog",
      "release"
    ),
    ["26.41", "26.42", "26.43"]
  );
  assert.deepEqual(
    bedrockVersionsFromFeedbackTitle("Minecraft Beta & Preview - 1.21.130.25", "preview"),
    ["1.21.130.25"]
  );
  for (const [title, type] of [
    ["Minecraft - 1.21.132", "release"],
    ["Minecraft Beta - 1.21.130.25", "preview"],
    ["Minecraft Beta & Preview - ../../etc/passwd", "preview"],
    ["Minecraft: Java Edition 1.21.11", "release"]
  ]) assert.deepEqual(bedrockVersionsFromFeedbackTitle(title, type), [], title);
});

test("Java release·snapshot·pre-release·RC 제목을 manifest ID와 동일하게 정규화한다", () => {
  const cases = [
    ["Minecraft: Java Edition - 1.20.1", ["1.20.1"]],
    ["Minecraft Java Edition - 26.3 Snapshot 8", ["26.3-snapshot-8"]],
    ["Minecraft Java Edition - Snapshot 25w36a+b", ["25w36a", "25w36b"]],
    ["Minecraft Java Edition - 1.21.11 Pre-Release 5", ["1.21.11-pre5"]],
    ["Minecraft Java Edition - 1.21.11 Release Candidate 3", ["1.21.11-rc3"]],
    ["Minecraft Java Edition Snapshot latest", []]
  ];
  for (const [title, expected] of cases) {
    assert.deepEqual(javaVersionsFromFeedbackTitle(title), expected, title);
  }
});

test("Bedrock article metadata로 release·preview 엔트리를 만들고 최신순으로 정렬한다", () => {
  const releaseId = MINECRAFT_FEEDBACK_SECTION_IDS.release;
  const previewId = MINECRAFT_FEEDBACK_SECTION_IDS.bedrockPreview;
  const entries = minecraftBedrockPatchEntriesFromArticles(
    [feedbackArticle(10, releaseId, "Minecraft - 1.21.132 (Bedrock)")].map((article) => ({
      id: article.id,
      sectionId: releaseId,
      title: article.title,
      createdAt: "2026-08-14T17:00:33.000Z",
      htmlUrl: article.html_url
    })),
    [feedbackArticle(
      11,
      previewId,
      "Minecraft Beta & Preview - 26.50.25",
      "2026-08-15T17:00:33Z"
    )].map((article) => ({
      id: article.id,
      sectionId: previewId,
      title: article.title,
      createdAt: "2026-08-15T17:00:33.000Z",
      htmlUrl: article.html_url
    }))
  );
  assert.deepEqual(entries.map(({ version, type }) => ({ version, type })), [
    { version: "26.50.25", type: "preview" },
    { version: "1.21.132", type: "release" }
  ]);
});

test("Java officialUrl은 정확한 버전만 교체하고 미매칭 버전은 공식 허브를 유지한다", () => {
  const entries = minecraftJavaPatchEntriesFromManifest(manifest());
  const sectionId = MINECRAFT_FEEDBACK_SECTION_IDS.javaSnapshot;
  const article = feedbackArticle(
    20,
    sectionId,
    "Minecraft Java Edition - 26.3 Snapshot 8"
  );
  const result = applyMinecraftJavaOfficialUrls(entries, [{
    id: article.id,
    sectionId,
    title: article.title,
    createdAt: "2026-08-14T17:00:33.000Z",
    htmlUrl: article.html_url
  }]);
  assert.equal(result.matched, 1);
  assert.equal(result.fallback, 2);
  assert.equal(result.entries[0].officialUrl, article.html_url);
  assert.equal(result.entries[1].officialUrl, MINECRAFT_JAVA_PATCH_NOTES_HUB_URL);
});

test("Zendesk pagination은 고정 URL로만 순회하고 설정된 최대 페이지를 넘으면 중단한다", async () => {
  const sectionId = MINECRAFT_FEEDBACK_SECTION_IDS.release;
  const firstArticles = Array.from({ length: 100 }, (_, index) => feedbackArticle(
    index + 1,
    sectionId,
    `Minecraft - 1.21.${index + 1} (Bedrock)`
  ));
  let calls = 0;
  await assert.rejects(
    fetchMinecraftFeedbackSectionArticles(sectionId, {
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(feedbackPage(sectionId, firstArticles, {
          pageCount: 2,
          count: 101
        }));
      },
      maxPages: 1
    }),
    /MINECRAFT_FEEDBACK_PAGE_LIMIT_EXCEEDED/u
  );
  assert.equal(calls, 1);

  const requestedPages = [];
  const articles = await fetchMinecraftFeedbackSectionArticles(sectionId, {
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      assert.equal(parsed.hostname, "feedback.minecraft.net");
      assert.match(parsed.pathname, new RegExp(`/sections/${sectionId}/articles\\.json$`, "u"));
      const page = Number(parsed.searchParams.get("page"));
      requestedPages.push(page);
      return page === 1
        ? jsonResponse(feedbackPage(sectionId, firstArticles, { pageCount: 2, count: 101 }))
        : jsonResponse(feedbackPage(sectionId, [feedbackArticle(101, sectionId, "Minecraft - 1.21.101 (Bedrock)")], {
            page: 2,
            pageCount: 2,
            count: 101
          }));
    }
  });
  assert.deepEqual(requestedPages, [1, 2]);
  assert.equal(articles.length, 101);
});

test("Zendesk article URL allowlist와 페이지 바이트 상한을 fail-closed로 적용한다", async () => {
  const sectionId = MINECRAFT_FEEDBACK_SECTION_IDS.release;
  const tampered = feedbackArticle(301, sectionId, "Minecraft - 1.21.132 (Bedrock)");
  tampered.html_url = "https://evil.example/hc/en-us/articles/301";
  await assert.rejects(
    fetchMinecraftFeedbackSectionArticles(sectionId, {
      fetchImpl: async () => jsonResponse(feedbackPage(sectionId, [tampered]))
    }),
    /MINECRAFT_FEEDBACK_ARTICLE_INVALID/u
  );
  await assert.rejects(
    fetchMinecraftFeedbackSectionArticles(sectionId, {
      fetchImpl: async () => new Response("{}", {
        headers: {
          "content-type": "application/json",
          "content-length": String(9 * 1024 * 1024)
        }
      })
    }),
    /MINECRAFT_FEEDBACK_PAGE_TOO_LARGE/u
  );
});
