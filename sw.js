/* うちごはん帳 — service worker
 *
 * 方針（マッサージ店アプリと同じ）:
 *   ネットワークから正常な応答（200番台）が取れた時だけキャッシュを更新する。
 *   404 やオフラインなど、それ以外の場合はキャッシュを優先して返す。
 *
 * ねらい:
 *   - 更新したら次に開いたとき必ず最新版が出る（反映されない問題を防ぐ）
 *   - 将来リポジトリを消しても、最後にキャッシュされた状態で使い続けられる
 */

const CACHE = 'uchigohan-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .catch(() => null)      // 1つ失敗しても install 自体は通す
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 以外と外部ドメイン（公式レシピへのリンク等）は素通し
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 200番台のときだけキャッシュを差し替える
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }
        // 404 などはキャッシュを優先。無ければサーバの応答をそのまま返す
        return caches.match(req).then((hit) => hit || res);
      })
      .catch(() =>
        // オフライン等。キャッシュ、無ければトップページを返す
        caches.match(req).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
