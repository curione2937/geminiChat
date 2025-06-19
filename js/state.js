const STORAGE_KEY = 'gemini-chat-app-state-v9'; // バージョンアップ

// partsにファイルデータも保存できるように
const createMessage = (role, parts) => ({ id: `msg-${Date.now()}`, role, parts, activePartIndex: 0 });
const createNewThread = (name = '新しい会話') => {
    const defaults = state.defaultSettings?.thread || { systemPrompt: getDefaultSystemPrompt() };
    return {
        id: `thread-${Date.now()}`, 
        name, 
        history: [], 
        uiSettings: getDefaultUiSettings(), 
        useChannelIcons: true,
        systemPrompt: { ...getDefaultSystemPrompt(), ...defaults.systemPrompt }, // デフォルト設定を使用
        useChannelFiles: true // チャンネル共有ファイルを使用するかどうか
    };
};
const createNewChannel = (name = '新しいチャンネル') => {
    const newChannel = {
        id: `channel-${Date.now()}`, 
        name, 
        config: getDefaultChannelConfig(), 
        threads: [], 
        uiSettings: getDefaultUiSettings(),
        sharedFiles: [] // チャンネル共有ファイル
    };
    // 最初のスレッドを作成
    newChannel.threads = [createNewThread()];
    return newChannel;
};
const getDefaultChannelConfig = () => {
    const defaults = state.defaultSettings?.channel || {
        stream: true, 
        useWebSearch: false, 
        selectedModel: null,
        generationConfig: { temperature: 0.7, top_p: 1.0, top_k: null, max_output_tokens: 8192 }, 
        dummyUserPrompt: { enabled: false, text: '' }, 
        dummyModelPrompt: { enabled: false, text: '' },
        systemPrompt: getDefaultSystemPrompt()
    };
    return {
        stream: defaults.stream, 
        useWebSearch: defaults.useWebSearch, 
        selectedModel: defaults.selectedModel, // 選択されたモデル
        generationConfig: { ...defaults.generationConfig }, 
        dummyUserPrompt: { ...defaults.dummyUserPrompt }, 
        dummyModelPrompt: { ...defaults.dummyModelPrompt },
        systemPrompt: { ...getDefaultSystemPrompt(), ...defaults.systemPrompt } // デフォルト設定を使用
    };
};
const getDefaultUiSettings = () => ({ userIcon: null, modelIcon: null });
const getDefaultSystemPrompt = () => ({ enabled: false, text: '' });

let state = { 
    channels: [], 
    currentChannelId: null, 
    currentThreadId: null, 
    globalUiSettings: { backgroundImage: null },
    availableModels: [], // 利用可能なモデル一覧
    modelsLoaded: false, // モデル一覧の読み込み状態
    defaultSettings: { // 新しいチャンネル・スレッドのデフォルト設定
        channel: {
            stream: true,
            useWebSearch: false,
            selectedModel: null,
            generationConfig: { temperature: 0.7, top_p: 1.0, top_k: null, max_output_tokens: 8192 },
            dummyUserPrompt: { enabled: false, text: '' },
            dummyModelPrompt: { enabled: false, text: '' },
            systemPrompt: { enabled: false, text: '' }
        },
        thread: {
            systemPrompt: { enabled: false, text: '' }
        }
    }
};

function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.error("状態の保存に失敗:", e); } }

