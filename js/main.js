import { setupConfigEventListeners, setConfigToUI, updateModelSelectOptions, setThreadConfigToUI, initializeApiKeySettings } from './config.js';
import * as ui from './ui.js';
import { sendMessage, fetchAvailableModels } from './api.js';
import { 
    getAvailableModels, 
    getDefaultSettings, 
    updateDefaultChannelSettings, 
    updateDefaultThreadSettings, 
    resetDefaultSettings 
} from './state.js';
import * as state from './state.js';

const UIElements = {
    chatForm: document.getElementById('chat-form'), messageInput: document.getElementById('message-input'),
    newChannelBtn: document.getElementById('new-channel-btn'), newThreadBtn: document.getElementById('new-thread-btn'),
    channelList: document.getElementById('channel-list'), threadList: document.getElementById('thread-list'),
    threadNameInput: document.getElementById('current-thread-name-input'),
    chatHistory: document.getElementById('chat-history'),
    importBtn: document.getElementById('import-btn'), importFileInput: document.getElementById('import-file-input'), exportBtn: document.getElementById('export-btn'),
    attachFileBtn: document.getElementById('attach-file-btn'), attachFileInput: document.getElementById('attach-file-input'),
    fileAttachmentsContainer: document.getElementById('file-attachments-container'),
    bgImageInput: document.getElementById('bg-image-input'), clearBgImageBtn: document.getElementById('clear-bg-image-btn'),
    channelUserIconInput: document.getElementById('channel-user-icon-input'), clearChannelUserIconBtn: document.getElementById('clear-channel-user-icon-btn'),
    channelModelIconInput: document.getElementById('channel-model-icon-input'), clearChannelModelIconBtn: document.getElementById('clear-channel-model-icon-btn'),
    overrideThreadIconsToggle: document.getElementById('override-thread-icons-toggle'),
    threadUserIconInput: document.getElementById('thread-user-icon-input'), clearThreadUserIconBtn: document.getElementById('clear-thread-user-icon-btn'),
    threadModelIconInput: document.getElementById('thread-model-icon-input'), clearThreadModelIconBtn: document.getElementById('clear-thread-model-icon-btn'),
    searchIcon: document.getElementById('search-icon'), searchModalCloseBtn: document.getElementById('search-modal-close-btn'),
    searchModalInput: document.getElementById('search-modal-input'), searchModalButton: document.getElementById('search-modal-button'),
    searchResultsContainer: document.getElementById('search-results-container'),
    editModalCloseBtn: document.getElementById('edit-modal-close-btn'), editModalSaveBtn: document.getElementById('edit-modal-save-btn'),
    editModalCancelBtn: document.getElementById('edit-modal-cancel-btn'),
    // モバイル用要素
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileSettingsBtn: document.getElementById('mobile-settings-btn'),
    mobileCurrentChannel: document.getElementById('mobile-current-channel'),
    mobileCurrentThread: document.getElementById('mobile-current-thread'),
    sidebar: document.getElementById('sidebar'),
    settingsPanel: document.getElementById('settings-panel'),
    sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
    settingsCloseBtn: document.getElementById('settings-close-btn'),
    mobileOverlay: document.getElementById('mobile-overlay'),
    // ネットワーク関連要素
    networkStatus: document.getElementById('network-status'),
    currentApiUrl: document.getElementById('current-api-url'),
    testConnectionBtn: document.getElementById('test-connection-btn'),
    mobileNetworkSetupBtn: document.getElementById('mobile-network-setup-btn'),
    networkSetupModal: document.getElementById('network-setup-modal'),
    networkSetupCloseBtn: document.getElementById('network-setup-close-btn'),
    customApiUrl: document.getElementById('custom-api-url'),
    connectionStatus: document.getElementById('connection-status'),
    saveNetworkSettingsBtn: document.getElementById('save-network-settings-btn'),
    resetNetworkSettingsBtn: document.getElementById('reset-network-settings-btn'),
    // チャンネル共有ファイル関連要素
    channelFileUploadBtn: document.getElementById('channel-file-upload-btn'),
    channelFileInput: document.getElementById('channel-file-input'),
    channelSharedFilesList: document.getElementById('channel-shared-files-list'),
    useChannelFilesToggle: document.getElementById('use-channel-files-toggle')
};

let isSending = false; 
let editingMessageId = null; 
let attachedFiles = [];
let connectionCheckInterval = null;

// ==========================================
// コピー機能の改善
// ==========================================

// 改善されたコピー機能（フォールバック付き）
async function copyToClipboard(text) {
    console.log('📋 コピー機能実行開始:', text.substring(0, 50) + '...');
    
    try {
        // 最新のClipboard API（HTTPS環境で推奨）
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            console.log('✅ Clipboard API使用でコピー成功');
            showToast('📋 コピーしました', 'success');
            return true;
        }
        
        // フォールバック：従来の方法（HTTP環境用）
        console.log('⚠️ Clipboard API使用不可、フォールバック実行');
        return fallbackCopyText(text);
        
    } catch (error) {
        console.error('❌ Clipboard API エラー:', error);
        // フォールバックを試行
        return fallbackCopyText(text);
    }
}

// フォールバック用コピー機能
function fallbackCopyText(text) {
    try {
        // 一時的なテキストエリアを作成
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // スタイルを設定（画面外に配置）
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        textArea.style.tabIndex = '-1';
        
        // DOMに追加
        document.body.appendChild(textArea);
        
        // テキストを選択
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, text.length);
        
        // コピー実行
        const successful = document.execCommand('copy');
        
        // 要素を削除
        document.body.removeChild(textArea);
        
        if (successful) {
            console.log('✅ フォールバック方式でコピー成功');
            showToast('📋 コピーしました', 'success');
            return true;
        } else {
            throw new Error('document.execCommand failed');
        }
        
    } catch (error) {
        console.error('❌ フォールバックコピーもエラー:', error);
        
        // 最後の手段：手動コピーのガイダンス表示
        if (window.innerWidth <= 768) {
            // モバイルの場合
            showToast('⚠️ コピー機能が利用できません。テキストを長押しして選択してください。', 'warning');
        } else {
            // デスクトップの場合
            showToast('⚠️ コピー機能が利用できません。Ctrl+C でコピーしてください。', 'warning');
        }
        return false;
    }
}

// ==========================================
// モバイル最適化関連の関数群
// ==========================================

// Viewport高さの動的調整
function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    console.log(`📱 Viewport height updated: ${window.innerHeight}px (--vh: ${vh}px)`);
}

// ビューポート高さの設定
function setupViewportFix() {
    setViewportHeight();
    
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            setViewportHeight();
        }, 100);
    });
    
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            setViewportHeight();
        }, 500);
    });
    
    if (window.visualViewport) {
        console.log('📱 Visual Viewport API supported');
        
        const handleVisualViewportChange = () => {
            const vh = window.visualViewport.height * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            
            const isKeyboardOpen = window.visualViewport.height < window.innerHeight * 0.75;
            document.body.classList.toggle('keyboard-open', isKeyboardOpen);
            
            console.log(`📱 Visual viewport changed: ${window.visualViewport.height}px (keyboard: ${isKeyboardOpen})`);
        };
        
        window.visualViewport.addEventListener('resize', handleVisualViewportChange);
        window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }
    
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            setTimeout(() => {
                setViewportHeight();
            }, 100);
        }
    });
    
    const inputElements = ['input', 'textarea', 'select'];
    inputElements.forEach(selector => {
        document.addEventListener('focusin', (e) => {
            if (e.target.matches(selector)) {
                setTimeout(() => {
                    setViewportHeight();
                }, 300);
            }
        });
        
        document.addEventListener('focusout', (e) => {
            if (e.target.matches(selector)) {
                setTimeout(() => {
                    setViewportHeight();
                }, 300);
            }
        });
    });
}

// スクロール動作の改善
function improveScrollBehavior() {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;
    
    let scrollTimeout;
    chatHistory.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            localStorage.setItem('chatScrollPosition', chatHistory.scrollTop);
        }, 100);
    });
    
    if ('ontouchstart' in window) {
        let startY = 0;
        let isScrolling = false;
        
        chatHistory.addEventListener('touchstart', (e) => {
            startY = e.touches[0].pageY;
            isScrolling = false;
        }, { passive: true });
        
        chatHistory.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].pageY;
            const diffY = Math.abs(currentY - startY);
            
            if (diffY > 10) {
                isScrolling = true;
            }
        }, { passive: true });
        
        chatHistory.addEventListener('touchend', () => {
            if (isScrolling) {
                setTimeout(() => {
                    isScrolling = false;
                }, 100);
            }
        }, { passive: true });
    }
}

// モバイル用の追加最適化
function setupMobileOptimizations() {
    document.addEventListener('touchstart', () => {}, { passive: true });
    
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    
    document.body.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1 && window.scrollY === 0) {
            const startY = e.touches[0].clientY;
            
            const handleTouchMove = (moveEvent) => {
                const currentY = moveEvent.touches[0].clientY;
                const diffY = currentY - startY;
                
                if (diffY > 0 && window.scrollY === 0) {
                    moveEvent.preventDefault();
                }
            };
            
            const handleTouchEnd = () => {
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            };
            
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        }
    });
}

// キーボード表示状態の管理
function setupKeyboardHandling() {
    if (!window.visualViewport) return;
    
    const originalHeight = window.innerHeight;
    
    const handleKeyboardChange = () => {
        const currentHeight = window.visualViewport.height;
        const heightDiff = originalHeight - currentHeight;
        const isKeyboardOpen = heightDiff > 150;
        
        document.body.classList.toggle('keyboard-open', isKeyboardOpen);
        
        if (isKeyboardOpen) {
            const messageInput = document.getElementById('message-input');
            if (messageInput && document.activeElement === messageInput) {
                setTimeout(() => {
                    messageInput.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest' 
                    });
                }, 100);
            }
        }
        
        console.log(`⌨️ Keyboard ${isKeyboardOpen ? 'opened' : 'closed'} (height diff: ${heightDiff}px)`);
    };
    
    window.visualViewport.addEventListener('resize', handleKeyboardChange);
}

