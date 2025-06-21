// Gemini API直接呼び出し用の設定
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODELS_URL = `${GEMINI_API_BASE_URL}/models`;

// APIキー管理
const API_KEY_STORAGE_KEY = 'gemini-api-key';

// デバッグ用：API URLをコンソールに出力
console.log('🔗 Gemini API Base URL:', GEMINI_API_BASE_URL);

// ネットワーク状態管理
let networkRetryAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2秒

// APIキー取得
function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
}

// APIキー保存
function setApiKey(apiKey) {
    if (apiKey && apiKey.trim()) {
        localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
    } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
}

// APIキー検証
async function validateApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('AIza')) {
        return { valid: false, error: 'APIキーは "AIza" で始まる必要があります' };
    }
    
    try {
        const response = await fetch(`${GEMINI_MODELS_URL}?key=${apiKey}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            return { valid: true };
        } else {
            const errorData = await response.json().catch(() => ({}));
            return { 
                valid: false, 
                error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}` 
            };
        }
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

// API接続テスト
window.testApiConnection = async function() {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { 
            success: false, 
            error: 'APIキーが設定されていません',
            status: 'no-key'
        };
    }
    
    console.log('🧪 Testing Gemini API connection...');
    
    try {
        const validation = await validateApiKey(apiKey);
        if (validation.valid) {
            console.log('✅ Gemini API connection successful');
            networkRetryAttempts = 0;
            return { success: true, status: 'ok', data: { message: 'API接続成功' } };
        } else {
            console.error('❌ Gemini API connection failed:', validation.error);
            return { 
                success: false,
                error: validation.error,
                status: 'error'
            };
        }
    } catch (error) {
        console.error('❌ Gemini API connection error:', error);
        return { 
            success: false, 
            error: error.message,
            status: 'error'
        };
    }
};

// 現在のAPI URL表示用（互換性のため）
window.getCurrentApiUrl = function() {
    console.log('Current Gemini API Base URL:', GEMINI_API_BASE_URL);
    return GEMINI_API_BASE_URL;
};

// 自動リトライ機能付きのAPI呼び出し
async function fetchWithRetry(url, options, maxRetries = MAX_RETRY_ATTEMPTS) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            // 成功した場合はリトライ回数をリセット
            if (response.ok) {
                networkRetryAttempts = 0;
                return response;
            }
            
            // サーバーエラー（5xx）の場合はリトライ
            if (response.status >= 500 && attempt < maxRetries) {
                console.warn(`🔄 Server error ${response.status}, retrying... (${attempt + 1}/${maxRetries})`);
                await sleep(RETRY_DELAY * (attempt + 1));
                continue;
            }
            
            return response;
        } catch (error) {
            // ネットワークエラーの場合はリトライ
            if (attempt < maxRetries && (
                error.name === 'AbortError' || 
                error.message.includes('Failed to fetch') ||
                error.message.includes('network')
            )) {
                console.warn(`🔄 Network error, retrying... (${attempt + 1}/${maxRetries}):`, error.message);
                await sleep(RETRY_DELAY * (attempt + 1));
                continue;
            }
            
            throw error;
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ネットワーク情報取得（簡略化）
function getNetworkInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
        type: connection ? connection.effectiveType : 'unknown',
        downlink: connection ? connection.downlink : 'unknown',
        rtt: connection ? connection.rtt : 'unknown',
        saveData: connection ? connection.saveData : false
    };
}

