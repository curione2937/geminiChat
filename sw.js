// サービスワーカー for Gemini Chat Pro
const CACHE_NAME = 'gemini-chat-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/js/api.js',
    '/js/config.js',
    '/js/state.js',
    '/js/ui.js',
    '/manifest.json'
];

// リクエストがキャッシュ可能かチェック
function isValidCacheRequest(request) {
    const url = new URL(request.url);
    
    // chrome-extension, moz-extension などのスキームを除外
    if (url.protocol === 'chrome-extension:' || 
        url.protocol === 'moz-extension:' || 
        url.protocol === 'safari-extension:' ||
        url.protocol === 'ms-browser-extension:') {
        return false;
    }
    
    // データURLを除外
    if (url.protocol === 'data:') {
        return false;
    }
    
    // blob URLを除外
    if (url.protocol === 'blob:') {
        return false;
    }
    
    return true;
}

// インストール時
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Caching app resources');
                // 有効なURLのみをキャッシュ
                const validUrls = urlsToCache.filter(url => {
                    try {
                        const testUrl = new URL(url, self.location.origin);
                        return isValidCacheRequest({ url: testUrl.href });
                    } catch (e) {
                        console.warn('Invalid URL for caching:', url);
                        return false;
                    }
                });
                return cache.addAll(validUrls);
            })
            .then(() => {
                console.log('✅ Service Worker installed successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker install failed:', error);
            })
    );
});

// アクティベート時
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker activated');
            return self.clients.claim();
        })
    );
});

// フェッチイベント（ネットワークリクエストの処理）
self.addEventListener('fetch', (event) => {
    // 無効なリクエストは処理しない
    if (!isValidCacheRequest(event.request)) {
        return;
    }
    
    const requestUrl = new URL(event.request.url);
    
    // API リクエストは常にネットワーク優先
    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        return response;
                    }
                    return response;
                })
                .catch((error) => {
                    console.warn('🌐 API request failed, network error:', error);
                    return new Response(
                        JSON.stringify({
                            error: 'ネットワークエラーが発生しました。接続を確認してください。',
                            offline: true
                        }),
                        {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }
    
    // 静的リソースはキャッシュ優先
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    console.log('📦 Serving from cache:', event.request.url);
                    return response;
                }
                
                console.log('🌐 Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // 有効なレスポンスのみキャッシュ
                        if (isValidCacheRequest(event.request)) {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                })
                                .catch((error) => {
                                    console.warn('Failed to cache response:', error);
                                });
                        }
                        
                        return response;
                    })
                    .catch((error) => {
                        console.warn('🚨 Network request failed:', error);
                        
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        
                        return new Response(
                            'ネットワークエラー: オフラインです。',
                            {
                                status: 503,
                                statusText: 'Service Unavailable'
                            }
                        );
                    });
            })
    );
});

// メッセージイベント（アプリからの通信）
self.addEventListener('message', (event) => {
    console.log('💬 Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }
});

// エラーハンドリング
self.addEventListener('error', (event) => {
    console.error('🚨 Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Service Worker unhandled rejection:', event.reason);
    // プロミス拒否を処理済みとしてマーク
    event.preventDefault();
});

console.log('🎯 Service Worker script loaded');