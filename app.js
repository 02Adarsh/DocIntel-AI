// ===== State Management =====
const state = {
    endpoint: localStorage.getItem('azure_endpoint') || '',
    apiKey: localStorage.getItem('azure_apiKey') || '',
    isConnected: false,
    selectedFile: null,
    history: JSON.parse(localStorage.getItem('analysis_history') || '[]'),
    currentResults: null
};

// ===== DOM Elements =====
const elements = {
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    sections: document.querySelectorAll('.section'),
    
    // Connection
    connectionStatus: document.getElementById('connectionStatus'),
    
    // Settings
    settingsForm: document.getElementById('settingsForm'),
    endpointInput: document.getElementById('endpoint'),
    apiKeyInput: document.getElementById('apiKey'),
    toggleKeyBtn: document.getElementById('toggleKey'),
    testConnectionBtn: document.getElementById('testConnection'),
    
    // Upload
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    
    // Results
    resultsArea: document.getElementById('resultsArea'),
    resultsContent: document.getElementById('resultsContent'),
    exportBtn: document.getElementById('exportBtn'),
    
    // History
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    
    // Stats
    totalDocs: document.getElementById('totalDocs'),
    successRate: document.getElementById('successRate'),
    lastAnalysis: document.getElementById('lastAnalysis'),
    modelsUsed: document.getElementById('modelsUsed'),
    
    // UI
    toast: document.getElementById('toast'),
    loadingOverlay: document.getElementById('loadingOverlay')
};

// ===== Initialize =====
function init() {
    loadSettings();
    setupEventListeners();
    updateStats();
    renderHistory();
    checkConnection();
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(item.dataset.section);
        });
    });
    
    // Settings
    elements.settingsForm.addEventListener('submit', saveSettings);
    elements.toggleKeyBtn.addEventListener('click', toggleKeyVisibility);
    elements.testConnectionBtn.addEventListener('click', testConnection);
    
    // Upload
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);
    
    // Analyze
    elements.analyzeBtn.addEventListener('click', analyzeDocument);
    
    // Export
    elements.exportBtn.addEventListener('click', exportResults);
    
    // History
    elements.clearHistoryBtn.addEventListener('click', clearHistory);
}

// ===== Navigation =====
function showSection(sectionId) {
    elements.sections.forEach(section => {
        section.classList.remove('active');
    });
    elements.navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
}

// Make showSection globally accessible
window.showSection = showSection;

// ===== Settings =====
function loadSettings() {
    elements.endpointInput.value = state.endpoint;
    elements.apiKeyInput.value = state.apiKey;
}

function saveSettings(e) {
    e.preventDefault();
    
    state.endpoint = elements.endpointInput.value.trim();
    state.apiKey = elements.apiKeyInput.value.trim();
    
    // Ensure endpoint ends without trailing slash
    if (state.endpoint.endsWith('/')) {
        state.endpoint = state.endpoint.slice(0, -1);
    }
    
    localStorage.setItem('azure_endpoint', state.endpoint);
    localStorage.setItem('azure_apiKey', state.apiKey);
    
    showToast('Settings saved successfully!', 'success');
    checkConnection();
}

function toggleKeyVisibility() {
    const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
    elements.apiKeyInput.type = type;
}