// リクエストボディをGemini API形式に変換
function convertToGeminiFormat(requestBody) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('APIキーが設定されていません');
    }
    
    // 履歴をGemini形式に変換
    const contents = [];
    
    // システムプロンプトがある場合は追加
    if (requestBody.systemPrompt) {
        contents.push({
            role: 'user',
            parts: [{ text: requestBody.systemPrompt }]
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'システムプロンプトを理解しました。' }]
        });
    }
    
    // 履歴を追加
    requestBody.history.forEach(msg => {
        const role = msg.role === 'user' ? 'user' : 'model';
        const parts = msg.parts.map(part => {
            if (part.text) {
                return { text: part.text };
            } else if (part.inline_data) {
                return { 
                    inline_data: {
                        mime_type: part.inline_data.mime_type,
                        data: part.inline_data.data
                    }
                };
            } else if (part.file) {
                // 古い形式のfileフィールドをinline_dataに変換
                return {
                    inline_data: {
                        mime_type: part.file.mime_type,
                        data: part.file.data
                    }
                };
            }
            return part;
        });
        contents.push({ role, parts });
    });
    
    // 現在のメッセージを追加
    const currentParts = [{ text: requestBody.message }];
    
    // ファイルがある場合は追加
    if (requestBody.files && requestBody.files.length > 0) {
        requestBody.files.forEach(file => {
            currentParts.push({
                inline_data: {
                    mime_type: file.mime_type,
                    data: file.data
                }
            });
        });
    }
    
    contents.push({
        role: 'user',
        parts: currentParts
    });
    
    // モデル選択
    let modelName = requestBody.selectedModel || 'gemini-1.5-flash-latest';
    if (modelName === 'auto' || !modelName) {
        modelName = 'gemini-1.5-flash-latest';
    }
    
    // Web検索が有効な場合の処理
    const tools = requestBody.useWebSearch ? [{ google_search_retrieval: {} }] : undefined;
    
    return {
        model: modelName,
        contents,
        generationConfig: {
            temperature: requestBody.generationConfig.temperature,
            topP: requestBody.generationConfig.top_p,
            topK: requestBody.generationConfig.top_k,
            maxOutputTokens: requestBody.generationConfig.max_output_tokens
        },
        tools,
        apiKey
    };
}

// メッセージ送信
export async function sendMessage(requestBody, callbacks) {
    const { onChunk, onComplete, onError } = callbacks;
    
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('APIキーが設定されていません。設定画面でAPIキーを入力してください。');
        }
        
        const geminiRequest = convertToGeminiFormat(requestBody);
        const modelName = geminiRequest.model;
        
        console.log('📤 Sending request to Gemini API:', {
            model: modelName,
            contentsLength: geminiRequest.contents.length,
            useWebSearch: requestBody.useWebSearch,
            stream: requestBody.stream
        });
        
        const url = requestBody.stream 
            ? `${GEMINI_API_BASE_URL}/models/${modelName}:streamGenerateContent?key=${apiKey}`
            : `${GEMINI_API_BASE_URL}/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: geminiRequest.contents,
                generationConfig: geminiRequest.generationConfig,
                tools: geminiRequest.tools
            })
        });
        
        console.log('📡 Gemini API response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let errorMessage = 'Gemini APIでエラーが発生しました。';
            
            if (errorData.error) {
                errorMessage = errorData.error.message || errorMessage;
                
                // Web検索関連エラーの特別処理
                if (errorMessage.includes('Search Grounding is not supported')) {
                    errorMessage = `⚠️ Web検索エラー\n\n選択されたモデルはWeb検索機能をサポートしていません。\n\n解決方法：\n1. 設定でWeb検索を無効にする\n2. または、Web検索対応モデル（例：gemini-1.5-pro-latest）を選択する`;
                }
            }
            
            throw new Error(errorMessage);
        }
        
        if (requestBody.stream) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('✅ Stream completed');
                    onComplete();
                    break;
                }
                
                const textChunk = decoder.decode(value);
                const lines = textChunk.split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.candidates && data.candidates[0]?.content?.parts) {
                                const text = data.candidates[0].content.parts[0]?.text || '';
                                if (text) {
                                    onChunk(text);
                                }
                            }
                        } catch (parseError) {
                            console.error('❌ Failed to parse stream data:', line, parseError);
                        }
                    }
                }
            }
        } else {
            const data = await response.json();
            console.log('✅ Non-stream response received');
            
            if (data.candidates && data.candidates[0]?.content?.parts) {
                const text = data.candidates[0].content.parts[0]?.text || '';
                onChunk(text);
            }
            
            onComplete();
        }
        
    } catch (error) {
        console.error('❌ Gemini API通信エラー:', error);
        networkRetryAttempts++;
        
        let errorMessage = 'Gemini API通信でエラーが発生しました。';
        
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        
        // ネットワークエラーの場合の詳細説明
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
            errorMessage += '\n\nネットワーク接続を確認してください。';
        }
        
        onError(errorMessage);
    }
}

// 利用可能なモデル一覧を取得
export async function fetchAvailableModels() {
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('APIキーが設定されていません。設定画面でAPIキーを入力してください。');
        }
        
        console.log('📋 Gemini モデル一覧を取得中...');
        
        const response = await fetchWithRetry(`${GEMINI_MODELS_URL}?key=${apiKey}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('📡 Gemini Models API response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTPエラー ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.models || !Array.isArray(data.models)) {
            throw new Error('モデルデータの形式が正しくありません');
        }
        
        // デバッグ: 生のモデルデータをログ出力
        console.log('🔍 Raw models data:', data.models.length, 'models found');
        data.models.forEach(model => {
            console.log(`📋 Model: ${model.name}`, {
                displayName: model.displayName,
                supportedGenerationMethods: model.supportedGenerationMethods,
                description: model.description?.substring(0, 100) + '...'
            });
        });
        
        // フィルタリング条件を緩和
        const models = data.models
            .filter(model => {
                // 基本条件：名前があること
                if (!model.name) return false;
                
                // generateContentまたはstreamGenerateContentをサポートしているもの
                const supportedMethods = model.supportedGenerationMethods || [];
                const supportsGeneration = supportedMethods.includes('generateContent') || 
                                         supportedMethods.includes('streamGenerateContent');
                
                // プレビューモデルは特別に許可
                const isPreviewModel = model.name.includes('preview');
                
                // embedding専用モデルは除外
                const isEmbeddingOnly = model.name.includes('embedding') && 
                                       !supportedMethods.includes('generateContent');
                
                return (supportsGeneration || isPreviewModel) && !isEmbeddingOnly;
            })
            .map(model => ({
                name: model.name.replace('models/', ''),
                display_name: model.displayName || model.name.replace('models/', ''),
                description: model.description || '',
                version: model.version || '1.0',
                input_token_limit: model.inputTokenLimit || 32000,
                output_token_limit: model.outputTokenLimit || 8192,
                supported_generation_methods: model.supportedGenerationMethods || ['generateContent']
            }))
            .sort((a, b) => {
                // ソート順序: 最新 > Pro > Flash > プレビュー > その他
                const priority = (name) => {
                    if (name.includes('latest')) return 1;
                    if (name.includes('pro')) return 2;
                    if (name.includes('flash')) return 3;
                    if (name.includes('preview')) return 4;
                    return 5;
                };
                return priority(a.name) - priority(b.name);
            });
        
        console.log('✅ フィルタリング後のモデル一覧:', models.length, '個のモデル');
        models.forEach(model => {
            console.log(`✓ ${model.name} (${model.display_name})`);
        });
        
        // 特定のモデルが含まれているかチェック
        const targetModel = 'gemini-2.5-pro-preview-06-05';
        const hasTargetModel = models.some(model => model.name === targetModel);
        console.log(`🎯 ${targetModel} is available:`, hasTargetModel);
        
        return models;
        
    } catch (error) {
        console.error('❌ モデル一覧取得エラー:', error);
        throw error;
    }
}