// キーボード表示時のスタイル追加
function addKeyboardStyles() {
    const keyboardStyles = `
        .keyboard-open .chat-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 1001;
            background-color: rgba(248, 249, 250, 0.98);
            backdrop-filter: blur(10px);
            padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
        }
        
        .keyboard-open .chat-history {
            padding-bottom: 120px;
        }
        
        @media (max-width: 768px) {
            .keyboard-open .chat-container {
                height: calc(var(--vh, 1vh) * 100 - var(--mobile-header-height));
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = keyboardStyles;
    document.head.appendChild(styleSheet);
}

// モバイル最適化の初期化
function initMobileOptimizations() {
    console.log('📱 Initializing mobile optimizations...');
    
    addKeyboardStyles();
    setupViewportFix();
    improveScrollBehavior();
    
    if (window.innerWidth <= 1024) {
        setupMobileOptimizations();
        setupKeyboardHandling();
    }
    
    console.log('✅ Mobile optimizations initialized');
}

// ==========================================
// タッチ操作改善関連の関数群
// ==========================================

// トースト通知の表示
function showToast(message, type = 'info') {
    // 既存のトーストを削除
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // トースト要素の作成
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    
    // スタイルの設定
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0.75rem 1.5rem',
        borderRadius: '25px',
        color: 'white',
        fontWeight: '500',
        fontSize: '0.9rem',
        zIndex: '9999',
        opacity: '0',
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        maxWidth: '80%',
        textAlign: 'center'
    });
    
    // タイプ別の色設定
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#007bff'
    };
    
    toast.style.backgroundColor = colors[type] || colors.info;
    
    // モバイルでの位置調整
    if (window.innerWidth <= 768) {
        toast.style.top = 'calc(var(--mobile-header-height, 60px) + 10px)';
        toast.style.fontSize = '0.85rem';
    }
    
    // DOM に追加
    document.body.appendChild(toast);
    
    // アニメーション
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });
    
    // 自動削除
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 2000);
}

// タッチイベントの改善
function setupImprovedTouchInteractions() {
    console.log('🎯 Setting up improved touch interactions...');
    
    // 1. 削除ボタンの改善されたインタラクション
    setupDeleteButtonInteractions();
    
    // 2. メッセージアクションボタンの改善
    setupMessageActionInteractions();
    
    // 3. スクロール動作の最適化
    setupScrollOptimization();
    
    // 4. ハプティックフィードバック（対応デバイスのみ）
    setupHapticFeedback();
    
    console.log('✅ Touch interactions improved');
}

// 削除ボタンの改善されたインタラクション
function setupDeleteButtonInteractions() {
    // より視認性の高い削除確認
    document.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-item-btn');
        if (deleteBtn && !deleteBtn.disabled) {
            e.stopPropagation();
            
            // ボタンのアニメーション
            deleteBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                deleteBtn.style.transform = '';
            }, 150);
            
            // 改善された確認ダイアログ
            const listItem = deleteBtn.closest('.list-item');
            const itemType = listItem.closest('.channel-list') ? 'チャンネル' : 'スレッド';
            const itemName = listItem.querySelector('.list-item-text').textContent;
            
            // モバイルでは簡潔な確認
            const isMobile = window.innerWidth <= 768;
            const confirmMessage = isMobile ? 
                `${itemType}「${itemName}」を削除しますか？` :
                `${itemType} "${itemName}" を削除しますか？\n\n注意: この${itemType}内のすべてのデータも削除されます。`;
            
            if (confirm(confirmMessage)) {
                // 削除処理を続行
                return;
            } else {
                // キャンセル時のフィードバック
                e.preventDefault();
                return false;
            }
        }
    });
}

// メッセージアクションボタンの改善
function setupMessageActionInteractions() {
    // メッセージアクションの改善されたハンドリング
    document.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.message-actions .icon-btn');
        if (actionBtn) {
            // タップ時のフィードバック
            actionBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                actionBtn.style.transform = '';
            }, 100);
            
            // アクション種別の判定と改善されたフィードバック
            if (actionBtn.classList.contains('copy-btn')) {
                // コピー処理は後でhandleChatHistoryClickで実行される
                console.log('📋 コピーボタンがクリックされました');
            } else if (actionBtn.classList.contains('edit-btn')) {
                showToast('✏️ 編集モードを開いています...', 'info');
            } else if (actionBtn.classList.contains('delete-btn')) {
                // 削除時の確認改善
                const messageWrapper = actionBtn.closest('.message-wrapper');
                const messageId = messageWrapper.dataset.messageId;
                
                if (confirm('このメッセージを削除しますか？')) {
                    showToast('🗑️ メッセージを削除しました', 'warning');
                } else {
                    e.preventDefault();
                    return false;
                }
            } else if (actionBtn.classList.contains('retry-btn')) {
                showToast('🔄 再生成しています...', 'info');
            }
        }
    });
    
    // ダブルタップでの誤操作防止
    let lastTap = 0;
    document.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < 300 && tapLength > 0) {
            // ダブルタップを検出した場合、メッセージアクション以外で発生していれば無効化
            if (!e.target.closest('.message-actions')) {
                e.preventDefault();
            }
        }
        
        lastTap = currentTime;
    });
}

// スクロール動作の最適化
function setupScrollOptimization() {
    const chatHistory = document.getElementById('chat-history');
    const channelList = document.querySelector('.channel-list');
    const threadList = document.querySelector('.thread-list');
    
    // スクロール要素の配列
    const scrollElements = [chatHistory, channelList, threadList].filter(el => el);
    
    scrollElements.forEach(element => {
        // スクロールの慣性を改善
        element.style.webkitOverflowScrolling = 'touch';
        element.style.overscrollBehavior = 'contain';
        
        // スクロール位置の記憶
        const elementId = element.id || element.className;
        
        // スクロール位置の復元
        const savedScrollPosition = sessionStorage.getItem(`scroll-${elementId}`);
        if (savedScrollPosition) {
            element.scrollTop = parseInt(savedScrollPosition, 10);
        }
        
        // スクロール位置の保存（デバウンス付き）
        let scrollTimeout;
        element.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                sessionStorage.setItem(`scroll-${elementId}`, element.scrollTop);
            }, 150);
        }, { passive: true });
        
        // スクロール終了時の処理
        let scrollEndTimeout;
        element.addEventListener('scroll', () => {
            clearTimeout(scrollEndTimeout);
            scrollEndTimeout = setTimeout(() => {
                // スクロール終了時にレイアウトの再調整
                if (element === chatHistory) {
                    optimizeChatHistoryLayout();
                }
            }, 200);
        }, { passive: true });
    });
}

// チャット履歴のレイアウト最適化
function optimizeChatHistoryLayout() {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;
    
    // 画面外のメッセージの処理（パフォーマンス向上）
    const messages = chatHistory.querySelectorAll('.message-turn');
    const chatRect = chatHistory.getBoundingClientRect();
    
    messages.forEach(message => {
        const messageRect = message.getBoundingClientRect();
        const isVisible = (
            messageRect.bottom >= chatRect.top &&
            messageRect.top <= chatRect.bottom
        );
        
        // 画面外のメッセージの描画最適化
        if (!isVisible) {
            message.style.transform = 'translateZ(0)';
            message.style.willChange = 'transform';
        } else {
            message.style.transform = '';
            message.style.willChange = 'auto';
        }
    });
}

// ハプティックフィードバック（対応デバイスのみ）
function setupHapticFeedback() {
    // Vibration API の確認
    if (!('vibrate' in navigator)) {
        console.log('Vibration API not supported');
        return;
    }
    
    // 軽いタップフィードバック
    function lightHaptic() {
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }
    
    // 中程度のフィードバック
    function mediumHaptic() {
        if (navigator.vibrate) {
            navigator.vibrate(25);
        }
    }
    
    // 削除などの重要なアクション用
    function strongHaptic() {
        if (navigator.vibrate) {
            navigator.vibrate([50, 10, 50]);
        }
    }
    
    // 各種操作にハプティックフィードバックを追加
    document.addEventListener('click', (e) => {
        if (e.target.closest('.delete-item-btn, .delete-btn')) {
            strongHaptic();
        } else if (e.target.closest('.message-actions .icon-btn')) {
            mediumHaptic();
        } else if (e.target.closest('.list-item, button, .icon-btn')) {
            lightHaptic();
        }
    });
}

// スクロール位置の自動調整
function setupAutoScrollAdjustment() {
    // 新しいメッセージが追加されたときの自動スクロール改善
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;
    
    // MutationObserver でメッセージの追加を監視
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // 新しいメッセージが追加された
                const addedMessage = Array.from(mutation.addedNodes).find(node => 
                    node.nodeType === 1 && node.classList.contains('message-turn')
                );
                
                if (addedMessage) {
                    // ユーザーが下部にいる場合のみ自動スクロール
                    const isAtBottom = chatHistory.scrollTop >= 
                        chatHistory.scrollHeight - chatHistory.clientHeight - 50;
                    
                    if (isAtBottom) {
                        // 新しいスクロール方式を使用
                        const messageId = addedMessage.querySelector('.message-wrapper')?.dataset.messageId;
                        if (messageId) {
                            setTimeout(() => {
                                // ui.jsの新しいスクロール関数を呼び出し
                                const scrollEvent = new CustomEvent('scrollToNewMessage', {
                                    detail: { messageId: messageId }
                                });
                                window.dispatchEvent(scrollEvent);
                            }, 100);
                        } else {
                            // フォールバック：従来の方式
                            setTimeout(() => {
                                chatHistory.scrollTo({
                                    top: chatHistory.scrollHeight,
                                    behavior: 'smooth'
                                });
                            }, 100);
                        }
                    } else {
                        // 下部にいない場合は新着メッセージのインジケーターを表示
                        showNewMessageIndicator();
                    }
                }
            }
        });
    });
    
    observer.observe(chatHistory, {
        childList: true,
        subtree: true
    });
}

// 新着メッセージインジケーター
function showNewMessageIndicator() {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;
    
    // 既存のインジケーターがあれば削除
    const existingIndicator = chatHistory.querySelector('.new-message-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // インジケーターを作成
    const indicator = document.createElement('button');
    indicator.className = 'new-message-indicator';
    indicator.innerHTML = '↓ 新しいメッセージ';
    
    Object.assign(indicator.style, {
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0.5rem 1rem',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        border: 'none',
        borderRadius: '20px',
        fontSize: '0.8rem',
        cursor: 'pointer',
        zIndex: '100',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease'
    });
    
    // クリックで下部にスクロール
    indicator.addEventListener('click', () => {
        chatHistory.scrollTo({
            top: chatHistory.scrollHeight,
            behavior: 'smooth'
        });
        indicator.remove();
    });
    
    // チャット履歴に追加
    chatHistory.style.position = 'relative';
    chatHistory.appendChild(indicator);
    
    // 5秒後に自動削除
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 300);
        }
    }, 5000);
}

// パフォーマンス監視
function setupPerformanceMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();
    
    function measureFPS() {
        frameCount++;
        const currentTime = performance.now();
        
        if (currentTime >= lastTime + 1000) {
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            
            // 低FPSの場合は最適化を実行
            if (fps < 30) {
                console.warn(`🐌 Low FPS detected: ${fps}fps, applying optimizations`);
                applyPerformanceOptimizations();
            }
            
            frameCount = 0;
            lastTime = currentTime;
        }
        
        requestAnimationFrame(measureFPS);
    }
    
    // パフォーマンス監視開始
    if (window.innerWidth <= 768) {
        requestAnimationFrame(measureFPS);
    }
}

// パフォーマンス最適化の適用
function applyPerformanceOptimizations() {
    document.body.classList.add('performance-mode');
    
    // アニメーション無効化
    const style = document.createElement('style');
    style.textContent = `
        .performance-mode * {
            animation-duration: 0s !important;
            transition-duration: 0s !important;
        }
        .performance-mode .sidebar,
        .performance-mode .settings-panel,
        .performance-mode .chat-container {
            backdrop-filter: none !important;
        }
    `;
    document.head.appendChild(style);
    
    console.log('🚀 Performance optimizations applied');
}

// タッチ操作改善の初期化
function initImprovedTouchInteractions() {
    console.log('🎯 Initializing improved touch interactions...');
    
    setupImprovedTouchInteractions();
    setupAutoScrollAdjustment();
    setupPerformanceMonitoring();
    
    console.log('✅ Improved touch interactions initialized');
}

// ==========================================
// PWA関連の関数群
// ==========================================

// PWA サービスワーカーの登録
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            console.log('🔧 Registering service worker...');
            
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            
            console.log('✅ Service Worker registered successfully:', registration.scope);
            
            registration.addEventListener('updatefound', () => {
                console.log('🔄 Service Worker update found');
                const newWorker = registration.installing;
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('📱 New version available');
                        showUpdateNotification();
                    }
                });
            });
            
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    } else {
        console.warn('⚠️ Service Worker not supported in this browser');
    }
}

// アップデート通知表示
function showUpdateNotification() {
    try {
        if (window.innerWidth <= 1024) {
            const updatePrompt = confirm(
                'アプリの新しいバージョンが利用可能です。\n今すぐ更新しますか？'
            );
            
            if (updatePrompt) {
                window.location.reload();
            }
        } else {
            if (typeof showNetworkStatus === 'function') {
                showNetworkStatus('新しいバージョンが利用可能です。ページを再読み込みしてください。', false);
            }
        }
    } catch (error) {
        console.error('Update notification error:', error);
    }
}

// PWA インストール プロンプト
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 PWA install prompt triggered');
    
    try {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    } catch (error) {
        console.error('Install prompt error:', error);
    }
});

function showInstallButton() {
    try {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !document.getElementById('install-app-btn')) {
            const installSection = document.createElement('div');
            installSection.className = 'mobile-connection-section';
            installSection.innerHTML = `
                <div class="connection-info">
                    <button id="install-app-btn" class="mobile-setup-btn">
                        📱 アプリをインストール
                    </button>
                </div>
            `;
            
            const sidebarFooter = sidebar.querySelector('.sidebar-footer');
            if (sidebarFooter) {
                sidebar.insertBefore(installSection, sidebarFooter);
                document.getElementById('install-app-btn').addEventListener('click', installApp);
            }
        }
    } catch (error) {
        console.error('Install button error:', error);
    }
}

async function installApp() {
    if (deferredPrompt) {
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`🎯 PWA install outcome: ${outcome}`);
            
            if (outcome === 'accepted' && typeof showNetworkStatus === 'function') {
                showNetworkStatus('アプリがインストールされました！', false);
            }
            
            deferredPrompt = null;
            
            const installBtn = document.getElementById('install-app-btn');
            if (installBtn) {
                installBtn.parentElement.parentElement.remove();
            }
        } catch (error) {
            console.error('Install app error:', error);
        }
    }
}

window.addEventListener('appinstalled', (evt) => {
    console.log('🎉 PWA was installed');
    try {
        if (typeof showNetworkStatus === 'function') {
            showNetworkStatus('アプリがホーム画面に追加されました！', false);
        }
        
        const installBtn = document.getElementById('install-app-btn');
        if (installBtn) {
            installBtn.parentElement.parentElement.remove();
        }
    } catch (error) {
        console.error('App installed handler error:', error);
    }
});

// ==========================================
// ネットワーク関連の関数群
// ==========================================

function showNetworkStatus(message, isError = false) {
    if (UIElements.networkStatus) {
        UIElements.networkStatus.textContent = message;
        UIElements.networkStatus.className = `network-status ${isError ? '' : 'connected'}`;
        UIElements.networkStatus.style.display = 'flex';
        
        if (!isError) {
            setTimeout(() => {
                UIElements.networkStatus.style.display = 'none';
            }, 3000);
        }
    }
}

function hideNetworkStatus() {
    if (UIElements.networkStatus) {
        UIElements.networkStatus.style.display = 'none';
    }
}

async function testConnection() {
    if (UIElements.testConnectionBtn) {
        UIElements.testConnectionBtn.disabled = true;
        UIElements.testConnectionBtn.textContent = 'テスト中...';
        UIElements.testConnectionBtn.className = 'test-connection-btn';
    }
    
    try {
        const isConnected = await window.testApiConnection();
        
        if (UIElements.testConnectionBtn) {
            if (isConnected && isConnected.success) {
                UIElements.testConnectionBtn.textContent = '接続成功';
                UIElements.testConnectionBtn.className = 'test-connection-btn success';
                showNetworkStatus('API接続成功', false);
            } else {
                UIElements.testConnectionBtn.textContent = '接続失敗';
                UIElements.testConnectionBtn.className = 'test-connection-btn error';
                showNetworkStatus('API接続失敗 - 設定を確認してください', true);
            }
        }
        
        if (UIElements.connectionStatus) {
            UIElements.connectionStatus.textContent = (isConnected && isConnected.success) ? 
                '✅ API接続成功' : '❌ API接続失敗';
            UIElements.connectionStatus.className = (isConnected && isConnected.success) ? 'success' : 'error';
        }
        
        return isConnected && isConnected.success;
    } catch (error) {
        console.error('接続テストエラー:', error);
        
        if (UIElements.testConnectionBtn) {
            UIElements.testConnectionBtn.textContent = 'エラー';
            UIElements.testConnectionBtn.className = 'test-connection-btn error';
        }
        
        if (UIElements.connectionStatus) {
            UIElements.connectionStatus.textContent = `❌ エラー: ${error.message}`;
            UIElements.connectionStatus.className = 'error';
        }
        
        showNetworkStatus('接続テストでエラーが発生しました', true);
        return false;
    } finally {
        setTimeout(() => {
            if (UIElements.testConnectionBtn) {
                UIElements.testConnectionBtn.disabled = false;
                UIElements.testConnectionBtn.textContent = '接続テスト';
                UIElements.testConnectionBtn.className = 'test-connection-btn';
            }
        }, 2000);
    }
}

function updateCurrentApiUrl() {
    if (UIElements.currentApiUrl && window.getCurrentApiUrl) {
        const currentUrl = window.getCurrentApiUrl();
        UIElements.currentApiUrl.textContent = `API URL: ${currentUrl}`;
    }
}

function openNetworkSetupModal() {
    if (UIElements.networkSetupModal) {
        UIElements.networkSetupModal.style.display = 'flex';
        
        if (UIElements.customApiUrl) {
            const currentUrl = localStorage.getItem('custom-api-url') || '';
            UIElements.customApiUrl.value = currentUrl;
        }
        
        testConnection();
    }
}

function closeNetworkSetupModal() {
    if (UIElements.networkSetupModal) {
        UIElements.networkSetupModal.style.display = 'none';
    }
}

function saveNetworkSettings() {
    if (UIElements.customApiUrl && window.setCustomApiUrl) {
        const newUrl = UIElements.customApiUrl.value.trim();
        
        if (newUrl) {
            window.setCustomApiUrl(newUrl);
            updateCurrentApiUrl();
            showNetworkStatus('API URL設定を保存しました。ページを再読み込みしてください。', false);
            
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } else {
            alert('有効なAPI URLを入力してください');
        }
    }
}

function resetNetworkSettings() {
    localStorage.removeItem('custom-api-url');
    updateCurrentApiUrl();
    showNetworkStatus('API URL設定をリセットしました。ページを再読み込みしてください。', false);
    
    if (UIElements.customApiUrl) {
        UIElements.customApiUrl.value = '';
    }
    
    setTimeout(() => {
        window.location.reload();
    }, 3000);
}

function startConnectionCheck() {
    if (window.innerWidth <= 1024) {
        connectionCheckInterval = setInterval(async () => {
            try {
                if (window.testApiConnection) {
                    const isConnected = await window.testApiConnection();
                    if (!isConnected || !isConnected.success) {
                        showNetworkStatus('API接続が失われました', true);
                    }
                }
            } catch (error) {
                console.error('定期接続チェックエラー:', error);
            }
        }, 30000);
    }
}

function stopConnectionCheck() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
    }
}

// ==========================================
// モバイルUI関連の関数群
// ==========================================

function openMobileSidebar() {
    UIElements.sidebar.classList.add('mobile-open');
    UIElements.mobileOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    UIElements.sidebar.classList.remove('mobile-open');
    UIElements.mobileOverlay.classList.remove('show');
    document.body.style.overflow = '';
}

function toggleMobileSidebar() {
    if (UIElements.sidebar.classList.contains('mobile-open')) {
        closeMobileSidebar();
    } else {
        openMobileSidebar();
    }
}

function openMobileSettings() {
    UIElements.settingsPanel.classList.add('mobile-open');
    UIElements.mobileOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeMobileSettings() {
    UIElements.settingsPanel.classList.remove('mobile-open');
    UIElements.mobileOverlay.classList.remove('show');
    document.body.style.overflow = '';
}

function toggleMobileSettings() {
    if (UIElements.settingsPanel.classList.contains('mobile-open')) {
        closeMobileSettings();
    } else {
        openMobileSettings();
    }
}

function updateMobileHeader() {
    const currentChannel = state.getCurrentChannel();
    const currentThread = state.getCurrentThread();
    
    if (UIElements.mobileCurrentChannel && UIElements.mobileCurrentThread) {
        UIElements.mobileCurrentChannel.textContent = currentChannel ? currentChannel.name : 'チャンネル';
        UIElements.mobileCurrentThread.textContent = currentThread ? currentThread.name : 'スレッド';
    }
}

// ==========================================
// 既存のアプリケーション関数群
// ==========================================

async function loadAvailableModels() {
    try {
        console.log('モデル一覧の読み込みを開始...');
        
        if (typeof fetchAvailableModels !== 'function') {
            console.error('fetchAvailableModels function not available');
            state.setAvailableModels([]);
            updateModelSelectOptions();
            return;
        }
        
        const models = await fetchAvailableModels();
        state.setAvailableModels(models);
        updateModelSelectOptions();
        
        // デフォルト設定のモデル選択肢を安全に更新
        try {
            updateDefaultModelSelectOptions();
        } catch (error) {
            console.warn('Default model select options update failed:', error);
        }
        
        console.log('モデル一覧の読み込み完了:', models.length, '個のモデル');
    } catch (error) {
        console.error('モデル一覧の読み込みに失敗:', error);
        if (window.innerWidth <= 1024) {
            showNetworkStatus('モデル一覧の読み込みに失敗しました', true);
        }
        state.setAvailableModels([]);
        updateModelSelectOptions();
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.innerHTML = '<option value="">モデル読み込みエラー</option>';
        }
    }
}

function renderApp() {
    console.log('🔄 renderApp() called');
    const appState = state.getState();
    const currentChannel = state.getCurrentChannel();
    const currentThread = state.getCurrentThread();
    
    if (currentThread) {
        console.log('📋 Current thread history:', currentThread.history.map(m => ({
            id: m.id,
            role: m.role,
            partsCount: m.parts.length,
            firstPartText: m.parts[0]?.text?.substring(0, 50) + '...'
        })));
    }
    
    ui.renderChannels(state.getChannels(), appState.currentChannelId);
    ui.renderThreads(currentChannel, appState.currentThreadId);
    ui.renderChatHistory(currentThread, currentChannel);
    setConfigToUI(currentChannel);
    setThreadConfigToUI(currentThread);
    ui.updateUiSettingsOnPage(appState.globalUiSettings);
    ui.updateUiSettingsPanel(appState.globalUiSettings, currentChannel, currentThread);
    
    // チャンネル共有ファイルのUI更新
    updateChannelSharedFilesUI();
    
    // スレッドのチャンネルファイル使用設定を更新
    if (UIElements.useChannelFilesToggle) {
        UIElements.useChannelFilesToggle.checked = state.getThreadUseChannelFiles();
    }
    
    updateMobileHeader();
    updateCurrentApiUrl();
    
    if (!state.areModelsLoaded()) {
        loadAvailableModels();
    } else {
        updateModelSelectOptions();
        
        // デフォルト設定のモデル選択肢を安全に更新
        try {
            updateDefaultModelSelectOptions();
        } catch (error) {
            console.warn('Default model select options update failed in renderApp:', error);
        }
    }
}

function setupEventListeners() {
    UIElements.chatForm.addEventListener('submit', handleFormSubmit);
    UIElements.newChannelBtn.addEventListener('click', () => { state.addChannel(); renderApp(); });
    UIElements.newThreadBtn.addEventListener('click', () => { state.addThread(); renderApp(); });
    UIElements.channelList.addEventListener('click', handleChannelListClick);
    UIElements.threadList.addEventListener('click', handleThreadListClick);
    UIElements.messageInput.addEventListener('input', () => { UIElements.messageInput.style.height = 'auto'; UIElements.messageInput.style.height = `${UIElements.messageInput.scrollHeight}px`; });
    document.addEventListener('configChanged', () => { renderApp(); });
    UIElements.threadNameInput.addEventListener('change', (e) => { state.updateCurrentThreadName(e.target.value); renderApp(); });
    UIElements.chatHistory.addEventListener('click', handleChatHistoryClick);
    UIElements.searchIcon.addEventListener('click', () => ui.toggleSearchModal(true));
    UIElements.searchModalCloseBtn.addEventListener('click', () => ui.toggleSearchModal(false));
    UIElements.searchModalButton.addEventListener('click', executeSearch);
    UIElements.searchModalInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') executeSearch(); });
    UIElements.searchResultsContainer.addEventListener('click', handleSearchResultClick);
    UIElements.editModalCloseBtn.addEventListener('click', () => ui.toggleEditModal(false));
    UIElements.editModalCancelBtn.addEventListener('click', () => ui.toggleEditModal(false));
    UIElements.editModalSaveBtn.addEventListener('click', handleEditSave);
    UIElements.exportBtn.addEventListener('click', handleExport);
    UIElements.importBtn.addEventListener('click', () => UIElements.importFileInput.click());
    UIElements.importFileInput.addEventListener('change', handleImport);
    UIElements.bgImageInput.addEventListener('change', (e) => handleImageUpload(e, 'global', 'backgroundImage'));
    UIElements.clearBgImageBtn.addEventListener('click', () => handleImageClear('global', 'backgroundImage'));
    UIElements.channelUserIconInput.addEventListener('change', (e) => handleImageUpload(e, 'channel', 'userIcon'));
    UIElements.clearChannelUserIconBtn.addEventListener('click', () => handleImageClear('channel', 'userIcon'));
    UIElements.channelModelIconInput.addEventListener('change', (e) => handleImageUpload(e, 'channel', 'modelIcon'));
    UIElements.clearChannelModelIconBtn.addEventListener('click', () => handleImageClear('channel', 'modelIcon'));
    UIElements.overrideThreadIconsToggle.addEventListener('change', (e) => { state.setThreadIconOverride(e.target.checked); renderApp(); });
    UIElements.threadUserIconInput.addEventListener('change', (e) => handleImageUpload(e, 'thread', 'userIcon'));
    UIElements.clearThreadUserIconBtn.addEventListener('click', () => handleImageClear('thread', 'userIcon'));
    UIElements.threadModelIconInput.addEventListener('change', (e) => handleImageUpload(e, 'thread', 'modelIcon'));
    UIElements.clearThreadModelIconBtn.addEventListener('click', () => handleImageClear('thread', 'modelIcon'));
    UIElements.attachFileBtn.addEventListener('click', () => UIElements.attachFileInput.click());
    UIElements.attachFileInput.addEventListener('change', handleFileSelect);
    UIElements.fileAttachmentsContainer.addEventListener('click', handleRemoveFile);
    
    // チャンネル共有ファイル関連のイベントリスナー
    if (UIElements.channelFileUploadBtn) {
        UIElements.channelFileUploadBtn.addEventListener('click', () => UIElements.channelFileInput.click());
    }
    if (UIElements.channelFileInput) {
        UIElements.channelFileInput.addEventListener('change', handleChannelFileUpload);
    }
    if (UIElements.channelSharedFilesList) {
        UIElements.channelSharedFilesList.addEventListener('click', handleChannelSharedFilesClick);
    }
    if (UIElements.useChannelFilesToggle) {
        UIElements.useChannelFilesToggle.addEventListener('change', handleUseChannelFilesToggle);
    }
    
    // モバイル用イベントリスナー
    if (UIElements.mobileMenuBtn) {
        UIElements.mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
    }
    
    if (UIElements.mobileSettingsBtn) {
        UIElements.mobileSettingsBtn.addEventListener('click', toggleMobileSettings);
    }
    
    if (UIElements.sidebarCloseBtn) {
        UIElements.sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
    }
    
    if (UIElements.settingsCloseBtn) {
        UIElements.settingsCloseBtn.addEventListener('click', closeMobileSettings);
    }
    
    if (UIElements.mobileOverlay) {
        UIElements.mobileOverlay.addEventListener('click', () => {
            closeMobileSidebar();
            closeMobileSettings();
            closeNetworkSetupModal();
        });
    }
    
    // ネットワーク関連イベントリスナー
    if (UIElements.testConnectionBtn) {
        UIElements.testConnectionBtn.addEventListener('click', testConnection);
    }
    
    if (UIElements.mobileNetworkSetupBtn) {
        UIElements.mobileNetworkSetupBtn.addEventListener('click', openNetworkSetupModal);
    }
    
    if (UIElements.networkSetupCloseBtn) {
        UIElements.networkSetupCloseBtn.addEventListener('click', closeNetworkSetupModal);
    }
    
    if (UIElements.saveNetworkSettingsBtn) {
        UIElements.saveNetworkSettingsBtn.addEventListener('click', saveNetworkSettings);
    }
    
    if (UIElements.resetNetworkSettingsBtn) {
        UIElements.resetNetworkSettingsBtn.addEventListener('click', resetNetworkSettings);
    }
    
    // スレッドを選択した際にモバイルサイドバーを閉じる（チャンネル選択時は閉じない）
    UIElements.threadList.addEventListener('click', (e) => {
        if (e.target.closest('.list-item') && !e.target.closest('.delete-item-btn')) {
            if (window.innerWidth <= 1024) {
                closeMobileSidebar();
            }
        }
    });
    
    // モデル更新のイベントリスナー
    document.addEventListener('refreshModels', async () => {
        await loadAvailableModels();
        renderApp();
    });
    
    // ウィンドウリサイズ時の処理
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeMobileSidebar();
            closeMobileSettings();
            stopConnectionCheck();
            hideNetworkStatus();
        } else {
            startConnectionCheck();
        }
    });
    
    // オンライン/オフライン状態の監視
    window.addEventListener('online', () => {
        showNetworkStatus('インターネット接続が復旧しました', false);
        hideNetworkStatus();
    });
    
    window.addEventListener('offline', () => {
        showNetworkStatus('インターネット接続が失われました', true);
    });
    
    // ページの可視性変更を監視（モバイルでのアプリ切り替え対応）
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && window.innerWidth <= 1024) {
            setTimeout(() => {
                if (typeof testConnection === 'function') {
                    testConnection().catch(error => {
                        console.warn('Visibility change connection test failed:', error);
                    });
                }
            }, 1000);
        }
    });
}

async function handleFormSubmit(event) {
    event.preventDefault(); 
    if (isSending) return;
    
    console.log('📤 Form submitted');
    const userMessageText = UIElements.messageInput.value.trim();
    if (userMessageText === '' && attachedFiles.length === 0) return;
    
    const currentChannel = state.getCurrentChannel(); 
    const currentThread = state.getCurrentThread(); 
    if (!currentChannel || !currentThread) return;
    
    // モバイルの場合、送信前に接続をチェック
    if (window.innerWidth <= 1024) {
        const isConnected = await testConnection();
        if (!isConnected) {
            showNetworkStatus('API接続を確認してください', true);
            return;
        }
    }
    
    isSending = true; 
    ui.setLoading(true);

    const userParts = [];
    if (userMessageText) { userParts.push({ text: userMessageText }); }
    attachedFiles.forEach(file => { userParts.push({ file: { data: file.base64, mime_type: file.type, name: file.name } }); });
    
    console.log('➕ Adding user message to thread');
    state.addMessageToCurrentThread('user', userParts);
    renderApp();
    ui.clearInput();
    
    // ファイルを統合：スレッド個別ファイル + チャンネル共有ファイル（設定に応じて）
    const filesForApi = [...attachedFiles];
    
    // チャンネル共有ファイルの参照が有効な場合は追加
    if (state.getThreadUseChannelFiles()) {
        const sharedFiles = state.getChannelSharedFiles();
        sharedFiles.forEach(sharedFile => {
            filesForApi.push({
                name: sharedFile.name,
                type: sharedFile.type,
                base64: sharedFile.base64
            });
        });
        
        if (sharedFiles.length > 0) {
            console.log(`📁 ${sharedFiles.length}個のチャンネル共有ファイルを追加しました`);
        }
    }
    
    console.log(`📎 合計${filesForApi.length}個のファイルをAPIに送信します`);
    clearAttachments();
    
    const historyForAPI = currentThread.history.slice(0, -1).map(msg => ({ role: msg.role, parts: msg.parts.map(p => p.file ? { inline_data: { mime_type: p.file.mime_type, data: p.file.data } } : { text: p.text }) }));
    const requestPayload = { 
        history: historyForAPI, 
        message: userMessageText, 
        files: filesForApi, 
        config: currentChannel.config,
        selectedModel: currentChannel.config.selectedModel,
        systemPrompt: state.getEffectiveSystemPrompt()
    };
    handleApiResponse(requestPayload);
}

function handleApiResponse(payload, existingMessageId = null) {
    console.log('🚀 Starting API response handling', { existingMessageId, selectedModel: payload.selectedModel });
    
    let systemPromptPreview = 'デフォルト';
    if (payload.systemPrompt && typeof payload.systemPrompt === 'string') {
        systemPromptPreview = payload.systemPrompt.substring(0, 50) + '...';
    } else if (payload.systemPrompt) {
        systemPromptPreview = 'オブジェクト形式';
    }
    console.log('システムプロンプト:', systemPromptPreview);
    
    let fullReply = '';
    let messageToUpdateId = existingMessageId;

    if (!existingMessageId) {
        console.log('➕ Creating empty model message');
        const tempMessage = state.addMessageToCurrentThread('model', [{ text: '' }]);
        messageToUpdateId = tempMessage.id;
        console.log('🆔 Created message with ID:', messageToUpdateId);
        renderApp();
    }
    
    const apiRequest = {
        history: payload.history,
        message: payload.message,
        files: payload.files.map(f => ({ mime_type: f.type, data: f.base64 })),
        stream: payload.config.stream,
        generationConfig: payload.config.generationConfig,
        useWebSearch: payload.config.useWebSearch,
        dummyUserPrompt: payload.config.dummyUserPrompt,
        dummyModelPrompt: payload.config.dummyModelPrompt,
        selectedModel: payload.selectedModel,
        systemPrompt: payload.systemPrompt
    };
    
    console.log('📡 API Request:', { 
        historyLength: apiRequest.history.length,
        messageLength: apiRequest.message.length,
        filesCount: apiRequest.files.length,
        selectedModel: apiRequest.selectedModel,
        systemPrompt: systemPromptPreview,
        stream: apiRequest.stream 
    });
    
    sendMessage(apiRequest, {
        onChunk: (chunk) => {
            console.log('📦 Chunk received:', chunk.length, 'chars');
            fullReply += chunk;
            if (payload.config.stream) {
                ui.setLoading(false);
                console.log('🔄 Updating state and DOM, total length:', fullReply.length);
                state.updateMessage(messageToUpdateId, fullReply);
                ui.updateStreamingMessage(messageToUpdateId, fullReply);
            }
        },
        onComplete: () => {
            console.log('✅ API call completed, fullReply length:', fullReply.length);
            console.log('🔍 DEBUG: Checking existingMessageId:', existingMessageId);
            console.log('🔍 DEBUG: messageToUpdateId:', messageToUpdateId);
            console.log('🔍 DEBUG: stream setting:', payload.config.stream);
            
            if (existingMessageId) {
                console.log('🔁 Adding alternative part');
                state.addAlternativePart(existingMessageId, fullReply);
            } else {
                if (!payload.config.stream) {
                    console.log('🔄 Non-streaming: updating message');
                    state.updateMessage(messageToUpdateId, fullReply);
                } else {
                    console.log('🌊 Streaming: message already updated');
                }
            }
            console.log('🎨 Final renderApp()');
            renderApp();
            
            ui.setLoading(false);
            isSending = false;
            
            // 🔥 重要：ストリーミング設定に関係なく、すべてのケースでスクロール処理を実行
            if (messageToUpdateId) {
                console.log('🔄 Starting universal scroll process for messageId:', messageToUpdateId);
                setTimeout(() => {
                    console.log('🔍 DEBUG: Finding message wrapper for:', messageToUpdateId);
                    const messageWrapper = document.querySelector(`.message-wrapper[data-message-id="${messageToUpdateId}"]`);
                    console.log('🔍 DEBUG: Message wrapper found:', !!messageWrapper);
                    
                    if (messageWrapper) {
                        const messageTurn = messageWrapper.closest('.message-turn');
                        console.log('🔍 DEBUG: Message turn found:', !!messageTurn);
                        
                        if (messageTurn) {
                            const isModelMessage = messageTurn.classList.contains('model-message-turn');
                            console.log('🔍 DEBUG: Is model message:', isModelMessage);
                            
                            if (isModelMessage) {
                                console.log('🎯 AI message detected, executing scroll');
                                
                                const chatHistory = document.getElementById('chat-history');
                                console.log('🔍 DEBUG: Chat history found:', !!chatHistory);
                                
                                if (chatHistory && messageTurn) {
                                    const chatHistoryTop = chatHistory.offsetTop;
                                    const messageTurnTop = messageTurn.offsetTop;
                                    let targetScrollTop = messageTurnTop - chatHistoryTop;
                                    
                                    // モバイルヘッダーの高さを考慮
                                    if (window.innerWidth <= 1024) {
                                        const mobileHeader = document.querySelector('.mobile-header');
                                        if (mobileHeader) {
                                            targetScrollTop -= mobileHeader.offsetHeight;
                                            console.log('📱 Mobile header height:', mobileHeader.offsetHeight);
                                        }
                                    }
                                    
                                    targetScrollTop = Math.max(0, targetScrollTop - 20);
                                    
                                    console.log('📊 Universal scroll calculation:', {
                                        chatHistoryTop,
                                        messageTurnTop,
                                        targetScrollTop,
                                        currentScroll: chatHistory.scrollTop,
                                        isMobile: window.innerWidth <= 768
                                    });
                                    
                                    chatHistory.scrollTo({
                                        top: targetScrollTop,
                                        behavior: window.innerWidth <= 768 ? 'auto' : 'smooth'
                                    });
                                    
                                    // モバイルの場合、確認を行う
                                    if (window.innerWidth <= 768) {
                                        setTimeout(() => {
                                            const actualScroll = chatHistory.scrollTop;
                                            console.log('📱 Scroll verification:', {
                                                targetScrollTop,
                                                actualScrollTop: actualScroll,
                                                difference: Math.abs(targetScrollTop - actualScroll)
                                            });
                                            
                                            if (Math.abs(targetScrollTop - actualScroll) > 50) {
                                                console.log('📱 Retrying scroll');
                                                chatHistory.scrollTop = targetScrollTop;
                                            }
                                        }, 500);
                                    }
                                } else {
                                    console.log('❌ Chat history or message turn not found');
                                }
                            } else {
                                console.log('👤 User message, scrolling to bottom');
                                const chatHistory = document.getElementById('chat-history');
                                if (chatHistory) {
                                    chatHistory.scrollTop = chatHistory.scrollHeight;
                                }
                            }
                        } else {
                            console.log('❌ Message turn not found');
                        }
                    } else {
                        console.log('❌ Message wrapper not found');
                    }
                }, 200);
            }
            
            // モバイルの場合、成功を表示
            if (window.innerWidth <= 1024) {
                showNetworkStatus('メッセージ送信完了', false);
            }
        },
        onError: (errorMessage) => {
            console.error('❌ API Error:', errorMessage);
            if (!existingMessageId) {
                state.deleteMessage(messageToUpdateId);
            }
            renderApp();
            ui.setLoading(false);
            isSending = false;
            
            // モバイルの場合、エラーを表示
            if (window.innerWidth <= 1024) {
                showNetworkStatus('メッセージ送信エラー', true);
            }
        }
    });
}

// チャンネル関連のハンドラー関数
function handleChannelListClick(event) {
    const deleteBtn = event.target.closest('.delete-item-btn');
    const listItem = event.target.closest('.list-item');
    
    if (deleteBtn && !deleteBtn.disabled) {
        event.stopPropagation();
        const channelId = listItem.dataset.channelId;
        const channel = state.getChannels().find(c => c.id === channelId);
        
        if (channel && confirm(`チャンネル "${channel.name}" を削除しますか？\n\n注意: このチャンネル内のすべてのスレッドも削除されます。`)) {
            const success = state.deleteChannel(channelId);
            if (success) {
                renderApp();
            } else {
                alert('最後のチャンネルは削除できません。');
            }
        }
    } else if (listItem?.dataset.channelId) {
        state.selectChannel(listItem.dataset.channelId);
        renderApp();
    }
}

function handleThreadListClick(event) {
    const deleteBtn = event.target.closest('.delete-item-btn');
    const listItem = event.target.closest('.list-item');
    
    if (deleteBtn && !deleteBtn.disabled) {
        event.stopPropagation();
        const threadId = listItem.dataset.threadId;
        const currentChannel = state.getCurrentChannel();
        const thread = currentChannel?.threads.find(t => t.id === threadId);
        
        if (thread && confirm(`スレッド "${thread.name}" を削除しますか？\n\n注意: このスレッド内のすべてのメッセージも削除されます。`)) {
            const success = state.deleteThread(threadId);
            if (success) {
                renderApp();
            } else {
                alert('最後のスレッドは削除できません。');
            }
        }
    } else if (listItem?.dataset.threadId) {
        state.selectThread(listItem.dataset.threadId);
        renderApp();
    }
}

function handleFileSelect(event) { const files = Array.from(event.target.files); files.forEach(file => { const reader = new FileReader(); reader.onload = (e) => { const base64 = e.target.result.split(',')[1]; attachedFiles.push({ name: file.name, type: file.type, base64: base64 }); ui.renderFilePreviews(attachedFiles); }; reader.readAsDataURL(file); }); event.target.value = ''; }
function handleRemoveFile(event) { if (event.target.classList.contains('remove-file-btn')) { const item = event.target.closest('.file-preview-item'); const index = parseInt(item.dataset.fileIndex, 10); attachedFiles.splice(index, 1); ui.renderFilePreviews(attachedFiles); } }
function clearAttachments() { attachedFiles = []; ui.renderFilePreviews(attachedFiles); }

// チャンネル共有ファイル関連の処理関数
function handleChannelFileUpload(event) {
    const files = Array.from(event.target.files);
    files.forEach(file => {
        // ファイルサイズ制限チェック（例：5MB）
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            showToast(`⚠️ ファイル「${file.name}」は5MBを超えているためアップロードできません。`, 'warning');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1];
            const fileData = {
                name: file.name,
                type: file.type,
                base64: base64,
                size: file.size
            };
            
            // チャンネル共有ファイルとして追加
            state.addChannelSharedFile(fileData);
            
            // UI更新
            updateChannelSharedFilesUI();
            
            showToast(`📎 「${file.name}」をチャンネル共有ファイルに追加しました`, 'success');
        };
        reader.readAsDataURL(file);
    });
    
    // ファイル入力をクリア
    event.target.value = '';
}

function handleChannelSharedFilesClick(event) {
    if (event.target.classList.contains('remove-shared-file-btn') || 
        event.target.closest('.remove-shared-file-btn')) {
        
        const fileItem = event.target.closest('.shared-file-item');
        if (fileItem) {
            const fileId = fileItem.dataset.fileId;
            const fileName = fileItem.querySelector('.shared-file-name').textContent;
            
            if (confirm(`「${fileName}」を共有ファイルから削除しますか？`)) {
                state.removeChannelSharedFile(fileId);
                updateChannelSharedFilesUI();
                showToast(`🗑️ 「${fileName}」を削除しました`, 'info');
            }
        }
    }
}

function handleUseChannelFilesToggle() {
    const enabled = UIElements.useChannelFilesToggle.checked;
    state.setThreadUseChannelFiles(enabled);
    
    const statusText = enabled ? '有効' : '無効';
    showToast(`📁 チャンネル共有ファイルの参照を${statusText}にしました`, 'info');
}

function updateChannelSharedFilesUI() {
    const sharedFiles = state.getChannelSharedFiles();
    ui.renderChannelSharedFiles(sharedFiles);
}

// ★ コピー機能を改善したhandleChatHistoryClick
function handleChatHistoryClick(event) { 
    const target = event.target; 
    const wrapper = target.closest('.message-wrapper');
    
    // メッセージアクションボタンがクリックされた場合の処理
    if (target.closest('.message-actions .icon-btn')) {
        if (!wrapper) return;
        
        const messageId = wrapper.dataset.messageId; 
        const thread = state.getCurrentThread(); 
        const message = thread.history.find(m => m.id === messageId); 
        if (!message) return; 
        
        const textContent = message.parts.filter(p=>p.text).map(p => p.text).join("\n\n"); 
        
        if (target.classList.contains('delete-btn')) { 
            if (confirm('このメッセージを削除しますか？')) { 
                state.deleteMessage(messageId); 
                renderApp(); 
            } 
        } else if (target.classList.contains('copy-btn') && textContent) { 
            copyToClipboard(textContent);
        } else if (target.classList.contains('edit-btn') && textContent) { 
            editingMessageId = messageId; 
            ui.toggleEditModal(true, textContent); 
        } else if (target.classList.contains('retry-btn')) { 
            handleRetry(messageId); 
        }
        
        return; // アクションボタンが処理された場合は他の処理を実行しない
    }
    
    // retry-controls の処理
    if (target.closest('.retry-controls')) {
        if (!wrapper) return;
        const messageId = wrapper.dataset.messageId; 
        const thread = state.getCurrentThread(); 
        const message = thread.history.find(m => m.id === messageId); 
        if (!message) return; 
        
        const index = message.activePartIndex; 
        if (target.closest('.retry-prev-btn')) { 
            state.setActivePartIndex(messageId, index - 1); 
            renderApp(); 
        } else if (target.closest('.retry-next-btn')) { 
            state.setActivePartIndex(messageId, index + 1); 
            renderApp(); 
        }
        return;
    }
    
    // メッセージ本体がクリックされた場合、アクションボタンを表示/非表示
    if (wrapper && !target.closest('.message-actions') && !target.closest('.retry-controls')) {
        toggleMessageActions(wrapper);
    }
}

function handleEditSave() { if (editingMessageId) { const newText = document.getElementById('edit-modal-textarea').value; state.updateMessage(editingMessageId, newText); ui.toggleEditModal(false); renderApp(); editingMessageId = null; } }
function handleRetry(messageId) { 
    if (isSending) return; 
    const thread = state.getCurrentThread(); 
    const message = thread.history.find(m => m.id === messageId);
    if (!message) return;
    
    if (message.role === 'user') {
        // ユーザーメッセージのリトライ：直後のAIの回答を削除してから再送信
        const messageIndex = thread.history.findIndex(m => m.id === messageId);
        
        // 直後のAIメッセージを見つけて削除
        if (messageIndex < thread.history.length - 1) {
            const nextMessage = thread.history[messageIndex + 1];
            if (nextMessage && nextMessage.role === 'model') {
                state.deleteMessage(nextMessage.id);
            }
        }
        
        const textContent = message.parts.filter(p => p.text).map(p => p.text).join("\n\n");
        const files = message.parts.filter(p => p.file).map(p => ({ base64: p.file.data, type: p.file.mime_type }));
        
        if (!textContent && files.length === 0) return;
        
        isSending = true; 
        ui.setLoading(true); 
        const currentChannel = state.getCurrentChannel();
        
        // そのメッセージより前の履歴を使用
        const historyForRetry = thread.history.slice(0, messageIndex);
        
        const requestPayload = { 
            history: historyForRetry, 
            message: textContent, 
            files: files, 
            config: currentChannel.config,
            selectedModel: currentChannel.config.selectedModel,
            systemPrompt: state.getEffectiveSystemPrompt()
        }; 
        handleApiResponse(requestPayload); 
    } else {
        // AIメッセージのリトライ：前のユーザーメッセージから再送信
        const messageIndex = thread.history.findIndex(m => m.id === messageId); 
        if (messageIndex > 0) { 
            const historyForRetry = thread.history.slice(0, messageIndex); 
            const lastUserMessage = historyForRetry.filter(m => m.role === 'user').pop(); 
            if(!lastUserMessage) return; 
            isSending = true; 
            ui.setLoading(true); 
            const currentChannel = state.getCurrentChannel();
            const requestPayload = { 
                history: historyForRetry.slice(0, historyForRetry.lastIndexOf(lastUserMessage)), 
                message: lastUserMessage.parts.find(p => p.text)?.text || "", 
                files: lastUserMessage.parts.filter(p => p.file).map(p => ({ base64: p.file.data, type: p.file.mime_type })), 
                config: currentChannel.config,
                selectedModel: currentChannel.config.selectedModel,
                systemPrompt: state.getEffectiveSystemPrompt()
            }; 
            handleApiResponse(requestPayload, messageId); 
        }
    }
}
function handleExport() { const dataStr = JSON.stringify(state.getState(), null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `gemini-chat-export-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
function handleImport(event) { const file = event.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => { try { const newState = JSON.parse(e.target.result); if (confirm('現在のすべてのデータをインポートしたデータで上書きします。よろしいですか？')) { state.importState(newState); renderApp(); } } catch (error) { alert('ファイルの読み込みに失敗しました。'); } }; reader.readAsText(file); event.target.value = ''; } }
function handleImageUpload(event, level, key) { const file = event.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => { const settings = { [key]: e.target.result }; if (level === 'global') state.updateGlobalUiSettings(settings); if (level === 'channel') state.updateChannelUiSettings(settings); if (level === 'thread') state.updateThreadUiSettings(settings); renderApp(); }; reader.readAsDataURL(file); } }
function handleImageClear(level, key) { const settings = { [key]: null }; if (level === 'global') state.updateGlobalUiSettings(settings); if (level === 'channel') state.updateChannelUiSettings(settings); if (level === 'thread') state.updateThreadUiSettings(settings); renderApp(); }
function executeSearch() { const searchTerm = UIElements.searchModalInput.value; const results = state.searchAll(searchTerm); ui.renderSearchResults(results, searchTerm); }
function handleSearchResultClick(event) { const item = event.target.closest('.search-result-item'); if (item) { const { channelId, threadId } = item.dataset; state.selectChannel(channelId); state.selectThread(threadId); renderApp(); ui.toggleSearchModal(false); } }

