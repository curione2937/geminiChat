const UIElements = {
    appContainer: document.getElementById('app-container'),
    channelList: document.getElementById('channel-list'), threadList: document.getElementById('thread-list'),
    channelTitleInSidebar: document.getElementById('current-channel-title-in-sidebar'),
    threadNameInput: document.getElementById('current-thread-name-input'),
    chatHistory: document.getElementById('chat-history'),
    fileAttachmentsContainer: document.getElementById('file-attachments-container'),
    bgImagePreview: document.getElementById('bg-image-preview'),
    channelUserIconPreview: document.getElementById('channel-user-icon-preview'), channelModelIconPreview: document.getElementById('channel-model-icon-preview'),
    overrideThreadIconsToggle: document.getElementById('override-thread-icons-toggle'),
    threadIconSettings: document.getElementById('thread-icon-settings'),
    threadUserIconPreview: document.getElementById('thread-user-icon-preview'), threadModelIconPreview: document.getElementById('thread-model-icon-preview'),
    searchModalOverlay: document.getElementById('search-modal-overlay'), searchResultsContainer: document.getElementById('search-results-container'),
    editModalOverlay: document.getElementById('edit-modal-overlay'), editModalTextarea: document.getElementById('edit-modal-textarea'),
    // モバイル用要素を追加
    mobileCurrentChannel: document.getElementById('mobile-current-channel'),
    mobileCurrentThread: document.getElementById('mobile-current-thread')
};

function getResolvedIcon(role, thread, channel) {
    if (!thread || !channel) return null;
    const iconKey = role === 'user' ? 'userIcon' : 'modelIcon';
    if (!thread.useChannelIcons && thread.uiSettings[iconKey]) { return thread.uiSettings[iconKey]; }
    return channel.uiSettings[iconKey] || null;
}

function createMessageActions(msg) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'message-actions';
    let buttons = `<span class="material-symbols-outlined icon-btn copy-btn" title="コピー">content_copy</span><span class="material-symbols-outlined icon-btn edit-btn" title="編集">edit</span><span class="material-symbols-outlined icon-btn delete-btn" title="削除">delete</span>`;
    // ユーザーメッセージとAIメッセージの両方にリトライボタンを追加
    buttons += `<span class="material-symbols-outlined icon-btn retry-btn" title="リトライ">replay</span>`;
    actionsEl.innerHTML = buttons;
    return actionsEl;
}

function createRetryControls(msg) {
    const controls = document.createElement('div');
    controls.className = 'retry-controls';
    controls.innerHTML = `<button class="retry-prev-btn" ${msg.activePartIndex === 0 ? 'disabled' : ''}><span class="material-symbols-outlined">chevron_left</span></button><span class="retry-counter">${msg.activePartIndex + 1} / ${msg.parts.length}</span><button class="retry-next-btn" ${msg.activePartIndex === msg.parts.length - 1 ? 'disabled' : ''}><span class="material-symbols-outlined">chevron_right</span></button>`;
    return controls;
}

function createFilePreviewHTML(file) {
    if (file.mime_type.startsWith('image/')) { return `<img src="data:${file.mime_type};base64,${file.data}" alt="${file.name || '画像'}">`; }
    return `<div class="file-icon"><span class="material-symbols-outlined">description</span><span>${file.name || 'ファイル'}</span></div>`;
}

export function renderChatHistory(thread, channel) {
    UIElements.chatHistory.innerHTML = '';
    UIElements.threadNameInput.value = thread ? thread.name : '会話を選択してください';
    UIElements.threadNameInput.disabled = !thread;
    
    thread?.history?.forEach(msg => {
        addMessageToHistoryDOM(msg, thread, channel);
    });
    scrollToBottom(true);
}

