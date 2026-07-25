import assert from "node:assert/strict";
import test from "node:test";
import {
  palworldMapUrlWithQueryPatch,
  parsePalworldMapQuery,
  subscribePalworldMapQueryState,
  updatePalworldMapLayerSelection,
  updatePalworldMapQueryParams,
} from "../src/features/public-palworld/hooks/usePalworldMapQueryState";
import { PALWORLD_ROUTE_EVENT } from "../src/features/public-palworld/utils/routes";

test("지도 query는 허용된 값만 exact match로 복원한다", () => {
  assert.deepEqual(
    parsePalworldMapQuery(new URLSearchParams(
      "world=tree&layers=spawn,boss&focusPal=anubis&period=night&x=0.125&y=1&zoom=2.5&marker=main-001-anubis",
    )),
    {
      center: { x: 0.125, y: 1 },
      focusPal: "anubis",
      layers: ["boss", "spawn"],
      marker: "main-001-anubis",
      period: "night",
      world: "tree",
      zoom: 2.5,
    },
  );

  assert.deepEqual(
    parsePalworldMapQuery(new URLSearchParams(
      "world=MAIN&layers=boss,boss&focusPal=../anubis&period=Night&x=0.5&y=1.01&zoom=Infinity&marker=main%2F001",
    )),
    {
      layers: ["boss", "spawn"],
      period: "all",
      world: "main",
      zoom: 1,
    },
  );
});

test("지도 query의 중복 key와 불완전한 좌표 쌍은 기본값으로 제한한다", () => {
  const parsed = parsePalworldMapQuery(new URLSearchParams(
    "world=tree&world=main&layers=&period=day&period=night&focusPal=anubis&focusPal=cattiva&x=0.25&zoom=3.001",
  ));
  assert.deepEqual(parsed, {
    layers: [],
    period: "all",
    world: "main",
    zoom: 1,
  });
});

test("지도 query 변경은 다른 검색·상세 query를 보존하고 기본값을 URL에서 정리한다", () => {
  const current = new URLSearchParams(
    "q=%EC%95%84%EB%88%84%EB%B9%84%EC%8A%A4&pal=cattiva&viewer_twitch=connected&world=tree",
  );
  const next = updatePalworldMapQueryParams(current, {
    center: { x: 0.3333334, y: 0.75 },
    focusPal: "anubis",
    layers: ["spawn"],
    marker: "main-001-anubis",
    period: "day",
    world: "main",
    zoom: 2.125,
  });

  assert.equal(next.get("q"), "아누비스");
  assert.equal(next.get("pal"), "cattiva");
  assert.equal(next.get("viewer_twitch"), "connected");
  assert.equal(next.has("world"), false);
  assert.equal(next.get("layers"), "spawn");
  assert.equal(next.get("focusPal"), "anubis");
  assert.equal(next.get("period"), "day");
  assert.equal(next.get("x"), "0.333333");
  assert.equal(next.get("y"), "0.75");
  assert.equal(next.get("zoom"), "2.125");
  assert.equal(next.get("marker"), "main-001-anubis");

  const cleared = updatePalworldMapQueryParams(next, {
    center: null,
    focusPal: null,
    layers: ["boss", "spawn"],
    marker: null,
    period: "all",
    zoom: 1,
  });
  assert.equal(
    cleared.toString(),
    "q=%EC%95%84%EB%88%84%EB%B9%84%EC%8A%A4&pal=cattiva&viewer_twitch=connected",
  );
});

test("지도 query helper는 잘못된 좌표·ID·중복 레이어를 기록하지 않는다", () => {
  assert.throws(
    () => updatePalworldMapQueryParams(new URLSearchParams(), {
      center: { x: -0.1, y: 0.5 },
    }),
    RangeError,
  );
  assert.throws(
    () => updatePalworldMapQueryParams(new URLSearchParams(), {
      focusPal: "../anubis",
    }),
    TypeError,
  );
  assert.throws(
    () => updatePalworldMapQueryParams(new URLSearchParams(), {
      layers: ["boss", "boss"],
    }),
    TypeError,
  );
  assert.equal(
    parsePalworldMapQuery(new URLSearchParams(`focusPal=${"a".repeat(81)}`)).focusPal,
    undefined,
  );
});

test("레이어 그룹 선택은 여러 레이어를 한 번에 결정적인 순서로 반영한다", () => {
  assert.deepEqual(
    updatePalworldMapLayerSelection([], ["boss", "spawn"], true),
    ["boss", "spawn"],
  );
  assert.deepEqual(
    updatePalworldMapLayerSelection(["boss", "spawn"], ["boss"], false),
    ["spawn"],
  );
  assert.throws(
    () => updatePalworldMapLayerSelection(["boss", "boss"], ["spawn"], true),
    TypeError,
  );
});

test("지도 URL helper는 map 경로를 사용하고 기존 query를 보존한다", () => {
  const url = new URL(
    palworldMapUrlWithQueryPatch(
      new URLSearchParams("q=pal"),
      { layers: [], world: "tree" },
    ),
    "https://streamoverlay.example",
  );
  assert.equal(url.pathname, "/palworld/map");
  assert.equal(url.searchParams.get("q"), "pal");
  assert.equal(url.searchParams.get("layers"), "");
  assert.equal(url.searchParams.get("world"), "tree");
});

test("지도 query 구독은 popstate와 내부 route 이벤트를 모두 복원 신호로 전달한다", () => {
  const target = new EventTarget();
  let calls = 0;
  const unsubscribe = subscribePalworldMapQueryState(target, () => {
    calls += 1;
  });

  target.dispatchEvent(new Event("popstate"));
  target.dispatchEvent(new Event(PALWORLD_ROUTE_EVENT));
  assert.equal(calls, 2);

  unsubscribe();
  target.dispatchEvent(new Event("popstate"));
  assert.equal(calls, 2);
});