// メッセージアクションボタンの表示/非表示を切り替える関数
function toggleMessageActions(messageWrapper) {
    // 他のメッセージのアクティブ状態を削除
    const allMessageWrappers = document.querySelectorAll('.message-wrapper');
    allMessageWrappers.forEach(wrapper => {
        if (wrapper !== messageWrapper) {
            wrapper.classList.remove('active');
        }
    });
    
    // 現在のメッセージのアクティブ状態を切り替える
    messageWrapper.classList.toggle('active');
}

// 外部クリック/タップでアクションボタンを非表示にする
function hideAllMessageActions(event) {
    // メッセージ以外をクリック/タップした場合、すべてのアクティブ状態を削除
    if (!event.target.closest('.message-wrapper')) {
        const allMessageWrappers = document.querySelectorAll('.message-wrapper');
        allMessageWrappers.forEach(wrapper => {
            wrapper.classList.remove('active');
        });
    }
}

document.addEventListener('click', hideAllMessageActions);
document.addEventListener('touchend', hideAllMessageActions);

// モバイル対応のためのタッチイベントハンドラーを追加
document.addEventListener('touchend', (event) => {
    // タッチ操作でのメッセージアクション制御
    const target = event.target;
    const wrapper = target.closest('.message-wrapper');
    
    // メッセージアクションボタンがタップされた場合の処理
    if (target.closest('.message-actions .icon-btn')) {
        // handleChatHistoryClickで既に処理されるため、ここでは何もしない
        return;
    }
    
    // retry-controls の処理
    if (target.closest('.retry-controls')) {
        // handleChatHistoryClickで既に処理されるため、ここでは何もしない
        return;
    }
    
    // メッセージ本体がタップされた場合、アクションボタンを表示/非表示
    if (wrapper && !target.closest('.message-actions') && !target.closest('.retry-controls')) {
        event.preventDefault(); // デフォルトのクリックイベントを防ぐ
        toggleMessageActions(wrapper);
    }
});