export function initializeState() { 
    const savedState = localStorage.getItem(STORAGE_KEY); 
    if (savedState) { 
        state = JSON.parse(savedState); 
        if (!state.globalUiSettings) state.globalUiSettings = { backgroundImage: null }; 
        if (!state.availableModels) state.availableModels = [];
        if (typeof state.modelsLoaded === 'undefined') state.modelsLoaded = false;
        // デフォルト設定の初期化
        if (!state.defaultSettings) {
            state.defaultSettings = {
                channel: {
                    stream: true,
                    useWebSearch: false,
                    selectedModel: null,
                    generationConfig: { temperature: 0.7, top_p: 1.0, top_k: null, max_output_tokens: 8192 },
                    dummyUserPrompt: { enabled: false, text: '' },
                    dummyModelPrompt: { enabled: false, text: '' },
                    systemPrompt: { enabled: false, text: '' }
                },
                thread: {
                    systemPrompt: { enabled: false, text: '' }
                }
            };
        }
        
        state.channels.forEach(ch => { 
            if (!ch.uiSettings) ch.uiSettings = getDefaultUiSettings(); 
            if (!ch.config.selectedModel) ch.config.selectedModel = null; // モデル選択フィールドを追加
            if (!ch.config.systemPrompt) ch.config.systemPrompt = getDefaultSystemPrompt(); // チャンネルシステムプロンプト追加
            if (!ch.sharedFiles) ch.sharedFiles = []; // チャンネル共有ファイル追加
            ch.threads.forEach(th => { 
                if (!th.uiSettings) th.uiSettings = getDefaultUiSettings(); 
                if (typeof th.useChannelIcons === 'undefined') th.useChannelIcons = true; 
                if (!th.systemPrompt) th.systemPrompt = getDefaultSystemPrompt(); // スレッドシステムプロンプト追加
                if (typeof th.useChannelFiles === 'undefined') th.useChannelFiles = true; // チャンネルファイル使用設定追加
            }); 
        }); 
    } else { 
        const d = createNewChannel(); 
        state = { ...state, channels: [d], currentChannelId: d.id, currentThreadId: d.threads[0].id }; 
    } 
    saveState(); 
}

export const getState = () => state;
export const getChannels = () => state.channels;
export const getCurrentChannel = () => state.channels.find(c => c.id === state.currentChannelId) || null;
export const getCurrentThread = () => { const c = getCurrentChannel(); return c ? c.threads.find(t => t.id === state.currentThreadId) : null; };

// モデル関連の関数
export const getAvailableModels = () => state.availableModels;
export const areModelsLoaded = () => state.modelsLoaded;

export function setAvailableModels(models) {
    state.availableModels = models;
    state.modelsLoaded = true;
    saveState();
}

export function getSelectedModel() {
    const channel = getCurrentChannel();
    return channel ? channel.config.selectedModel : null;
}

export function setSelectedModel(modelName) {
    const channel = getCurrentChannel();
    if (channel) {
        channel.config.selectedModel = modelName;
        saveState();
    }
}

// システムプロンプト関連の関数
export function getEffectiveSystemPrompt() {
    const thread = getCurrentThread();
    const channel = getCurrentChannel();
    
    let baseSystemPrompt = "";
    let threadSystemPrompt = "";
    
    // チャンネル共通設定を取得
    if (channel && channel.config && channel.config.systemPrompt && channel.config.systemPrompt.enabled && channel.config.systemPrompt.text && channel.config.systemPrompt.text.trim()) {
        baseSystemPrompt = channel.config.systemPrompt.text.trim();
    } else {
        // デフォルトのシステムプロンプト
        baseSystemPrompt = "You are a helpful assistant. Please respond primarily in Japanese, unless the user's query explicitly suggests otherwise.";
    }
    
    // スレッド個別設定を取得
    if (thread && thread.systemPrompt && thread.systemPrompt.enabled && thread.systemPrompt.text && thread.systemPrompt.text.trim()) {
        threadSystemPrompt = thread.systemPrompt.text.trim();
    }
    
    // スレッド個別設定が有効な場合は、チャンネル共通設定に追加
    if (threadSystemPrompt) {
        return baseSystemPrompt + "\n\n" + threadSystemPrompt;
    }
    
    // スレッド個別設定がない場合は、チャンネル共通設定またはデフォルトのみ
    return baseSystemPrompt;
}

export function updateChannelSystemPrompt(systemPrompt) {
    const channel = getCurrentChannel();
    if (channel) {
        channel.config.systemPrompt = { ...channel.config.systemPrompt, ...systemPrompt };
        saveState();
    }
}