function addMessageToHistoryDOM(msg, thread, channel) {
    const turn = document.createElement('div');
    turn.className = `message-turn ${msg.role}-message-turn`;
    
    const icon = document.createElement('img');
    icon.className = `message-icon`;
    icon.src = getResolvedIcon(msg.role, thread, channel) || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${msg.role}-message-wrapper`;
    wrapper.dataset.messageId = msg.id;

    const messageEl = document.createElement('div');
    messageEl.className = `message ${msg.role}-message`;

    const activePartIndex = msg.activePartIndex || 0;
    let contentHTML = '';

    msg.parts.forEach((part, index) => {
        if (msg.role === 'user' || index === activePartIndex) {
            if (part.text) { contentHTML += `<div class="text-part">${part.text.replace(/\n/g, '<br>')}</div>`; }
            else if (part.file) { contentHTML += `<div class="file-part">${createFilePreviewHTML(part.file)}</div>`; }
        }
    });
    messageEl.innerHTML = contentHTML;

    wrapper.appendChild(messageEl);
    wrapper.appendChild(createMessageActions(msg));
    if (msg.role === 'model' && msg.parts.length > 1) { wrapper.appendChild(createRetryControls(msg)); }
    
    turn.appendChild(icon);
    turn.appendChild(wrapper);
    UIElements.chatHistory.appendChild(turn);
}

export function updateStreamingMessage(messageId, fullText) {
    const messageEl = document.querySelector(`.message-wrapper[data-message-id="${messageId}"] .message`);
    if(messageEl){
        let textPart = messageEl.querySelector('.text-part');
        if (!textPart) {
            textPart = document.createElement('div');
            textPart.className = 'text-part';
            messageEl.appendChild(textPart);
        }
        // チャンクを追加ではなく、全体のテキストを設定
        textPart.innerHTML = fullText.replace(/\n/g, '<br>');
        
        // ストリーミング中は最初の更新のみスクロール実行
        if (fullText.length > 100 && fullText.length <= 200) {
            console.log('🌊 Initial streaming scroll');
            scrollToNewMessage(messageId);
        }
    }
}

export function renderFilePreviews(files) { 
    UIElements.fileAttachmentsContainer.innerHTML = ''; 
    UIElements.fileAttachmentsContainer.style.display = files.length > 0 ? 'flex' : 'none'; 
    files.forEach((file, index) => { 
        const fileContent = file.type.startsWith('image/') ? `<img src="data:${file.type};base64,${file.base64}" alt="${file.name}">` : `<div class="file-icon"><span class="material-symbols-outlined">description</span><span>${file.name}</span></div>`; 
        const previewHTML = `<div class="file-preview-item" data-file-index="${index}">${fileContent}<button class="remove-file-btn">×</button></div>`; 
        UIElements.fileAttachmentsContainer.insertAdjacentHTML('beforeend', previewHTML); 
    }); 
}

// チャンネル共有ファイル管理機能
export function renderChannelSharedFiles(sharedFiles) {
    const sharedFilesList = document.getElementById('channel-shared-files-list');
    if (!sharedFilesList) return;
    
    sharedFilesList.innerHTML = '';
    
    if (sharedFiles.length === 0) {
        sharedFilesList.innerHTML = '<p class="no-files-message">共有ファイルはありません</p>';
        return;
    }
    
    sharedFiles.forEach(file => {
        const fileItem = createSharedFileItem(file);
        sharedFilesList.appendChild(fileItem);
    });
}

function createSharedFileItem(file) {
    const item = document.createElement('div');
    item.className = 'shared-file-item';
    item.dataset.fileId = file.id;
    
    // ファイルタイプに応じたアイコンを決定
    let iconClass = 'other';
    let iconSymbol = 'description';
    
    if (file.type.startsWith('image/')) {
        iconClass = 'image';
        iconSymbol = 'image';
    } else if (file.type.startsWith('text/')) {
        iconClass = 'text';
        iconSymbol = 'description';
    }
    
    // ファイルサイズを人間が読みやすい形式に変換
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };
    
    // 日付を人間が読みやすい形式に変換
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
        
        if (diffHours < 24) {
            return `${diffHours}時間前`;
        } else if (diffHours < 168) {
            const diffDays = Math.ceil(diffHours / 24);
            return `${diffDays}日前`;
        } else {
            return date.toLocaleDateString('ja-JP');
        }
    };
    
    item.innerHTML = `
        <div class="shared-file-info">
            <div class="shared-file-icon ${iconClass}">
                <span class="material-symbols-outlined">${iconSymbol}</span>
            </div>
            <div class="shared-file-details">
                <div class="shared-file-name" title="${file.name}">${file.name}</div>
                <div class="shared-file-meta">
                    <span class="shared-file-size">${formatFileSize(file.size)}</span>
                    <span class="shared-file-date">${formatDate(file.uploadDate)}</span>
                </div>
            </div>
        </div>
        <button class="remove-shared-file-btn" title="ファイルを削除">
            <span class="material-symbols-outlined">delete</span>
        </button>
    `;
    
    return item;
}

function scrollToBottom(force = false) { 
    const isScrolledToBottom = UIElements.chatHistory.scrollHeight - UIElements.chatHistory.clientHeight <= UIElements.chatHistory.scrollTop + 10; 
    if (force || isScrolledToBottom) { 
        UIElements.chatHistory.scrollTop = UIElements.chatHistory.scrollHeight; 
    } 
}

// 新しいメッセージの先頭を画面内に表示する関数
export function scrollToNewMessage(messageId) {
    if (!messageId) {
        scrollToBottom(true);
        return;
    }
    
    const messageWrapper = document.querySelector(`.message-wrapper[data-message-id="${messageId}"]`);
    if (!messageWrapper) {
        setTimeout(() => scrollToBottom(true), 100);
        return;
    }
    
    // メッセージがAIからの回答かチェック
    const messageTurn = messageWrapper.closest('.message-turn');
    const isModelMessage = messageTurn && messageTurn.classList.contains('model-message-turn');
    
    if (isModelMessage) {
        // AIメッセージの場合は常に先頭を表示
        console.log('🎯 AI message detected, scrolling to top');
        console.log('📱 Device info:', {
            isMobile: window.innerWidth <= 768,
            userAgent: navigator.userAgent.includes('Mobile'),
            touchSupport: 'ontouchstart' in window
        });
        
        // モバイルの場合はより長い待機時間
        const waitTime = window.innerWidth <= 768 ? 300 : 150;
        
        requestAnimationFrame(() => {
            setTimeout(() => {
                const chatHistory = UIElements.chatHistory;
                const messageTurnElement = messageWrapper.closest('.message-turn');
                
                if (messageTurnElement && chatHistory) {
                    // より確実な位置計算
                    const chatHistoryTop = chatHistory.offsetTop;
                    const messageTurnTop = messageTurnElement.offsetTop;
                    
                    // 相対的な位置を計算
                    let targetScrollTop = messageTurnTop - chatHistoryTop;
                    
                    // モバイルヘッダーの高さを考慮
                    if (window.innerWidth <= 1024) {
                        const mobileHeader = document.querySelector('.mobile-header');
                        if (mobileHeader) {
                            targetScrollTop -= mobileHeader.offsetHeight;
                        }
                    }
                    
                    // 少しのマージンを追加
                    targetScrollTop = Math.max(0, targetScrollTop - 20);
                    
                    console.log('📊 Enhanced scroll calculation:', {
                        chatHistoryTop,
                        messageTurnTop,
                        targetScrollTop,
                        currentScroll: chatHistory.scrollTop,
                        isMobile: window.innerWidth <= 768
                    });
                    
                    // スクロール実行（モバイルではinstantを使用する場合もある）
                    const behavior = window.innerWidth <= 768 ? 'auto' : 'smooth';
                    
                    chatHistory.scrollTo({
                        top: targetScrollTop,
                        behavior: behavior
                    });
                    
                    // モバイルの場合、追加で確認
                    if (window.innerWidth <= 768) {
                        setTimeout(() => {
                            console.log('📱 Mobile scroll verification:', {
                                targetScrollTop,
                                actualScrollTop: chatHistory.scrollTop,
                                difference: Math.abs(targetScrollTop - chatHistory.scrollTop)
                            });
                            
                            // 目標位置に到達していない場合はもう一度実行
                            if (Math.abs(targetScrollTop - chatHistory.scrollTop) > 50) {
                                console.log('📱 Mobile: Retrying scroll');
                                chatHistory.scrollTop = targetScrollTop;
                            }
                        }, 500);
                    }
                    
                } else {
                    // フォールバック：scrollIntoViewを使用
                    console.log('📊 Using fallback scrollIntoView');
                    messageTurnElement.scrollIntoView({ 
                        behavior: window.innerWidth <= 768 ? 'auto' : 'smooth', 
                        block: 'start',
                        inline: 'nearest'
                    });
                }
            }, waitTime);
        });
    } else {
        // ユーザーメッセージの場合は従来通り下部にスクロール
        console.log('👤 User message, scrolling to bottom');
        scrollToBottom(true);
    }
}

// 通常のメッセージ追加時も新しいスクロール方式を使用
export function scrollToLatestMessage() {
    const messageWrappers = UIElements.chatHistory.querySelectorAll('.message-wrapper');
    if (messageWrappers.length > 0) {
        const lastMessage = messageWrappers[messageWrappers.length - 1];
        const messageId = lastMessage.dataset.messageId;
        if (messageId) {
            scrollToNewMessage(messageId);
        } else {
            scrollToBottom(true);
        }
    }
}

// main.jsからのスクロールイベントを処理
export function initScrollEventListener() {
    window.addEventListener('scrollToNewMessage', (event) => {
        const { messageId } = event.detail;
        if (messageId) {
            scrollToNewMessage(messageId);
        }
    });
}

// デバッグ用：最新のAIメッセージにスクロール（テスト用）
export function testScrollToLatestAIMessage() {
    const aiMessages = document.querySelectorAll('.model-message-turn .message-wrapper');
    if (aiMessages.length > 0) {
        const latestAI = aiMessages[aiMessages.length - 1];
        const messageId = latestAI.dataset.messageId;
        console.log('🧪 Testing scroll to latest AI message:', messageId);
        scrollToNewMessage(messageId);
    } else {
        console.log('❌ No AI messages found for testing');
    }
}

export function updateUiSettingsOnPage(globalSettings) { 
    UIElements.appContainer.style.backgroundImage = globalSettings.backgroundImage ? `url(${globalSettings.backgroundImage})` : ''; 
}

export function updateUiSettingsPanel(globalSettings, channel, thread) { 
    if (UIElements.bgImagePreview) {
        UIElements.bgImagePreview.src = globalSettings.backgroundImage || ''; 
    }
    
    if (channel) { 
        if (UIElements.channelUserIconPreview) {
            UIElements.channelUserIconPreview.src = channel.uiSettings.userIcon || ''; 
        }
        if (UIElements.channelModelIconPreview) {
            UIElements.channelModelIconPreview.src = channel.uiSettings.modelIcon || ''; 
        }
    } 
    
    if (thread) { 
        if (UIElements.overrideThreadIconsToggle) {
            UIElements.overrideThreadIconsToggle.checked = !thread.useChannelIcons; 
        }
        if (UIElements.threadIconSettings) {
            UIElements.threadIconSettings.classList.toggle('open', !thread.useChannelIcons); 
        }
        if (UIElements.threadUserIconPreview) {
            UIElements.threadUserIconPreview.src = thread.uiSettings.userIcon || ''; 
        }
        if (UIElements.threadModelIconPreview) {
            UIElements.threadModelIconPreview.src = thread.uiSettings.modelIcon || ''; 
        }
    } 
}

function createListItem(item, type, isActive, totalCount) { 
    const li = document.createElement('li'); 
    li.className = 'list-item'; 
    
    const textSpan = document.createElement('span');
    textSpan.className = 'list-item-text';
    textSpan.textContent = item.name || '名称未設定';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-item-btn';
    deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
    deleteBtn.title = `${type === 'channel' ? 'チャンネル' : 'スレッド'}を削除`;
    
    // 最後の1つの場合は削除ボタンを無効化
    if (totalCount <= 1) {
        deleteBtn.disabled = true;
        deleteBtn.title = `最後の${type === 'channel' ? 'チャンネル' : 'スレッド'}は削除できません`;
    }
    
    li.appendChild(textSpan);
    li.appendChild(deleteBtn);
    li.dataset[`${type}Id`] = item.id; 
    if (isActive) li.classList.add('active'); 
    return li; 
}

export function renderChannels(channels, currentChannelId) { 
    UIElements.channelList.innerHTML = ''; 
    channels.forEach(c => UIElements.channelList.appendChild(createListItem(c, 'channel', c.id === currentChannelId, channels.length))); 
}

export function renderThreads(channel, currentThreadId) { 
    UIElements.threadList.innerHTML = ''; 
    if (channel?.threads) { 
        UIElements.channelTitleInSidebar.textContent = channel.name; 
        channel.threads.forEach(t => UIElements.threadList.appendChild(createListItem(t, 'thread', t.id === currentThreadId, channel.threads.length))); 
    } else { 
        UIElements.channelTitleInSidebar.textContent = 'スレッド'; 
    } 
}

// モバイルヘッダーの更新関数を追加
export function updateMobileHeader(channel, thread) {
    if (UIElements.mobileCurrentChannel) {
        UIElements.mobileCurrentChannel.textContent = channel ? channel.name : 'チャンネル';
    }
    if (UIElements.mobileCurrentThread) {
        UIElements.mobileCurrentThread.textContent = thread ? thread.name : 'スレッド';
    }
}

export function setLoading(isLoading) { 
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = isLoading ? 'block' : 'none'; 
    }
}

export function clearInput() { 
    const messageInput = document.getElementById('message-input'); 
    if (messageInput) {
        messageInput.value = ''; 
        messageInput.style.height = 'auto'; 
    }
}

export function toggleSearchModal(show) { 
    if (UIElements.searchModalOverlay) {
        UIElements.searchModalOverlay.style.display = show ? 'flex' : 'none'; 
        if (show) {
            const searchInput = document.getElementById('search-modal-input');
            if (searchInput) {
                searchInput.focus(); 
            }
        }
    }
}

export function renderSearchResults(results, searchTerm) { 
    if (!UIElements.searchResultsContainer) return;
    
    UIElements.searchResultsContainer.innerHTML = ''; 
    if (results.length === 0) { 
        UIElements.searchResultsContainer.textContent = '一致する結果が見つかりませんでした。'; 
        return; 
    } 
    
    const fragment = document.createDocumentFragment(); 
    const regex = new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'); 
    results.forEach(res => { 
        const item = document.createElement('div'); 
        item.className = 'search-result-item'; 
        item.dataset.channelId = res.channelId; 
        item.dataset.threadId = res.threadId; 
        const highlightedMessage = res.hitMessage.replace(regex, '<mark>$1</mark>'); 
        item.innerHTML = `<div class="search-result-thread-name">${res.threadName}</div><div class="search-result-channel-name">in: ${res.channelName}</div><p>${highlightedMessage}</p>`; 
        fragment.appendChild(item); 
    }); 
    UIElements.searchResultsContainer.appendChild(fragment); 
}

export function toggleEditModal(show, text = '') { 
    if (UIElements.editModalOverlay) {
        UIElements.editModalOverlay.style.display = show ? 'flex' : 'none'; 
        if (show && UIElements.editModalTextarea) { 
            UIElements.editModalTextarea.value = text; 
            UIElements.editModalTextarea.focus(); 
        } 
    }
}

export function showScrollDebugInfo() {
    console.log('📱 Device info:', {
        isMobile: window.innerWidth <= 768,
        userAgent: navigator.userAgent.includes('Mobile'),
        touchSupport: 'ontouchstart' in window
    });
}

function testScrollFunction() {
    // Implementation of testScrollFunction
}