// ==========================================
// デフォルト設定関連の関数
// ==========================================

function getDefaultSettingsElements() {
    try {
        return {
            panel: document.getElementById('default-settings-panel'),
            overlay: document.getElementById('default-settings-overlay'),
            closeBtn: document.getElementById('default-settings-close-btn'),
            saveBtn: document.getElementById('default-settings-save-btn'),
            resetBtn: document.getElementById('default-settings-reset-btn'),
            
            // チャンネル設定
            stream: document.getElementById('default-stream'),
            useWebSearch: document.getElementById('default-use-web-search'),
            modelSelect: document.getElementById('default-model-select'),
            temperature: document.getElementById('default-temperature'),
            temperatureValue: document.getElementById('default-temperature-value'),
            topP: document.getElementById('default-top-p'),
            topPValue: document.getElementById('default-top-p-value'),
            topK: document.getElementById('default-top-k'),
            maxTokens: document.getElementById('default-max-tokens'),
            
            // ダミープロンプト
            dummyUserToggle: document.getElementById('default-dummy-user-toggle'),
            dummyUserText: document.getElementById('default-dummy-user-text'),
            dummyModelToggle: document.getElementById('default-dummy-model-toggle'),
            dummyModelText: document.getElementById('default-dummy-model-text'),
            
            // システムプロンプト
            channelSystemPromptToggle: document.getElementById('default-channel-system-prompt-toggle'),
            channelSystemPromptText: document.getElementById('default-channel-system-prompt-text'),
            threadSystemPromptToggle: document.getElementById('default-thread-system-prompt-toggle'),
            threadSystemPromptText: document.getElementById('default-thread-system-prompt-text')
        };
    } catch (error) {
        console.error('Error getting default settings elements:', error);
        return {};
    }
}

