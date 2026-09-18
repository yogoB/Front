import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* 화면에서 쓰는 컴포넌트가 그 파일에 실제로 있는지 본다.
   2026-09-18: "미사용 코드 삭제"가 FlowHead 가 부르던 Progress 를 지웠고, 계약 테스트 25개는 전부 초록인데
   운영의 /light·/detail 이 흰 화면이 됐다(ReferenceError: Progress is not defined). 빌드도 안 잡는다 —
   번들러는 전역일 수도 있다고 보고 넘어간다. 그래서 파일 단위로 "쓰는데 없는 이름"만 찾는다.
   렌더 테스트(jsdom) 대신인 셈이고, 새 의존성은 쓰지 않는다. */

const files = (function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.jsx') ? [path] : [];
  });
})('src');

/** JSX 에서 쓰는 대문자 태그. `<Foo.Bar` 는 첫 마디만 본다(`Foo` 가 있으면 된다). */
const used = source => new Set(
  [...source.matchAll(/<([A-Z][\w]*)/g)].map(m => m[1]));

/** 같은 파일에서 선언하거나 import 한 이름. */
function defined(source) {
  const names = new Set();
  for (const m of source.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:function|class)\s+([A-Z][\w]*)/g)) names.add(m[1]);
  for (const m of source.matchAll(/(?:^|\n)\s*(?:export\s+)?const\s+([A-Z][\w]*)\s*=/g)) names.add(m[1]);
  for (const m of source.matchAll(/import\s+([^;]+?)\s+from/g)) {
    for (const part of m[1].replace(/[{}]/g, ',').split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Z][\w]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

test('화면이 쓰는 컴포넌트는 그 파일에 있거나 import 돼 있다', () => {
  let checked = 0;
  const missing = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const have = defined(source);
    for (const name of used(source)) {
      checked++;
      if (!have.has(name)) missing.push(`${file}: <${name}>`);
    }
  }
  // 스캐너가 아무것도 못 찾으면 이 테스트는 늘 초록이다 — 그 침묵을 먼저 막는다.
  assert.ok(checked > 50, `컴포넌트 사용을 ${checked}개만 찾았다 — 스캐너가 깨진 것 같다`);
  assert.deepEqual(missing, [], `없는 컴포넌트를 쓰고 있다:\n${missing.join('\n')}`);
});
