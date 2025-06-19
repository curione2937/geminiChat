import { updateCurrentChannel, getAvailableModels, areModelsLoaded, setSelectedModel, updateChannelSystemPrompt, updateThreadSystemPrompt } from './state.js';
import { getApiKey, setApiKey, validateApiKey } from './api.js';

const configElements = {
    panel: document.getElementById('settings-panel'),
    channelName: document.getElementById('channel-name-input'),
    geminiApiKeyInput: document.getElementById('gemini-api-key-input'),
    apiKeyToggleBtn: document.getElementById('api-key-toggle-btn'),
    apiKeyStatus: document.getElementById('api-key-status'),
    apiKeyHelpBtn: document.getElementById('api-key-help-btn'),
    modelSelect: document.getElementById('model-select'),
    manualModelToggle: document.getElementById('manual-model-toggle'),
    manualModelInput: document.getElementById('manual-model-input'),
    modelInfo: document.getElementById('model-info'),
    refreshModelsBtn: document.getElementById('refresh-models-btn'),
    stream: document.getElementById('stream-toggle'),
    useWebSearch: document.getElementById('web-search-toggle'),
    temperature: document.getElementById('temperature-slider'),
    temperatureValue: document.getElementById('temperature-value'),
    topP: document.getElementById('top-p-slider'),
    topPValue: document.getElementById('top-p-value'),
    topK: document.getElementById('top-k-input'),
    maxTokens: document.getElementById('max-tokens-input'),
    dummyUserToggle: document.getElementById('dummy-user-prompt-toggle'),
    dummyUserText: document.getElementById('dummy-user-prompt-text'),
    dummyModelToggle: document.getElementById('dummy-model-prompt-toggle'),
    dummyModelText: document.getElementById('dummy-model-prompt-text'),
    channelSystemPromptToggle: document.getElementById('channel-system-prompt-toggle'),
    channelSystemPromptText: document.getElementById('channel-system-prompt-text'),
    threadSystemPromptToggle: document.getElementById('thread-system-prompt-toggle'),
    threadSystemPromptText: document.getElementById('thread-system-prompt-text'),
};

let isUpdatingWebSearch = false;

function modelSupportsWebSearch(modelName) {
    if (!modelName) return false;
    
    const unsupportedPatterns = [
        'preview',
        'experimental',
        'vision',
        'code',
        'embedding',
        'flash',
    ];
    
    const modelLower = modelName.toLowerCase();
    
    for (const pattern of unsupportedPatterns) {
        if (modelLower.includes(pattern)) {
            return false;
        }
    }
    
    if (modelLower.includes('pro') && modelLower.includes('latest')) {
        return true;
    }
    
    return false;
}

function getConfigFromUI() {
    const topK_raw = configElements.topK.value;
    const maxTokens_raw = configElements.maxTokens.value;
    
    let selectedModel = null;
    if (configElements.manualModelToggle.checked) {
        selectedModel = configElements.manualModelInput.value.trim() || null;
    } else {
        selectedModel = configElements.modelSelect.value || null;
    }
    
    return {
        name: configElements.channelName.value.trim(),
        selectedModel: selectedModel,
        stream: configElements.stream.checked,
        useWebSearch: configElements.useWebSearch.checked,
        generationConfig: {
            temperature: parseFloat(configElements.temperature.value),
            top_p: parseFloat(configElements.topP.value),
            top_k: topK_raw ? parseInt(topK_raw, 10) : null,
            max_output_tokens: maxTokens_raw ? parseInt(maxTokens_raw, 10) : null,
        },
        dummyUserPrompt: { enabled: configElements.dummyUserToggle.checked, text: configElements.dummyUserText.value.trim() },
        dummyModelPrompt: { enabled: configElements.dummyModelToggle.checked, text: configElements.dummyModelText.value.trim() },
        systemPrompt: { 
            enabled: configElements.channelSystemPromptToggle ? configElements.channelSystemPromptToggle.checked : false, 
            text: configElements.channelSystemPromptText ? configElements.channelSystemPromptText.value.trim() : '' 
        }
    };
}