function setDefaultConfigToUI() {
    try {
        const defaultSettings = getDefaultSettings();
        if (!defaultSettings) {
            console.error('Default settings is null or undefined');
            return;
        }
        
        const channelDefaults = defaultSettings.channel;
        const threadDefaults = defaultSettings.thread;
        const defaultSettingsElements = getDefaultSettingsElements();
        
        // チャンネル設定
        if (defaultSettingsElements.stream) {
            defaultSettingsElements.stream.checked = channelDefaults.stream;
        }
        if (defaultSettingsElements.useWebSearch) {
            defaultSettingsElements.useWebSearch.checked = channelDefaults.useWebSearch;
        }
        if (defaultSettingsElements.modelSelect) {
            defaultSettingsElements.modelSelect.value = channelDefaults.selectedModel || '';
        }
        if (defaultSettingsElements.temperature) {
            defaultSettingsElements.temperature.value = channelDefaults.generationConfig.temperature;
        }
        if (defaultSettingsElements.temperatureValue) {
            defaultSettingsElements.temperatureValue.textContent = channelDefaults.generationConfig.temperature.toFixed(1);
        }
        if (defaultSettingsElements.topP) {
            defaultSettingsElements.topP.value = channelDefaults.generationConfig.top_p;
        }
        if (defaultSettingsElements.topPValue) {
            defaultSettingsElements.topPValue.textContent = channelDefaults.generationConfig.top_p.toFixed(1);
        }
        if (defaultSettingsElements.topK) {
            defaultSettingsElements.topK.value = channelDefaults.generationConfig.top_k || '';
        }
        if (defaultSettingsElements.maxTokens) {
            defaultSettingsElements.maxTokens.value = channelDefaults.generationConfig.max_output_tokens || '';
        }
        
        // ダミープロンプト
        if (defaultSettingsElements.dummyUserToggle) {
            defaultSettingsElements.dummyUserToggle.checked = channelDefaults.dummyUserPrompt.enabled;
        }
        if (defaultSettingsElements.dummyUserText) {
            defaultSettingsElements.dummyUserText.value = channelDefaults.dummyUserPrompt.text;
        }
        if (defaultSettingsElements.dummyModelToggle) {
            defaultSettingsElements.dummyModelToggle.checked = channelDefaults.dummyModelPrompt.enabled;
        }
        if (defaultSettingsElements.dummyModelText) {
            defaultSettingsElements.dummyModelText.value = channelDefaults.dummyModelPrompt.text;
        }
        
        // システムプロンプト
        if (defaultSettingsElements.channelSystemPromptToggle) {
            defaultSettingsElements.channelSystemPromptToggle.checked = channelDefaults.systemPrompt.enabled;
        }
        if (defaultSettingsElements.channelSystemPromptText) {
            defaultSettingsElements.channelSystemPromptText.value = channelDefaults.systemPrompt.text;
        }
        if (defaultSettingsElements.threadSystemPromptToggle) {
            defaultSettingsElements.threadSystemPromptToggle.checked = threadDefaults.systemPrompt.enabled;
        }
        if (defaultSettingsElements.threadSystemPromptText) {
            defaultSettingsElements.threadSystemPromptText.value = threadDefaults.systemPrompt.text;
        }
    } catch (error) {
        console.error('Error setting default config to UI:', error);
    }
}

