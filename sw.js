/* =====================================================
 * Biz-Navi Service Worker
 * Cache First戦略 / アプリシェルキャッシュ / オフライン対応
 * ===================================================== */

const CACHE_VERSION = 'biz-navi-v8';  // 2026-06-29 oauth implicit flow
const CACHE_NAME = CACHE_VERSION;

// キャッシュ対象のアプリシェルファイル
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.css',
  './app.js',
  './settings.js',
  './storage.js',
  './accounts.js',
  './dencho.js',
  './icons.js',
  './terms.js',
  './pro-features.js',
  './pro-tax.js',
  './pro-subsidy.js',
  './gdrive.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// SWをバイパスするURLパターン（外部API・Google Drive等）
const BYPASS_PATTERNS = [
  'googleapis.com',
  'google.com/drive',
  'api.anthropic.com',
  'stripe.com',
  'firebase',
  'firebaseapp.com',
  'chrome-extension://',
  'firebase-config.js',
  'auth.js',
  'gdrive.js'
];

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : install
 * │   インストール時にアプリシェルをキャッシュ
 * └──────────────────────────────────────────────────────┘ */
self.addEventListener('install', event => {
  console.log('[SW] インストール開始:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] アプリシェルをキャッシュ中...');
      // アイコンが存在しない場合もエラーにしない
      return Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(e => console.warn('[SW] キャッシュスキップ:', url, e.message)))
      );
    }).then(() => {
      console.log('[SW] インストール完了');
      return self.skipWaiting();
    })
  );
});
/* └ END : install ──────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : activate
 * │   古いキャッシュを削除してクライアントを引き継ぐ
 * └──────────────────────────────────────────────────────┘ */
self.addEventListener('activate', event => {
  console.log('[SW] アクティベート:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] 古いキャッシュを削除:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] 全クライアントを引き継ぎ');
      return self.clients.claim();
    })
  );
});
/* └ END : activate ──────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : fetch
 * │   Cache First戦略（外部APIはバイパス）
 * └──────────────────────────────────────────────────────┘ */
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // GETリクエスト以外はスルー
  if (event.request.method !== 'GET') return;

  // 外部API・Google Drive等はバイパス
  if (BYPASS_PATTERNS.some(pattern => url.includes(pattern))) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // キャッシュがある場合: Cache Firstで即返す + バックグラウンドで更新
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(() => {}); // オフライン時はサイレントに失敗
        return cachedResponse;
      }

      // キャッシュがない場合: ネットワークから取得してキャッシュに追加
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => {
        // オフライン時: index.htmlにフォールバック
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
/* └ END : fetch ──────────────────────────────────────┘ */