export function setConfigToUI(channel) {
    if (!channel) return;
    const config = channel.config;
    
    configElements.channelName.value = channel.name || '';
    
    const selectedModel = config.selectedModel || '';
    
    let isModelInSelect = false;
    if (configElements.modelSelect) {
        const options = Array.from(configElements.modelSelect.options);
        isModelInSelect = options.some(option => option.value === selectedModel);
        
        if (isModelInSelect) {
            configElements.modelSelect.value = selectedModel;
            configElements.manualModelToggle.checked = false;
            configElements.manualModelInput.value = '';
            toggleManualModelInput(false);
        } else if (selectedModel) {
            configElements.manualModelToggle.checked = true;
            configElements.manualModelInput.value = selectedModel;
            configElements.modelSelect.value = '';
            toggleManualModelInput(true);
        } else {
            configElements.modelSelect.value = '';
            configElements.manualModelToggle.checked = false;
            configElements.manualModelInput.value = '';
            toggleManualModelInput(false);
        }
        
        updateModelInfo(selectedModel);
    }
    
    configElements.stream.checked = config.stream;
    configElements.useWebSearch.checked = config.useWebSearch;
    
    const genConfig = config.generationConfig;
    configElements.temperature.value = genConfig.temperature;
    configElements.temperatureValue.textContent = genConfig.temperature.toFixed(1);
    configElements.topP.value = genConfig.top_p;
    configElements.topPValue.textContent = genConfig.top_p.toFixed(1);
    configElements.topK.value = genConfig.top_k || '';
    configElements.maxTokens.value = genConfig.max_output_tokens || '';
    
    const dummyUser = config.dummyUserPrompt;
    configElements.dummyUserToggle.checked = dummyUser.enabled;
    configElements.dummyUserText.value = dummyUser.text;
    
    const dummyModel = config.dummyModelPrompt;
    configElements.dummyModelToggle.checked = dummyModel.enabled;
    configElements.dummyModelText.value = dummyModel.text;
    
    const channelSystemPrompt = config.systemPrompt || { enabled: false, text: '' };
    if (configElements.channelSystemPromptToggle) {
        configElements.channelSystemPromptToggle.checked = channelSystemPrompt.enabled;
    }
    if (configElements.channelSystemPromptText) {
        configElements.channelSystemPromptText.value = channelSystemPrompt.text;
    }
}

export function setThreadConfigToUI(thread) {
    if (!thread) return;
    
    const threadSystemPrompt = thread.systemPrompt || { enabled: false, text: '' };
    if (configElements.threadSystemPromptToggle) {
        configElements.threadSystemPromptToggle.checked = threadSystemPrompt.enabled;
    }
    if (configElements.threadSystemPromptText) {
        configElements.threadSystemPromptText.value = threadSystemPrompt.text;
    }
}

export function updateModelSelectOptions() {
    if (!configElements.modelSelect) return;
    
    const models = getAvailableModels();
    const currentValue = configElements.modelSelect.value;
    
    configElements.modelSelect.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '自動選択';
    configElements.modelSelect.appendChild(defaultOption);
    
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.display_name || model.name;
        configElements.modelSelect.appendChild(option);
    });
    
    configElements.modelSelect.value = currentValue;
    updateModelInfo(currentValue);
}

function toggleManualModelInput(show) {
    if (configElements.manualModelInput) {
        configElements.manualModelInput.style.display = show ? 'block' : 'none';
        const hintElement = document.querySelector('.manual-model-hint');
        if (hintElement) {
            hintElement.style.display = show ? 'block' : 'none';
        }
        configElements.modelSelect.style.display = show ? 'none' : 'block';
    }
}

function updateModelInfo(modelName) {
    if (!configElements.modelInfo) return;
    
    try {
        if (!modelName) {
            configElements.modelInfo.innerHTML = '<em>自動選択: 画像がある場合はFlash、Web検索有効時はProを使用</em>';
            return;
        }
        
        const models = getAvailableModels();
        const model = models.find(m => m.name === modelName);
        const supportsWebSearch = modelSupportsWebSearch(modelName);
        
        if (!model) {
            if (configElements.manualModelToggle && configElements.manualModelToggle.checked) {
                configElements.modelInfo.innerHTML = `
                    <div class="model-info-content">
                        <strong>${modelName}</strong>
                        <div class="model-details">
                            <div style="color: orange;">⚠️ 手動入力されたモデル名</div>
                            <div style="color: ${supportsWebSearch ? '#28a745' : '#dc3545'}; font-weight: bold;">
                                Web検索サポート: ${supportsWebSearch ? '✅ 対応' : '❌ 非対応'}
                            </div>
                            <div>モデルが存在しない場合はエラーになります</div>
                        </div>
                    </div>
                `;
            } else {
                configElements.modelInfo.innerHTML = '<em>モデル情報が見つかりません</em>';
            }
        } else {
            const infoHTML = `
                <div class="model-info-content">
                    <strong>${model.display_name || model.name}</strong>
                    <div class="model-details">
                        <div>入力トークン制限: ${model.input_token_limit.toLocaleString()}</div>
                        <div>出力トークン制限: ${model.output_token_limit.toLocaleString()}</div>
                        <div>バージョン: ${model.version}</div>
                        <div style="color: ${supportsWebSearch ? '#28a745' : '#dc3545'}; font-weight: bold;">
                            Web検索サポート: ${supportsWebSearch ? '✅ 対応' : '❌ 非対応'}
                        </div>
                        ${model.description ? `<div class="model-description">${model.description}</div>` : ''}
                    </div>
                </div>
            `;
            
            configElements.modelInfo.innerHTML = infoHTML;
        }
        
        if (!isUpdatingWebSearch) {
            updateWebSearchToggle(modelName);
        }
    } catch (error) {
        console.error('updateModelInfo error:', error);
        configElements.modelInfo.innerHTML = '<em>モデル情報の取得に失敗しました</em>';
    }
}