function updateDefaultModelSelectOptions() {
    try {
        const defaultSettingsElements = getDefaultSettingsElements();
        if (!defaultSettingsElements.modelSelect) return;
        
        const models = getAvailableModels();
        const currentValue = defaultSettingsElements.modelSelect.value;
        
        // セレクトボックスをクリア
        defaultSettingsElements.modelSelect.innerHTML = '';
        
        // デフォルトオプション
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '選択しない';
        defaultSettingsElements.modelSelect.appendChild(defaultOption);
        
        // モデルオプションを追加
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.display_name || model.name;
            defaultSettingsElements.modelSelect.appendChild(option);
        });
        
        // 前の値を復元
        defaultSettingsElements.modelSelect.value = currentValue;
    } catch (error) {
        console.error('Error updating default model select options:', error);
    }
}

function getDefaultConfigFromUI() {
    try {
        const defaultSettingsElements = getDefaultSettingsElements();
        const topK_raw = defaultSettingsElements.topK?.value;
        const maxTokens_raw = defaultSettingsElements.maxTokens?.value;
        
        return {
            channel: {
                stream: defaultSettingsElements.stream?.checked ?? true,
                useWebSearch: defaultSettingsElements.useWebSearch?.checked ?? false,
                selectedModel: defaultSettingsElements.modelSelect?.value || null,
                generationConfig: {
                    temperature: parseFloat(defaultSettingsElements.temperature?.value ?? 0.7),
                    top_p: parseFloat(defaultSettingsElements.topP?.value ?? 1.0),
                    top_k: topK_raw ? parseInt(topK_raw, 10) : null,
                    max_output_tokens: maxTokens_raw ? parseInt(maxTokens_raw, 10) : null,
                },
                dummyUserPrompt: { 
                    enabled: defaultSettingsElements.dummyUserToggle?.checked ?? false, 
                    text: defaultSettingsElements.dummyUserText?.value.trim() ?? '' 
                },
                dummyModelPrompt: { 
                    enabled: defaultSettingsElements.dummyModelToggle?.checked ?? false, 
                    text: defaultSettingsElements.dummyModelText?.value.trim() ?? '' 
                },
                systemPrompt: { 
                    enabled: defaultSettingsElements.channelSystemPromptToggle?.checked ?? false, 
                    text: defaultSettingsElements.channelSystemPromptText?.value.trim() ?? '' 
                }
            },
            thread: {
                systemPrompt: { 
                    enabled: defaultSettingsElements.threadSystemPromptToggle?.checked ?? false, 
                    text: defaultSettingsElements.threadSystemPromptText?.value.trim() ?? '' 
                }
            }
        };
    } catch (error) {
        console.error('Error getting default config from UI:', error);
        // フォールバック値を返す
        return {
            channel: {
                stream: true,
                useWebSearch: false,
                selectedModel: null,
                generationConfig: { temperature: 0.7, top_p: 1.0, top_k: null, max_output_tokens: null },
                dummyUserPrompt: { enabled: false, text: '' },
                dummyModelPrompt: { enabled: false, text: '' },
                systemPrompt: { enabled: false, text: '' }
            },
            thread: {
                systemPrompt: { enabled: false, text: '' }
            }
        };
    }
}