export function updateThreadSystemPrompt(systemPrompt) {
    const thread = getCurrentThread();
    if (thread) {
        thread.systemPrompt = { ...thread.systemPrompt, ...systemPrompt };
        saveState();
    }
}

// デフォルト設定関連の関数
export function getDefaultSettings() {
    return state.defaultSettings;
}

export function updateDefaultChannelSettings(settings) {
    state.defaultSettings.channel = { ...state.defaultSettings.channel, ...settings };
    saveState();
}

export function updateDefaultThreadSettings(settings) {
    state.defaultSettings.thread = { ...state.defaultSettings.thread, ...settings };
    saveState();
}

export function resetDefaultSettings() {
    state.defaultSettings = {
        channel: {
            stream: true,
            useWebSearch: false,
            selectedModel: null,
            generationConfig: { temperature: 0.7, top_p: 1.0, top_k: null, max_output_tokens: 8192 },
            dummyUserPrompt: { enabled: false, text: '' },
            dummyModelPrompt: { enabled: false, text: '' },
            systemPrompt: { enabled: false, text: '' }
        },
        thread: {
            systemPrompt: { enabled: false, text: '' }
        }
    };
    saveState();
}

export function importState(newState) { state = newState; saveState(); }
export function addChannel() { const n = createNewChannel(`チャンネル ${state.channels.length + 1}`); state.channels.unshift(n); selectChannel(n.id); }
export function addThread() { const c = getCurrentChannel(); if (c) { const n = createNewThread(`会話 ${c.threads.length + 1}`); c.threads.unshift(n); selectThread(n.id); } }

// チャンネル削除機能
export function deleteChannel(channelId) {
    const channelIndex = state.channels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) return false;
    
    // 最後のチャンネルの場合は削除できない
    if (state.channels.length <= 1) {
        return false;
    }
    
    // チャンネルを削除
    state.channels.splice(channelIndex, 1);
    
    // 削除されたチャンネルが現在選択中だった場合、別のチャンネルを選択
    if (state.currentChannelId === channelId) {
        const newChannel = state.channels[0];
        state.currentChannelId = newChannel.id;
        state.currentThreadId = newChannel.threads[0]?.id || null;
    }
    
    saveState();
    return true;
}

// スレッド削除機能
export function deleteThread(threadId) {
    const channel = getCurrentChannel();
    if (!channel) return false;
    
    const threadIndex = channel.threads.findIndex(t => t.id === threadId);
    if (threadIndex === -1) return false;
    
    // 最後のスレッドの場合は削除できない
    if (channel.threads.length <= 1) {
        return false;
    }
    
    // スレッドを削除
    channel.threads.splice(threadIndex, 1);
    
    // 削除されたスレッドが現在選択中だった場合、別のスレッドを選択
    if (state.currentThreadId === threadId) {
        state.currentThreadId = channel.threads[0]?.id || null;
    }
    
    saveState();
    return true;
}

export function selectChannel(id) { if (state.currentChannelId !== id) { state.currentChannelId = id; const c = getCurrentChannel(); state.currentThreadId = c?.threads[0]?.id || null; saveState(); } }
export function selectThread(id) { if (state.currentThreadId !== id) { state.currentThreadId = id; saveState(); } }

export function addMessageToCurrentThread(role, parts) {
    const thread = getCurrentThread();
    if (thread) {
        const message = createMessage(role, parts);
        thread.history.push(message);
        const firstTextPart = parts.find(p => p.text);
        if (thread.history.length === 1 && firstTextPart && thread.name.startsWith('新しい会話')) {
            thread.name = firstTextPart.text.substring(0, 20);
        }
        saveState();
        return message;
    }
    return null;
}

export function deleteMessage(id) { const t = getCurrentThread(); if (t) { const i = t.history.findIndex(m => m.id === id); if (i > -1) { t.history.splice(i, 1); saveState(); } } }