function updateWebSearchToggle(modelName) {
    if (!configElements.useWebSearch || isUpdatingWebSearch) return;
    
    isUpdatingWebSearch = true;
    
    try {
        const supportsWebSearch = modelSupportsWebSearch(modelName);
        const webSearchContainer = configElements.useWebSearch.closest('.setting-item');
        
        if (!webSearchContainer) return;
        
        if (!supportsWebSearch && modelName) {
            configElements.useWebSearch.checked = false;
            configElements.useWebSearch.disabled = true;
            
            let warningText = webSearchContainer.querySelector('.web-search-warning');
            if (!warningText) {
                warningText = document.createElement('small');
                warningText.className = 'web-search-warning';
                warningText.style.color = '#dc3545';
                warningText.style.display = 'block';
                warningText.style.marginTop = '0.25rem';
                webSearchContainer.appendChild(warningText);
            }
            warningText.textContent = '選択されたモデルはWeb検索をサポートしていません';
            
        } else {
            configElements.useWebSearch.disabled = false;
            
            const warningText = webSearchContainer.querySelector('.web-search-warning');
            if (warningText) {
                warningText.remove();
            }
        }
    } catch (error) {
        console.error('updateWebSearchToggle error:', error);
    } finally {
        isUpdatingWebSearch = false;
    }
}

export function setupConfigEventListeners() {
    // APIキー関連のイベントリスナー
    if (configElements.geminiApiKeyInput) {
        // APIキー入力時のイベント
        let apiKeyTimeout;
        configElements.geminiApiKeyInput.addEventListener('input', (event) => {
            const apiKey = event.target.value.trim();
            setApiKey(apiKey);
            
            // デバウンス処理（入力停止後500ms後に検証）
            clearTimeout(apiKeyTimeout);
            apiKeyTimeout = setTimeout(() => {
                validateAndUpdateApiKeyStatus(apiKey);
            }, 500);
        });
        
        // APIキー入力フィールドのフォーカス時
        configElements.geminiApiKeyInput.addEventListener('focus', () => {
            if (configElements.geminiApiKeyInput.value === '') {
                updateApiKeyStatus('', '');
            }
        });
    }
    
    // APIキー表示/非表示ボタン
    if (configElements.apiKeyToggleBtn) {
        configElements.apiKeyToggleBtn.addEventListener('click', toggleApiKeyVisibility);
    }
    
    // APIキーヘルプボタン
    if (configElements.apiKeyHelpBtn) {
        configElements.apiKeyHelpBtn.addEventListener('click', showApiKeyHelp);
    }
    
    if (configElements.manualModelToggle) {
        configElements.manualModelToggle.addEventListener('change', (event) => {
            toggleManualModelInput(event.target.checked);
            if (event.target.checked) {
                configElements.modelSelect.value = '';
            } else {
                configElements.manualModelInput.value = '';
            }
            
            const newConfig = getConfigFromUI();
            updateCurrentChannel(newConfig);
            updateModelInfo(newConfig.selectedModel);
            setSelectedModel(newConfig.selectedModel);
            document.dispatchEvent(new CustomEvent('configChanged'));
        });
    }
    
    if (configElements.panel) {
        configElements.panel.addEventListener('input', (event) => {
            if (event.target === configElements.threadSystemPromptToggle || 
                event.target === configElements.threadSystemPromptText) {
                const threadSystemPrompt = {
                    enabled: configElements.threadSystemPromptToggle ? configElements.threadSystemPromptToggle.checked : false,
                    text: configElements.threadSystemPromptText ? configElements.threadSystemPromptText.value.trim() : ''
                };
                updateThreadSystemPrompt(threadSystemPrompt);
                document.dispatchEvent(new CustomEvent('configChanged'));
                return;
            }
            
            if (event.target === configElements.useWebSearch && isUpdatingWebSearch) {
                return;
            }
            
            const newConfig = getConfigFromUI();
            updateCurrentChannel(newConfig);
            
            if (configElements.temperatureValue) {
                configElements.temperatureValue.textContent = newConfig.generationConfig.temperature.toFixed(1);
            }
            if (configElements.topPValue) {
                configElements.topPValue.textContent = newConfig.generationConfig.top_p.toFixed(1);
            }
            
            if (event.target === configElements.modelSelect) {
                updateModelInfo(event.target.value);
                setSelectedModel(event.target.value);
            }
            
            if (event.target === configElements.manualModelInput) {
                updateModelInfo(event.target.value);
                setSelectedModel(event.target.value);
            }
            
            document.dispatchEvent(new CustomEvent('configChanged'));
        });
    }
    
    if (configElements.channelSystemPromptToggle) {
        configElements.channelSystemPromptToggle.addEventListener('change', () => {
            const channelSystemPrompt = {
                enabled: configElements.channelSystemPromptToggle.checked,
                text: configElements.channelSystemPromptText ? configElements.channelSystemPromptText.value.trim() : ''
            };
            updateChannelSystemPrompt(channelSystemPrompt);
            document.dispatchEvent(new CustomEvent('configChanged'));
        });
    }
    
    if (configElements.channelSystemPromptText) {
        configElements.channelSystemPromptText.addEventListener('input', () => {
            const channelSystemPrompt = {
                enabled: configElements.channelSystemPromptToggle ? configElements.channelSystemPromptToggle.checked : false,
                text: configElements.channelSystemPromptText.value.trim()
            };
            updateChannelSystemPrompt(channelSystemPrompt);
            document.dispatchEvent(new CustomEvent('configChanged'));
        });
    }
    
    if (configElements.refreshModelsBtn) {
        configElements.refreshModelsBtn.addEventListener('click', async () => {
            try {
                configElements.refreshModelsBtn.disabled = true;
                configElements.refreshModelsBtn.textContent = '更新中...';
                
                document.dispatchEvent(new CustomEvent('refreshModels'));
                
            } catch (error) {
                console.error('モデル更新エラー:', error);
                alert('モデル一覧の更新に失敗しました。');
            } finally {
                setTimeout(() => {
                    if (configElements.refreshModelsBtn) {
                        configElements.refreshModelsBtn.disabled = false;
                        configElements.refreshModelsBtn.textContent = '更新';
                    }
                }, 1000);
            }
        });
    }
}