function setupDefaultSettingsEventListeners() {
    try {
        console.log('Setting up default settings event listeners...');
        
        // パネルの表示/非表示
        const defaultSettingsBtn = document.getElementById('default-settings-btn');
        if (defaultSettingsBtn) {
            console.log('Default settings button found, adding click listener');
            defaultSettingsBtn.addEventListener('click', () => {
                console.log('Default settings button clicked');
                openDefaultSettingsPanel();
            });
        } else {
            console.error('Default settings button not found');
        }
        
        // DOMContentLoadedでボタンのイベントリスナーを設定
        const setupButtonListeners = () => {
            try {
                const defaultSettingsElements = getDefaultSettingsElements();
                
                // クローズボタン
                if (defaultSettingsElements.closeBtn) {
                    defaultSettingsElements.closeBtn.addEventListener('click', () => {
                        closeDefaultSettingsPanel();
                    });
                }
                
                // オーバーレイクリックでクローズ（モバイル用）
                if (defaultSettingsElements.overlay) {
                    defaultSettingsElements.overlay.addEventListener('click', () => {
                        closeDefaultSettingsPanel();
                    });
                }
                
                // 保存ボタン
                if (defaultSettingsElements.saveBtn) {
                    defaultSettingsElements.saveBtn.addEventListener('click', () => {
                        try {
                            const newDefaults = getDefaultConfigFromUI();
                            updateDefaultChannelSettings(newDefaults.channel);
                            updateDefaultThreadSettings(newDefaults.thread);
                            
                            alert('デフォルト設定を保存しました。新しく作成されるチャンネル・スレッドにこの設定が適用されます。');
                            closeDefaultSettingsPanel();
                        } catch (error) {
                            console.error('Error saving default settings:', error);
                            alert('デフォルト設定の保存中にエラーが発生しました。');
                        }
                    });
                }
                
                // リセットボタン
                if (defaultSettingsElements.resetBtn) {
                    defaultSettingsElements.resetBtn.addEventListener('click', () => {
                        try {
                            if (confirm('デフォルト設定を初期値に戻しますか？')) {
                                resetDefaultSettings();
                                setDefaultConfigToUI();
                                alert('デフォルト設定をリセットしました。');
                            }
                        } catch (error) {
                            console.error('Error resetting default settings:', error);
                            alert('デフォルト設定のリセット中にエラーが発生しました。');
                        }
                    });
                }
                
                // スライダーの値表示更新
                if (defaultSettingsElements.temperature && defaultSettingsElements.temperatureValue) {
                    defaultSettingsElements.temperature.addEventListener('input', (event) => {
                        defaultSettingsElements.temperatureValue.textContent = parseFloat(event.target.value).toFixed(1);
                    });
                }
                
                if (defaultSettingsElements.topP && defaultSettingsElements.topPValue) {
                    defaultSettingsElements.topP.addEventListener('input', (event) => {
                        defaultSettingsElements.topPValue.textContent = parseFloat(event.target.value).toFixed(1);
                    });
                }
                
                // ESCキーでクローズ
                document.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') {
                        const panel = document.getElementById('default-settings-panel');
                        if (panel && panel.classList.contains('visible')) {
                            closeDefaultSettingsPanel();
                        }
                    }
                });
                
            } catch (error) {
                console.error('Error setting up default settings button listeners:', error);
            }
        };
        
        // DOM要素が確実に読み込まれてからボタンリスナーを設定
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupButtonListeners);
        } else {
            setupButtonListeners();
        }
        
        console.log('Default settings event listeners setup completed');
    } catch (error) {
        console.error('Error in setupDefaultSettingsEventListeners:', error);
    }
}