async function testConnection() {
    if (!state.endpoint || !state.apiKey) {
        showToast('Please enter endpoint and API key first', 'warning');
        return;
    }
    
    elements.testConnectionBtn.disabled = true;
    elements.testConnectionBtn.innerHTML = '<span class="loader-spinner" style="width:18px;height:18px;margin:0;border-width:2px;"></span> Testing...';
    
    try {
        const response = await fetch(`${state.endpoint}/formrecognizer/documentModels?api-version=2023-07-31`, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': state.apiKey
            }
        });
        
        if (response.ok) {
            state.isConnected = true;
            updateConnectionStatus(true);
            showToast('Connection successful!', 'success');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        state.isConnected = false;
        updateConnectionStatus(false);
        showToast(`Connection failed: ${error.message}`, 'error');
    } finally {
        elements.testConnectionBtn.disabled = false;
        elements.testConnectionBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Test Connection
        `;
    }
}

function checkConnection() {
    if (state.endpoint && state.apiKey) {
        testConnection();
    }
}

function updateConnectionStatus(connected) {
    const indicator = elements.connectionStatus.querySelector('.status-indicator');
    const text = elements.connectionStatus.querySelector('span');
    
    if (connected) {
        indicator.className = 'status-indicator connected';
        text.textContent = 'Connected';
    } else {
        indicator.className = 'status-indicator disconnected';
        text.textContent = 'Not Connected';
    }
}

// ===== File Upload =====
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        selectFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file) {
        selectFile(file);
    }
}

function selectFile(file) {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/bmp'];
    
    if (!validTypes.includes(file.type)) {
        showToast('Invalid file type. Please upload PDF, JPEG, PNG, TIFF, or BMP.', 'error');
        return;
    }
    
    state.selectedFile = file;
    elements.uploadArea.classList.add('has-file');
    
    // Update upload area UI
    elements.uploadArea.innerHTML = `
        <div class="upload-icon" style="background: linear-gradient(135deg, #107c10, #00b294);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <h3>File Selected</h3>
        <div class="file-name">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            ${file.name}
        </div>
        <p style="margin-top: 12px; font-size: 0.875rem;">Click to change file</p>
    `;
    
    elements.analyzeBtn.disabled = !state.isConnected;
    
    if (!state.isConnected) {
        showToast('Please configure API settings first', 'warning');
    }
}

// ===== Document Analysis =====
async function analyzeDocument() {
    if (!state.selectedFile || !state.isConnected) {
        showToast('Please select a file and configure API settings', 'warning');
        return;
    }
    
    const selectedModel = document.querySelector('input[name="model"]:checked').value;
    
    showLoading(true);
    
    try {
        // Step 1: Submit document for analysis
        const fileBytes = await state.selectedFile.arrayBuffer();
        
        const submitResponse = await fetch(
            `${state.endpoint}/formrecognizer/documentModels/${selectedModel}:analyze?api-version=2023-07-31`,
            {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': state.apiKey,
                    'Content-Type': state.selectedFile.type
                },
                body: fileBytes
            }
        );
        
        if (!submitResponse.ok) {
            const errorData = await submitResponse.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${submitResponse.status}`);
        }
        
        const operationLocation = submitResponse.headers.get('Operation-Location');
        
        if (!operationLocation) {
            throw new Error('No operation location returned');
        }
        
        // Step 2: Poll for results
        let result = null;
        let attempts = 0;
        const maxAttempts = 60;
        
        while (attempts < maxAttempts) {
            await sleep(1000);
            
            const resultResponse = await fetch(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': state.apiKey
                }
            });
            
            if (!resultResponse.ok) {
                throw new Error(`Failed to get results: HTTP ${resultResponse.status}`);
            }
            
            result = await resultResponse.json();
            
            if (result.status === 'succeeded') {
                break;
            } else if (result.status === 'failed') {
                throw new Error(result.error?.message || 'Analysis failed');
            }
            
            attempts++;
        }
        
        if (!result || result.status !== 'succeeded') {
            throw new Error('Analysis timed out');
        }
        
        // Process and display results
        state.currentResults = result;
        displayResults(result, selectedModel);
        
        // Add to history
        addToHistory({
            fileName: state.selectedFile.name,
            model: selectedModel,
            timestamp: new Date().toISOString(),
            results: result
        });
        
        showToast('Document analyzed successfully!', 'success');
        
    } catch (error) {
        console.error('Analysis error:', error);
        showToast(`Analysis failed: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function displayResults(result, model) {
    elements.resultsArea.style.display = 'block';
    
    const analyzeResult = result.analyzeResult;
    let html = '';
    
    // Content/Text
    if (analyzeResult.content) {
        html += `
            <div class="result-section">
                <h4>Extracted Text</h4>
                <div class="result-text">${escapeHtml(analyzeResult.content)}</div>
            </div>
        `;
    }
    
    // Key-Value Pairs (for invoices, receipts, etc.)
    if (analyzeResult.documents && analyzeResult.documents.length > 0) {
        const doc = analyzeResult.documents[0];
        if (doc.fields && Object.keys(doc.fields).length > 0) {
            html += `
                <div class="result-section">
                    <h4>Extracted Fields</h4>
                    <table class="result-table">
                        <thead>
                            <tr>
                                <th>Field</th>
                                <th>Value</th>
                                <th>Confidence</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            for (const [key, field] of Object.entries(doc.fields)) {
                if (field) {
                    const value = formatFieldValue(field);
                    const confidence = field.confidence ? (field.confidence * 100).toFixed(1) : 'N/A';
                    const confidenceClass = getConfidenceClass(field.confidence);
                    
                    html += `
                        <tr>
                            <td><strong>${formatFieldName(key)}</strong></td>
                            <td>${escapeHtml(value)}</td>
                            <td><span class="confidence-badge ${confidenceClass}">${confidence}%</span></td>
                        </tr>
                    `;
                }
            }
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
    }
    
    // Tables
    if (analyzeResult.tables && analyzeResult.tables.length > 0) {
        html += `<div class="result-section"><h4>Tables (${analyzeResult.tables.length})</h4>`;
        
        analyzeResult.tables.forEach((table, index) => {
            html += `<p style="margin: 12px 0; font-weight: 500;">Table ${index + 1} (${table.rowCount} rows × ${table.columnCount} columns)</p>`;
            html += '<table class="result-table"><tbody>';
            
            // Create a 2D array to hold cells
            const grid = Array(table.rowCount).fill(null).map(() => Array(table.columnCount).fill(''));
            
            table.cells.forEach(cell => {
                grid[cell.rowIndex][cell.columnIndex] = cell.content || '';
            });
            
            grid.forEach((row, rowIndex) => {
                html += '<tr>';
                row.forEach(cell => {
                    const tag = rowIndex === 0 ? 'th' : 'td';
                    html += `<${tag}>${escapeHtml(cell)}</${tag}>`;
                });
                html += '</tr>';
            });
            
            html += '</tbody></table>';
        });
        
        html += '</div>';
    }
    
    // Pages info
    if (analyzeResult.pages && analyzeResult.pages.length > 0) {
        html += `
            <div class="result-section">
                <h4>Document Info</h4>
                <table class="result-table">
                    <thead>
                        <tr>
                            <th>Page</th>
                            <th>Dimensions</th>
                            <th>Lines</th>
                            <th>Words</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        analyzeResult.pages.forEach((page, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${page.width?.toFixed(0) || 'N/A'} × ${page.height?.toFixed(0) || 'N/A'} ${page.unit || ''}</td>
                    <td>${page.lines?.length || 0}</td>
                    <td>${page.words?.length || 0}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
    }
    
    elements.resultsContent.innerHTML = html;
}

function formatFieldValue(field) {
    if (!field) return '';
    
    if (field.type === 'currency' && field.valueCurrency) {
        return `${field.valueCurrency.currencySymbol || '$'}${field.valueCurrency.amount?.toFixed(2) || field.content || ''}`;
    }
    
    if (field.type === 'date' && field.valueDate) {
        return new Date(field.valueDate).toLocaleDateString();
    }
    
    if (field.type === 'array' && field.valueArray) {
        return field.valueArray.map(item => formatFieldValue(item)).join(', ');
    }
    
    if (field.type === 'object' && field.valueObject) {
        return Object.entries(field.valueObject)
            .map(([k, v]) => `${formatFieldName(k)}: ${formatFieldValue(v)}`)
            .join('; ');
    }
    
    return field.content || field.valueString || field.valueNumber?.toString() || '';
}

function formatFieldName(name) {
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

function getConfidenceClass(confidence) {
    if (!confidence) return 'medium';
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
}

function exportResults() {
    if (!state.currentResults) {
        showToast('No results to export', 'warning');
        return;
    }
    
    const blob = new Blob([JSON.stringify(state.currentResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Results exported!', 'success');
}

// ===== History =====
function addToHistory(item) {
    state.history.unshift(item);
    if (state.history.length > 50) {
        state.history.pop();
    }
    localStorage.setItem('analysis_history', JSON.stringify(state.history));
    renderHistory();
    updateStats();
}

function renderHistory() {
    if (state.history.length === 0) {
        elements.historyList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <h3>No history yet</h3>
                <p>Your analyzed documents will appear here</p>
            </div>
        `;
        return;
    }
    
    const modelIcons = {
        'prebuilt-read': '📄',
        'prebuilt-layout': '📐',
        'prebuilt-invoice': '🧾',
        'prebuilt-receipt': '🧾',
        'prebuilt-idDocument': '🪪',
        'prebuilt-businessCard': '💼'
    };
    
    elements.historyList.innerHTML = state.history.map((item, index) => `
        <div class="history-item">
            <div class="history-info">
                <div class="history-icon">${modelIcons[item.model] || '📄'}</div>
                <div class="history-details">
                    <h4>${escapeHtml(item.fileName)}</h4>
                    <span>${formatDate(item.timestamp)} • ${formatModelName(item.model)}</span>
                </div>
            </div>
            <div class="history-actions">
                <button class="history-btn view" onclick="viewHistoryItem(${index})">View</button>
                <button class="history-btn" onclick="deleteHistoryItem(${index})">Delete</button>
            </div>
        </div>
    `).join('');
}

