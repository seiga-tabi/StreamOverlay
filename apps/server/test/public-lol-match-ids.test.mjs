import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicLolMatchIdsCache } from '../dist/routes/public-lol-match-ids.js';

const routing = { accountRegion: 'asia', lolPlatform: 'kr' };
function fixture(now = Date.now) {
  const calls = [];
  const histories = new Map([
    [400, Array.from({ length: 300 }, (_, i) => `KR_${1000 - i * 2}`)],
    [430, Array.from({ length: 300 }, (_, i) => `JP1_${999 - i * 2}`)]
  ]);
  const riot = {
    async getRecentMatchIdsByPuuid(puuid, count, queues, start, route, signal) {
      calls.push({ puuid, count, queues, start, route, signal });
      return (histories.get(queues[0]) ?? []).slice(start, start + count);
    }
  };
  return { cache: new PublicLolMatchIdsCache(10, now), riot, calls, histories };
}

for (const size of [10, 20]) test(`멀티 큐 ${size}개씩 0→200 순회는 ids 조회 6회로 종료한다`, async () => {
  const { cache, riot, calls, histories } = fixture();
  const actual = [];
  for (let start = 0; start <= 200; start += size) {
    actual.push(...(await cache.get(riot, 'p', size + 1, [400, 430], start, routing)).slice(0, size));
  }
  const expected = [...histories.values()].flat().sort((a, b) => Number(b.split('_')[1]) - Number(a.split('_')[1]));
  assert.deepEqual(actual, expected.slice(0, 200 + size));
  assert.equal(calls.length, 6);
  for (const queue of [400, 430]) assert.deepEqual(calls.filter(c => c.queues[0] === queue).map(c => c.start), [0, 100, 200]);
});

test('TTL·명시적 무효화·puuid·리전은 캐시를 분리하고 단일 큐/all은 그대로 전달한다', async () => {
  let now = 0;
  const { cache, riot, calls } = fixture(() => now);
  const get = (puuid = 'p', route = routing) => cache.get(riot, puuid, 21, [400, 430], 0, route);
  await get(); await get();
  assert.equal(calls.length, 2);
  await get('other');
  await get('p', { ...routing, accountRegion: 'americas' });
  assert.equal(calls.length, 6);
  now = 45_000;
  await get();
  assert.equal(calls.length, 8);
  cache.invalidate('p');
  await get();
  assert.equal(calls.length, 10);
  for (const queues of [[], [420]]) {
    await cache.get(riot, 'p', 21, queues, 40, routing);
    assert.deepEqual(calls.at(-1).queues, queues);
    assert.equal(calls.at(-1).start, 40);
    assert.equal(calls.at(-1).count, 21);
  }
});

test('빈 큐는 재조회하지 않고 취소된 확장은 캐시에 반영하지 않는다', async () => {
  const { cache, riot, calls, histories } = fixture();
  histories.set(430, []);
  await cache.get(riot, 'p', 21, [400, 430], 0, routing);
  const controller = new AbortController();
  const original = riot.getRecentMatchIdsByPuuid;
  riot.getRecentMatchIdsByPuuid = async (...args) => {
    const ids = await original(...args);
    assert.equal(args[5], controller.signal);
    controller.abort();
    return ids;
  };
  await assert.rejects(cache.get(riot, 'p', 21, [400, 430], 100, routing, controller.signal));
  riot.getRecentMatchIdsByPuuid = original;
  await cache.get(riot, 'p', 21, [400, 430], 100, routing);
  assert.deepEqual(calls.filter(c => c.queues[0] === 400).map(c => c.start), [0, 100, 100]);
  assert.equal(calls.filter(c => c.queues[0] === 430).length, 1);
});

test('진행 중 무효화된 캐시는 늦은 응답으로 되살아나지 않는다', async () => {
  const { cache, riot, calls } = fixture();
  const original = riot.getRecentMatchIdsByPuuid;
  let release;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  riot.getRecentMatchIdsByPuuid = async (...args) => {
    const ids = await original(...args);
    if (args[2][0] === 400) { started(); await barrier; }
    return ids;
  };
  const pending = cache.get(riot, 'p', 21, [400, 430], 0, routing);
  await ready;
  cache.invalidate('p');
  release();
  await pending;
  riot.getRecentMatchIdsByPuuid = original;
  await cache.get(riot, 'p', 21, [400, 430], 0, routing);
  assert.equal(calls.filter(c => c.queues[0] === 400).length, 2);
});

test('짧은 동시 요청은 먼저 완료된 긴 목록을 축소하지 않는다', async () => {
  const { cache, riot, calls } = fixture();
  const original = riot.getRecentMatchIdsByPuuid;
  let release;
  let started;
  let first = true;
  const ready = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  riot.getRecentMatchIdsByPuuid = async (...args) => {
    const ids = await original(...args);
    if (first) { first = false; started(); await barrier; }
    return ids;
  };
  const shorter = cache.get(riot, 'p', 21, [400, 430], 0, routing);
  await ready;
  await cache.get(riot, 'p', 21, [400, 430], 200, routing);
  release();
  await shorter;
  const count = calls.length;
  await cache.get(riot, 'p', 21, [400, 430], 200, routing);
  assert.equal(calls.length, count);
});