function openDefaultSettingsPanel() {
    try {
        console.log('Opening default settings panel...');
        const defaultSettingsElements = getDefaultSettingsElements();
        console.log('Default settings elements:', defaultSettingsElements);
        
        if (defaultSettingsElements.panel) {
            console.log('Panel found, adding visible class');
            defaultSettingsElements.panel.classList.add('visible');
            setDefaultConfigToUI();
            
            // モバイルの場合はオーバーレイも表示
            if (window.innerWidth <= 1024 && defaultSettingsElements.overlay) {
                console.log('Mobile detected, showing overlay');
                defaultSettingsElements.overlay.classList.add('show');
                // ボディのスクロールを無効化
                document.body.style.overflow = 'hidden';
            }
        } else {
            console.error('Default settings panel not found');
        }
    } catch (error) {
        console.error('Error opening default settings panel:', error);
    }
}

function closeDefaultSettingsPanel() {
    try {
        const defaultSettingsElements = getDefaultSettingsElements();
        if (defaultSettingsElements.panel) {
            defaultSettingsElements.panel.classList.remove('visible');
        }
        if (defaultSettingsElements.overlay) {
            defaultSettingsElements.overlay.classList.remove('show');
        }
        // ボディのスクロールを復元
        document.body.style.overflow = '';
    } catch (error) {
        console.error('Error closing default settings panel:', error);
    }
}

// ==========================================
// メイン初期化関数
// ==========================================

function init() { 
    try {
        console.log('🚀 Initializing application...');
        
        // ★ モバイル最適化を最初に実行
        initMobileOptimizations();
        
        // ★ タッチ操作改善を追加
        initImprovedTouchInteractions();
        
        // サービスワーカーを登録（非同期、エラーが発生してもアプリを停止しない）
        registerServiceWorker().catch(error => {
            console.warn('Service Worker registration failed, but app will continue:', error);
        });
        
        // 基本初期化
        state.initializeState(); 
        setupEventListeners(); 
        setupConfigEventListeners();
        
        // APIキー設定を初期化
        initializeApiKeySettings(); 
        
        // デフォルト設定のイベントリスナーを安全に設定
        try {
            setupDefaultSettingsEventListeners();
        } catch (error) {
            console.warn('Default settings event listeners setup failed, but app will continue:', error);
        } 
        
        // UIイベントリスナーを初期化
        ui.initScrollEventListener();
        
        renderApp(); 
        
        // モデル一覧の初期読み込み
        loadAvailableModels().catch(error => {
            console.warn('Initial model loading failed:', error);
        });
        
        console.log('✅ Application initialization completed');
    } catch (error) {
        console.error('Initialization error:', error);
        // 基本的な初期化だけでも続行
        try {
            state.initializeState();
            renderApp();
        } catch (fallbackError) {
            console.error('Fallback initialization failed:', fallbackError);
        }
    }
}

// ==========================================
// テスト関数（デバッグ用）
// ==========================================

// グローバルに公開するテスト関数
window.testBasicUI = function() {
    console.log('=== UI改善テスト ===');
    
    // サイドバーのスクロール確認
    const channelList = document.querySelector('.channel-list');
    const threadList = document.querySelector('.thread-list');
    
    console.log('Channel list scrollable:', channelList?.scrollHeight > channelList?.clientHeight);
    console.log('Thread list scrollable:', threadList?.scrollHeight > threadList?.clientHeight);
    
    // 削除ボタンの表示確認
    const deleteButtons = document.querySelectorAll('.delete-item-btn');
    console.log('Delete buttons found:', deleteButtons.length);
    deleteButtons.forEach((btn, i) => {
        const opacity = window.getComputedStyle(btn).opacity;
        console.log(`Delete button ${i+1} opacity:`, opacity);
    });
    
    // メッセージアクションの確認
    const messageActions = document.querySelectorAll('.message-actions');
    console.log('Message action groups found:', messageActions.length);
    messageActions.forEach((actions, i) => {
        const opacity = window.getComputedStyle(actions).opacity;
        console.log(`Message actions ${i+1} opacity:`, opacity);
    });
};

window.testToast = function() {
    showToast('📋 テスト通知です', 'success');
    setTimeout(() => showToast('⚠️ 警告通知', 'warning'), 1000);
    setTimeout(() => showToast('❌ エラー通知', 'error'), 2000);
    setTimeout(() => showToast('ℹ️ 情報通知', 'info'), 3000);
};

window.testHaptics = function() {
    if ('vibrate' in navigator) {
        console.log('Testing haptic feedback...');
        navigator.vibrate(10); // 軽い振動
        setTimeout(() => navigator.vibrate(25), 500); // 中程度
        setTimeout(() => navigator.vibrate([50, 10, 50]), 1000); // 強い振動
    } else {
        console.log('Vibration API not supported');
    }
};

// コピー機能のテスト
window.testCopyFunction = function() {
    copyToClipboard('これはコピー機能のテストです。');
};

// スクロール機能のテスト
window.testScrollFunction = function() {
    console.log('🧪 Manual scroll test initiated');
    ui.testScrollToLatestAIMessage();
};

// デバッグ情報表示
window.showScrollDebugInfo = function() {
    const chatHistory = document.getElementById('chat-history');
    const aiMessages = document.querySelectorAll('.model-message-turn');
    
    console.log('📊 Scroll Debug Info:', {
        chatHistoryHeight: chatHistory?.clientHeight,
        chatHistoryScrollTop: chatHistory?.scrollTop,
        chatHistoryScrollHeight: chatHistory?.scrollHeight,
        aiMessagesCount: aiMessages.length,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        isMobile: window.innerWidth <= 768,
        userAgent: navigator.userAgent
    });
    
    if (aiMessages.length > 0) {
        const lastAI = aiMessages[aiMessages.length - 1];
        const rect = lastAI.getBoundingClientRect();
        console.log('📊 Last AI Message:', {
            offsetTop: lastAI.offsetTop,
            boundingClientRect: rect,
            messageId: lastAI.querySelector('.message-wrapper')?.dataset.messageId
        });
    }
};

// アプリケーション開始
init();