// APIキー関連の関数をエクスポート
export { getApiKey, setApiKey, validateApiKey };

// デバッグ用のグローバル関数
window.debugGeminiModels = async function() {
    try {
        console.log('🔍 デバッグ: モデル一覧の詳細確認');
        const apiKey = getApiKey();
        if (!apiKey) {
            console.error('❌ APIキーが設定されていません');
            return;
        }
        
        const response = await fetch(`${GEMINI_MODELS_URL}?key=${apiKey}`);
        const data = await response.json();
        
        console.log('📋 全モデル一覧:', data.models.length, '個');
        console.table(data.models.map(model => ({
            name: model.name.replace('models/', ''),
            displayName: model.displayName,
            supportedGenerationMethods: model.supportedGenerationMethods?.join(', '),
            description: model.description?.substring(0, 50) + '...'
        })));
        
        // 特定モデルの検索
        const targetModel = 'gemini-2.5-pro-preview-06-05';
        const found = data.models.find(model => 
            model.name.includes(targetModel) || model.displayName?.includes(targetModel)
        );
        
        if (found) {
            console.log('🎯 Target model found:', found);
        } else {
            console.log('❌ Target model not found:', targetModel);
            
            // 類似モデルを検索
            const similar = data.models.filter(model => 
                model.name.includes('2.5') || model.name.includes('preview')
            );
            console.log('🔍 Similar models:', similar);
        }
        
        return data.models;
    } catch (error) {
        console.error('❌ デバッグエラー:', error);
    }
};

// モデル手動追加用の関数
window.addCustomModel = function(modelName) {
    console.log(`➕ カスタムモデルを追加: ${modelName}`);
    const manualToggle = document.getElementById('manual-model-toggle');
    const manualInput = document.getElementById('manual-model-input');
    
    if (manualToggle && manualInput) {
        manualToggle.checked = true;
        manualInput.style.display = 'block';
        manualInput.value = modelName;
        
        // 設定更新イベントを発行
        manualInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('✅ カスタムモデルが設定されました');
    }
};