window.viewHistoryItem = function(index) {
    const item = state.history[index];
    if (item) {
        state.currentResults = item.results;
        displayResults(item.results, item.model);
        showSection('analyze');
    }
};

window.deleteHistoryItem = function(index) {
    state.history.splice(index, 1);
    localStorage.setItem('analysis_history', JSON.stringify(state.history));
    renderHistory();
    updateStats();
    showToast('Item deleted', 'success');
};

function clearHistory() {
    if (confirm('Are you sure you want to clear all history?')) {
        state.history = [];
        localStorage.setItem('analysis_history', '[]');
        renderHistory();
        updateStats();
        showToast('History cleared', 'success');
    }
}

// ===== Stats =====
function updateStats() {
    const total = state.history.length;
    elements.totalDocs.textContent = total;
    elements.successRate.textContent = total > 0 ? '100%' : '0%';
    
    if (total > 0) {
        elements.lastAnalysis.textContent = formatDate(state.history[0].timestamp);
        
        const uniqueModels = new Set(state.history.map(h => h.model));
        elements.modelsUsed.textContent = uniqueModels.size;
    } else {
        elements.lastAnalysis.textContent = 'Never';
        elements.modelsUsed.textContent = '0';
    }
}

// ===== Utilities =====
function showToast(message, type = 'info') {
    const toast = elements.toast;
    toast.className = `toast ${type} show`;
    toast.querySelector('.toast-message').textContent = message;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading(show) {
    elements.loadingOverlay.classList.toggle('show', show);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatModelName(model) {
    const names = {
        'prebuilt-read': 'Read',
        'prebuilt-layout': 'Layout',
        'prebuilt-invoice': 'Invoice',
        'prebuilt-receipt': 'Receipt',
        'prebuilt-idDocument': 'ID Document',
        'prebuilt-businessCard': 'Business Card'
    };
    return names[model] || model;
}

// ===== Start the app =====
document.addEventListener('DOMContentLoaded', init);