export function updateMessage(id, newText) { 
    const t = getCurrentThread(); 
    if (t) { 
        const m = t.history.find(m => m.id === id); 
        if (m) { 
            // 修正：空文字列でもtextプロパティを持つパートを正しく見つける
            const textPart = m.parts.find(p => p.hasOwnProperty('text')); 
            if (textPart) { 
                textPart.text = newText; 
            } else { 
                m.parts.push({ text: newText }); 
            } 
            saveState(); 
        } 
    } 
}

export function addAlternativePart(messageId, newText) { const t = getCurrentThread(); if (t) { const m = t.history.find(m => m.id === messageId); if (m) { m.parts.push({ text: newText }); m.activePartIndex = m.parts.length - 1; saveState(); } } }
export function setActivePartIndex(messageId, index) { const t = getCurrentThread(); if (t) { const m = t.history.find(m => m.id === messageId); if (m && index >= 0 && index < m.parts.length) { m.activePartIndex = index; const mi = t.history.findIndex(msg => msg.id === messageId); t.history.splice(mi + 1); saveState(); } } }

export function updateCurrentChannel(newConfig) { 
    const c = getCurrentChannel(); 
    if (c) { 
        c.name = newConfig.name || c.name; 
        c.config = { 
            ...c.config, 
            ...newConfig, 
            generationConfig: { ...c.config.generationConfig, ...newConfig.generationConfig }, 
            dummyUserPrompt: { ...c.config.dummyUserPrompt, ...newConfig.dummyUserPrompt }, 
            dummyModelPrompt: { ...c.config.dummyModelPrompt, ...newConfig.dummyModelPrompt },
            systemPrompt: { ...c.config.systemPrompt, ...newConfig.systemPrompt }
        }; 
        saveState(); 
    } 
}

export function updateCurrentThreadName(newName) { const t = getCurrentThread(); if (t && newName) { t.name = newName; saveState(); } }
export function updateGlobalUiSettings(settings) { state.globalUiSettings = { ...state.globalUiSettings, ...settings }; saveState(); }
export function updateChannelUiSettings(settings) { const c = getCurrentChannel(); if (c) { c.uiSettings = { ...c.uiSettings, ...settings }; saveState(); } }
export function updateThreadUiSettings(settings) { const t = getCurrentThread(); if (t) { t.uiSettings = { ...t.uiSettings, ...settings }; saveState(); } }
export function setThreadIconOverride(enabled) { const t = getCurrentThread(); if (t) { t.useChannelIcons = !enabled; saveState(); } }

// チャンネル共有ファイル管理関数
export function addChannelSharedFile(fileData) {
    const channel = getCurrentChannel();
    if (channel) {
        channel.sharedFiles.push({
            id: `file-${Date.now()}`,
            name: fileData.name,
            type: fileData.type,
            base64: fileData.base64,
            size: fileData.size || 0,
            uploadDate: new Date().toISOString()
        });
        saveState();
    }
}

export function removeChannelSharedFile(fileId) {
    const channel = getCurrentChannel();
    if (channel) {
        const index = channel.sharedFiles.findIndex(f => f.id === fileId);
        if (index > -1) {
            channel.sharedFiles.splice(index, 1);
            saveState();
        }
    }
}

export function getChannelSharedFiles() {
    const channel = getCurrentChannel();
    return channel ? channel.sharedFiles : [];
}

export function setThreadUseChannelFiles(enabled) {
    const thread = getCurrentThread();
    if (thread) {
        thread.useChannelFiles = enabled;
        saveState();
    }
}

export function getThreadUseChannelFiles() {
    const thread = getCurrentThread();
    return thread ? thread.useChannelFiles : true;
}

export function searchAll(searchTerm) { if (!searchTerm) return []; const results = []; const lower = searchTerm.toLowerCase(); state.channels.forEach(c => { c.threads.forEach(t => { let found = false; for (const m of t.history) { const activePart = m.parts[m.activePartIndex]; if (activePart.text && activePart.text.toLowerCase().includes(lower)) { if (!found) { results.push({ channelId: c.id, channelName: c.name, threadId: t.id, threadName: t.name, hitMessage: activePart.text }); found = true; } } } }); }); return results; }