function toggleApiKeyVisibility() {
    if (!configElements.geminiApiKeyInput || !configElements.apiKeyToggleBtn) return;
    
    const input = configElements.geminiApiKeyInput;
    const button = configElements.apiKeyToggleBtn;
    const icon = button.querySelector('.material-symbols-outlined');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
        button.title = '非表示';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility';
        button.title = '表示';
    }
}

function updateApiKeyStatus(status, message) {
    if (!configElements.apiKeyStatus) return;
    
    const statusElement = configElements.apiKeyStatus;
    statusElement.className = `api-key-status ${status}`;
    statusElement.textContent = message;
}

async function validateAndUpdateApiKeyStatus(apiKey) {
    if (!apiKey || apiKey.trim() === '') {
        updateApiKeyStatus('', '');
        return;
    }
    
    updateApiKeyStatus('testing', 'APIキーを検証中...');
    
    try {
        const result = await validateApiKey(apiKey);
        if (result.valid) {
            updateApiKeyStatus('valid', '✅ APIキーが有効です');
        } else {
            updateApiKeyStatus('invalid', `❌ ${result.error}`);
        }
    } catch (error) {
        updateApiKeyStatus('invalid', `❌ 検証エラー: ${error.message}`);
    }
}

function showApiKeyHelp() {
    const helpMessage = `
Gemini APIキーの取得方法：

1. Google AI Studio にアクセス
   https://aistudio.google.com/app/apikey

2. Googleアカウントでログイン

3. 「Create API Key」をクリック

4. 新しいプロジェクトを作成するか、既存のプロジェクトを選択

5. 生成されたAPIキー（AIza...で始まる）をコピー

6. このアプリの設定画面に貼り付け

※APIキーは秘密情報です。他人と共有しないでください。
※APIキーはブラウザ内にのみ保存され、外部に送信されません。
    `.trim();
    
    alert(helpMessage);
}

function initializeApiKeySettings() {
    const savedApiKey = getApiKey();
    if (savedApiKey && configElements.geminiApiKeyInput) {
        configElements.geminiApiKeyInput.value = savedApiKey;
        validateAndUpdateApiKeyStatus(savedApiKey);
    }
}

// APIキー設定を初期化する関数をエクスポート
export { initializeApiKeySettings };

