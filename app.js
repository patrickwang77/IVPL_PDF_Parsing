// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

// --- Tab Switching Logic ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    if (tabId === 'matching') {
        document.getElementById('tab-btn-matching').classList.add('active');
        document.getElementById('pane-matching').classList.add('active');
        document.getElementById('pane-matching').style.display = 'grid';
        document.getElementById('pane-sdss').style.display = 'none';
    } else if (tabId === 'sdss') {
        document.getElementById('tab-btn-sdss').classList.add('active');
        document.getElementById('pane-sdss').classList.add('active');
        document.getElementById('pane-matching').style.display = 'none';
        document.getElementById('pane-sdss').style.display = 'grid';
    }
}
window.switchTab = switchTab;

// ==========================================
// ============= TAB 1: ORIGINAL ============
// ==========================================

// DOM Elements
const unifiedDropZone = document.getElementById('unified-drop-zone');
const unifiedFileInput = document.getElementById('unified-file-input');
const dropPrompt = document.getElementById('drop-prompt');
const classifiedFileList = document.getElementById('classified-file-list');

const plItemCard = document.getElementById('pl-item');
const plNameLabel = document.getElementById('pl-name-label');

const eiItemCard = document.getElementById('ei-item');
const eiNameLabel = document.getElementById('ei-name-label');

const btnRun = document.getElementById('btn-run');
const btnClearFiles = document.getElementById('btn-clear-files');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const progressContainer = document.getElementById('progress-container');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressDetail = document.getElementById('progress-detail');
const progressPercent = document.getElementById('progress-percent');
const infoBox = document.getElementById('info-box');
const infoText = document.getElementById('info-text');

const btnExportXlsx = document.getElementById('btn-export-xlsx');
const btnExportCsv = document.getElementById('btn-export-csv');

const tablePlaceholder = document.getElementById('table-placeholder');
const dataTable = document.getElementById('data-table');
const tableBody = document.getElementById('table-body');
const previewCount = document.getElementById('preview-count');
const btnClearPreview = document.getElementById('btn-clear-preview');

// Format Configuration and Schema definition
const FORMAT_CONFIGS = {
    TAIJI: {
        key: 'TAIJI',
        name: 'TaiJi Suzhou (11欄)',
        badgeClass: 'taiji',
        headers: ['日期', '提單號碼', 'STO號碼', 'SSD 料號', '數量', '單價', '單位', 'storage loc', '淨重', '毛重', '箱數'],
        exportFileName: 'template.xlsx',
        parse: parseTaiJi
    },
    SDSM: {
        key: 'SDSM',
        name: 'SDSM SanDisk (13欄)',
        badgeClass: 'sdsm',
        headers: ['日期', 'STO #', 'Line', 'QSS 料號', '數量', '廠商', '預計入庫倉', '出貨指示類型', 'AI#', '單價', '淨重', '毛重', '箱數'],
        exportFileName: 'template.xlsx',
        parse: parseSDSM
    }
};

// Application State
let plFile = null;
let eiFile = null;
let detectedFormat = null; // 'TAIJI' | 'SDSM' | null
let mappedResultRows = []; // cumulative list of mapped rows: each is an array

// Setup Unified Drag and Drop
unifiedDropZone.addEventListener('click', () => unifiedFileInput.click());

unifiedFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
});

unifiedDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    unifiedDropZone.classList.add('dragover');
});

unifiedDropZone.addEventListener('dragleave', () => {
    unifiedDropZone.classList.remove('dragover');
});

unifiedDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    unifiedDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
    }
});

// Classify and handle selected files
function handleFiles(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const name = file.name.toUpperCase();
        
        // Simple name-based classification supporting PL/Packing/P and EI/Invoice/I
        if (name.includes('PL') || name.includes('PACKING') || name.endsWith('P.PDF') || name.endsWith('_P.PDF')) {
            plFile = file;
        } else if (name.includes('EI') || name.includes('INVOICE') || name.includes('COMMERCIAL') || name.endsWith('I.PDF') || name.endsWith('_I.PDF')) {
            eiFile = file;
        }
    }
    
    updateFileSelectorUI();
}

// Update file uploading card state
function updateFileSelectorUI() {
    if (plFile || eiFile) {
        dropPrompt.style.display = 'none';
        classifiedFileList.style.display = 'flex';
        btnClearFiles.disabled = false;
    } else {
        dropPrompt.style.display = 'flex';
        classifiedFileList.style.display = 'none';
        btnClearFiles.disabled = true;
    }
    
    // PL file state
    if (plFile) {
        plItemCard.classList.remove('missing');
        plNameLabel.textContent = `${plFile.name} (${formatBytes(plFile.size)})`;
    } else {
        plItemCard.classList.add('missing');
        plNameLabel.textContent = '尚未載入';
    }
    
    // EI file state
    if (eiFile) {
        eiItemCard.classList.remove('missing');
        eiNameLabel.textContent = `${eiFile.name} (${formatBytes(eiFile.size)})`;
    } else {
        eiItemCard.classList.add('missing');
        eiNameLabel.textContent = '尚未載入';
    }
    
    // Check if both are ready
    if (plFile && eiFile) {
        btnRun.disabled = false;
        statusDot.className = 'status-dot idel';
        statusText.textContent = '來源檔案就緒，點擊 Run 開始解析對照...';
    } else {
        btnRun.disabled = true;
        statusDot.className = 'status-dot idel';
        if (plFile) {
            statusText.textContent = '已載入 Packing List，請拖入對應的 EI PDF...';
        } else if (eiFile) {
            statusText.textContent = '已載入 EI PDF，請拖入對應的 Packing List...';
        } else {
            statusText.textContent = '請先載入 PDF 檔案...';
        }
    }
}

// Update detected format badge on UI
function updateFormatBadge(formatKey) {
    const badge = document.getElementById('detected-format-badge');
    if (!formatKey) {
        badge.style.display = 'none';
        badge.className = 'format-badge-ui';
        badge.textContent = '';
        return;
    }
    
    const config = FORMAT_CONFIGS[formatKey];
    badge.className = `format-badge-ui ${config.badgeClass}`;
    badge.textContent = `偵測格式：${config.name}`;
    badge.style.display = 'inline-block';
}

// Clear currently selected files
btnClearFiles.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent triggering input click
    clearUploadedFiles();
});

function clearUploadedFiles() {
    plFile = null;
    eiFile = null;
    unifiedFileInput.value = '';
    updateFileSelectorUI();
}

// Progress bar updater
function updateProgress(percent, text) {
    progressContainer.style.display = 'flex';
    progressBarFill.style.width = `${percent}%`;
    progressDetail.textContent = text;
    progressPercent.textContent = `${percent}%`;
}

// Format file size
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Convert PDF file to flat string of text in natural reading order
async function extractPdfTextFlat(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    let fullText = "";

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const items = textContent.items;
        if (items.length === 0) continue;
        
        // Group items that have similar y coordinate (within 3px tolerance)
        const lineGroups = [];
        items.forEach(item => {
            const x = item.transform[4];
            const y = item.transform[5];
            
            let foundGroup = lineGroups.find(g => Math.abs(g.y - y) < 3.0);
            if (!foundGroup) {
                foundGroup = { y: y, items: [] };
                lineGroups.push(foundGroup);
            }
            foundGroup.items.push({ x: x, str: item.str });
        });
        
        // Sort line groups top to bottom (y descending)
        lineGroups.sort((a, b) => b.y - a.y);
        
        // Sort items in each line left to right (x ascending)
        const pageLines = lineGroups.map(group => {
            group.items.sort((a, b) => a.x - b.x);
            return group.items.map(item => item.str).join(" ");
        });
        
        fullText += `\n--- Page ${pageNum} ---\n` + pageLines.join("\n");
    }

    return fullText;
}

// Clear all mapped data in the preview panel
btnClearPreview.addEventListener('click', () => {
    mappedResultRows = [];
    detectedFormat = null;
    updateFormatBadge(null);
    renderPreviewTable();
    updateExportButtons();
    
    infoBox.style.background = 'rgba(139, 92, 246, 0.05)';
    infoBox.style.borderColor = 'rgba(139, 92, 246, 0.15)';
    infoText.innerHTML = `已清空所有轉換資料。請上傳配對檔案點擊 Run 重新產生。`;
});

// Run mapping on the currently uploaded files
btnRun.addEventListener('click', async () => {
    if (!plFile || !eiFile) return;

    try {
        btnRun.disabled = true;
        btnClearFiles.disabled = true;
        
        const currentPlName = plFile.name;
        const currentEiName = eiFile.name;

        // Step 1: Read PDF Texts
        updateProgress(15, '正在讀取 Packing List PDF...');
        const plText = await extractPdfTextFlat(plFile);

        updateProgress(35, '正在讀取 EI PDF...');
        const eiText = await extractPdfTextFlat(eiFile);

        // Step 2: Format Detection
        updateProgress(50, '偵測檔案格式特徵...');
        const newFormat = detectFormat(plText, eiText);
        if (!newFormat) {
            throw new Error("無法辨識該 PDF 檔案的特徵格式，請確認是否為 SDSM 或 TaiJi 相關文件。");
        }

        // If the format changed from what is currently displayed, clear preview to prevent column mismatch
        if (mappedResultRows.length > 0 && detectedFormat !== newFormat) {
            mappedResultRows = [];
        }
        detectedFormat = newFormat;
        updateFormatBadge(detectedFormat);

        // Step 3: Run Flow Specific Parser
        updateProgress(75, `執行 ${FORMAT_CONFIGS[detectedFormat].name} 解析器...`);
        const newResultRows = FORMAT_CONFIGS[detectedFormat].parse(plText, eiText);

        // Append to global state
        mappedResultRows = mappedResultRows.concat(newResultRows);

        // Step 4: Render UI Table
        updateProgress(95, '正在更新預覽表格...');
        renderPreviewTable();
        updateExportButtons();

        // Complete UI reset for next files
        updateProgress(100, '完成對照解析！');
        statusDot.className = 'status-dot completed';
        statusText.textContent = `解析完成！自動辨識為 [${FORMAT_CONFIGS[detectedFormat].name}]，本次新增 ${newResultRows.length} 筆資料，累計共 ${mappedResultRows.length} 筆。`;

        // Clear uploaded files in selector to prepare for the next drop
        clearUploadedFiles();

        // Check for missing prices
        const priceColIndex = detectedFormat === 'TAIJI' ? 5 : 9;
        const missingPriceCount = newResultRows.filter(row => row[priceColIndex] === '').length;
        if (missingPriceCount > 0) {
            infoBox.style.background = 'rgba(239, 68, 68, 0.05)';
            infoBox.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            infoText.innerHTML = `<span style="color: #ef4444; font-weight: 600;">警告：</span>本次新增項目中，有 <strong>${missingPriceCount}</strong> 筆單價未能在 EI 檔中尋獲，已呈現列表底部（紅色標記）。`;
        } else {
            infoBox.style.background = 'rgba(16, 185, 129, 0.05)';
            infoBox.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            infoText.innerHTML = `<span style="color: #10b981; font-weight: 600;">成功：</span>自動特徵對照成功！資料已追加至預覽表，您可以繼續拖曳下一組同格式檔案追加解析，或點擊下方按鈕匯出。`;
        }

    } catch (error) {
        console.error(error);
        statusDot.className = 'status-dot error';
        statusText.textContent = '解析失敗！';
        updateProgress(0, '處理出錯');
        
        infoBox.style.background = 'rgba(239, 68, 68, 0.05)';
        infoBox.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        infoText.innerHTML = `<span style="color: #ef4444; font-weight: 600;">錯誤訊息：</span>${error.message}`;
        
        btnClearFiles.disabled = false;
        updateFileSelectorUI();
    }
});

// Smart detector based on string keywords
function detectFormat(plText, eiText) {
    const textCombined = (plText + " " + eiText).toUpperCase();
    if (textCombined.includes("TAIJI") || textCombined.includes("TJ26")) {
        return 'TAIJI';
    }
    if (textCombined.includes("SDSM") || textCombined.includes("SANDISK") || textCombined.includes("BATU KAWAN")) {
        return 'SDSM';
    }
    return null;
}

// 1. TaiJi Suzhou parsing logic (11-column SSD format)
function parseTaiJi(plText, eiText) {
    let plParsedData = [];
    let invoicePrices = {};
    let rows = [];

    // Match STO # (PO)
    let stoNo = "";
    const stoMatch = plText.match(/Customer PO\/Sales Order#.*?(\d{10})/i);
    if (stoMatch) {
        stoNo = stoMatch[1];
    } else {
        const fallbackMatch = plText.match(/\b45\d{8}\b/);
        if (fallbackMatch) {
            stoNo = fallbackMatch[0];
        }
    }

    const lines = plText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const plItemRegex = /^(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\w\-]+)\s+(\w+)\s+(\d{4})\s+([\d\.]+)\s+([\d\.]+)\s+(\d+\*\d+\*\d+\s+cm)/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(plItemRegex);
        if (match) {
            const cartonNo = parseInt(match[1], 10);
            const units = parseInt(match[2].replace(/,/g, ''), 10);
            const totalQty = parseInt(match[3].replace(/,/g, ''), 10);
            const partNumber = match[4];
            const lotNo = match[5];
            const dateCode = match[6];
            const netWeight = parseFloat(match[7]);
            const grossWeight = parseFloat(match[8]);
            const measurement = match[9];
            
            let customerLotNo = "";
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (!nextLine.match(/^\d+\s+/) && nextLine.trim().length > 0) {
                    customerLotNo = nextLine.trim();
                }
            }
            
            plParsedData.push({
                cartonNo,
                units,
                totalQty,
                partNumber,
                lotNo,
                dateCode,
                netWeight,
                grossWeight,
                measurement,
                customerLotNo
            });
        }
    }

    if (plParsedData.length === 0) {
        throw new Error(`無法從 Packing List 中提取有效的項目資料。`);
    }

    const plPartNumbers = [...new Set(plParsedData.map(item => item.partNumber))];

    // Parse EI (Invoice)
    const eiLines = eiText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    let currentPartNumber = "";
    
    const invoiceItemRegex = /^\d+\s+[\u4e00-\u9fa5a-zA-Z0-9_\-\s]+?\s+(\w+)\s+(\d{4})\s+PC\s+([\d,]+)\s+([\d\.]+)\s+([\d\.,]+)/i;

    for (let i = 0; i < eiLines.length; i++) {
        const line = eiLines[i];
        
        const matchedPartNo = plPartNumbers.find(pn => line === pn);
        if (matchedPartNo) {
            currentPartNumber = matchedPartNo;
            continue;
        }
        
        const match = line.match(invoiceItemRegex);
        if (match && currentPartNumber) {
            const lotNo = match[1];
            const unitPrice = parseFloat(match[4]);
            
            const key = `${currentPartNumber}_${lotNo}`;
            invoicePrices[key] = unitPrice;
        }
    }

    // Group and Aggregate (Group By: partNumber + unitPrice)
    const today = new Date();
    const formattedDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
    
    const groups = {};
    plParsedData.forEach(item => {
        let unitPrice = invoicePrices[`${item.partNumber}_${item.lotNo}`];
        if (unitPrice === undefined) {
            const siblingKeys = Object.keys(invoicePrices).filter(k => k.startsWith(item.partNumber + "_"));
            if (siblingKeys.length > 0) {
                unitPrice = invoicePrices[siblingKeys[0]];
            } else {
                unitPrice = null;
            }
        }
        
        const priceStr = unitPrice !== null ? unitPrice.toFixed(4) : 'MISSING';
        const groupKey = `${item.partNumber}||${priceStr}`;
        
        if (!groups[groupKey]) {
            groups[groupKey] = {
                partNumber: item.partNumber,
                unitPrice: unitPrice,
                totalQty: 0,
                netWeight: 0.0,
                grossWeight: 0.0,
                cartonCount: 0
            };
        }
        
        groups[groupKey].totalQty += item.totalQty;
        groups[groupKey].netWeight += item.netWeight;
        groups[groupKey].grossWeight += item.grossWeight;
        groups[groupKey].cartonCount += 1;
    });

    Object.keys(groups).forEach(key => {
        const group = groups[key];
        rows.push([
            formattedDate,                         // 日期
            '',                                    // 提單號碼 (留空)
            stoNo,                                 // STO號碼
            group.partNumber,                      // SSD 料號
            group.totalQty,                        // 數量
            group.unitPrice !== null ? group.unitPrice : '', // 單價
            'EA',                                  // 單位
            'FG',                                  // storage loc
            parseFloat(group.netWeight.toFixed(4)),                       // 淨重
            parseFloat(group.grossWeight.toFixed(2)),                     // 毛重
            group.cartonCount                      // 箱數
        ]);
    });

    return rows;
}

// 2. SDSM SanDisk parsing logic (13-column QSS format)
function parseSDSM(plText, eiText) {
    let plParsedData = [];
    let invoicePrices = {};
    let rows = [];

    // Match SDSM PL items
    const lines = plText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const plItemRegex = /^(\d+)\s+([\w\-]+)\s+([\d,]+)\s*EA\s+(\d+)\s+(\d+)\s+([\d\.,]+)\s*KG\s+([\d\.,]+)\s*KG\s+(\d+)/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(plItemRegex);
        if (match) {
            const itemNo = match[1];
            const materialNo = match[2];
            const qty = parseInt(match[3].replace(/,/g, ''), 10);
            const stoNo = match[4];
            const stoLine = match[5];
            const grossWeight = parseFloat(match[6]);
            const netWeight = parseFloat(match[7]);
            const noOfBox = parseInt(match[8], 10);
            
            plParsedData.push({
                itemNo,
                materialNo,
                qty,
                stoNo,
                stoLine,
                grossWeight,
                netWeight,
                noOfBox
            });
        }
    }

    if (plParsedData.length === 0) {
        throw new Error(`無法從 SDSM Packing List 中提取有效的項目資料。`);
    }

    const plPartNumbers = [...new Set(plParsedData.map(item => item.materialNo))];

    // Parse SDSM Invoice
    const eiLines = eiText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    let currentPartNumber = "";
    
    // Details line regex for SDSM: BOM COO Qty AssemblyFee / EA ExtAssemblyFee UnitPrice ExtPrice NetWeight
    const invoiceItemRegex = /^\d+\s+[A-Z]{2}\s+([\d,]+)\s+[\d\.]+\s*\/\s*(?:EA|PC)?\s*[\d\.,]+\s+([\d\.]+)\s+[\d\.,]+/i;

    // Header line: 1 54-82-20056-128G EA 1,597
    const invoiceHeaderRegex = /^\d+\s+([\w\-]+)\s+(?:EA|PC)\s+([\d,]+)/i;

    for (let i = 0; i < eiLines.length; i++) {
        const line = eiLines[i];
        
        const headerMatch = line.match(invoiceHeaderRegex);
        if (headerMatch) {
            const partNo = headerMatch[1];
            if (plPartNumbers.includes(partNo)) {
                currentPartNumber = partNo;
            }
            continue;
        }
        
        const match = line.match(invoiceItemRegex);
        if (match && currentPartNumber) {
            const qty = parseInt(match[1].replace(/,/g, ''), 10);
            const unitPrice = parseFloat(match[2]);
            
            const key = `${currentPartNumber}_${qty}`;
            invoicePrices[key] = unitPrice;
        }
    }

    // Create rows matching SDSM 13-column format
    const today = new Date();
    const formattedDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

    plParsedData.forEach(item => {
        let unitPrice = invoicePrices[`${item.materialNo}_${item.qty}`];
        if (unitPrice === undefined) {
            const siblingKeys = Object.keys(invoicePrices).filter(k => k.startsWith(item.materialNo + "_"));
            if (siblingKeys.length > 0) {
                unitPrice = invoicePrices[siblingKeys[0]];
            } else {
                unitPrice = null;
            }
        }

        let qssMaterialNo = item.materialNo;
        if (!qssMaterialNo.toUpperCase().startsWith('7SD')) {
            qssMaterialNo = '7SD' + qssMaterialNo;
        }

        rows.push([
            formattedDate,                         // 日期
            item.stoNo,                            // STO #
            item.stoLine,                          // Line
            qssMaterialNo,                         // QSS 料號
            item.qty,                              // 數量
            'SHNSSD03',                            // 廠商
            'S01',                                 // 預計入庫倉
            'B2B',                                 // 出貨指示類型
            '\u3000',                              // AI# (全形空白)
            unitPrice !== null ? unitPrice : '',   // 單價
            parseFloat(item.netWeight.toFixed(4)), // 淨重
            parseFloat(item.grossWeight.toFixed(2)),// 毛重
            item.noOfBox                           // 箱數
        ]);
    });

    return rows;
}

// Render Preview HTML Table
function renderPreviewTable() {
    const headerRow = document.getElementById('table-header-row');
    headerRow.innerHTML = '';
    
    if (mappedResultRows.length === 0) {
        tablePlaceholder.style.display = 'flex';
        dataTable.style.display = 'none';
        previewCount.style.display = 'none';
        btnClearPreview.style.display = 'none';
        return;
    }

    const config = FORMAT_CONFIGS[detectedFormat];
    const headers = config.headers;
    
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    });
    
    const actionTh = document.createElement('th');
    actionTh.className = 'action-column';
    actionTh.textContent = '操作';
    headerRow.appendChild(actionTh);

    // Rows
    tableBody.innerHTML = '';
    mappedResultRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        row.forEach((cell, idx) => {
            const td = document.createElement('td');
            
            if (detectedFormat === 'TAIJI') {
                if (idx === 5) { // 單價
                    td.textContent = cell !== '' ? Number(cell).toFixed(4) : '未尋獲';
                    if (cell === '') td.style.color = '#ef4444';
                } else if (idx === 8) { // 淨重
                    td.textContent = cell !== undefined && cell !== '' ? Number(cell).toFixed(4) : '';
                } else if (idx === 9) { // 毛重
                    td.textContent = cell !== undefined && cell !== '' ? Number(cell).toFixed(2) : '';
                } else if (idx === 10) { // 箱數
                    td.textContent = cell !== undefined && cell !== '' ? Number(cell).toString() : '';
                } else {
                    td.textContent = cell;
                }
            } else { // SDSM
                if (idx === 9) { // 單價
                    td.textContent = cell !== '' ? Number(cell).toFixed(4) : '未尋獲';
                    if (cell === '') td.style.color = '#ef4444';
                } else if (idx === 10) { // 淨重
                    td.textContent = cell !== undefined && cell !== '' ? Number(cell).toFixed(4) : '';
                } else if (idx === 11) { // 毛重
                    td.textContent = cell !== undefined && cell !== '' ? Number(cell).toFixed(2) : '';
                } else if (idx === 12) { // 箱數
                    td.textContent = cell !== undefined && cell !== '' ? Number(cell).toString() : '';
                } else {
                    td.textContent = cell;
                }
            }
            
            tr.appendChild(td);
        });
        
        const actionTd = document.createElement('td');
        actionTd.className = 'action-column';
        actionTd.innerHTML = `
            <button class="btn-delete-row" data-idx="${index}" title="刪除此筆">
                <i data-lucide="trash-2"></i>
            </button>
        `;
        tr.appendChild(actionTd);
        tableBody.appendChild(tr);
    });

    tablePlaceholder.style.display = 'none';
    dataTable.style.display = 'table';
    previewCount.style.display = 'inline-block';
    previewCount.textContent = `${mappedResultRows.length} 筆資料`;
    btnClearPreview.style.display = 'flex';
    
    lucide.createIcons();
    bindRowDeleteEvents();
}

function bindRowDeleteEvents() {
    const deleteButtons = tableBody.querySelectorAll('.btn-delete-row');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-idx'), 10);
            deleteRow(idx);
        });
    });
}

function deleteRow(idx) {
    mappedResultRows.splice(idx, 1);
    renderPreviewTable();
    updateExportButtons();
    
    statusDot.className = 'status-dot completed';
    statusText.textContent = `已刪除單筆項目。目前累計 ${mappedResultRows.length} 筆資料。`;
}

function updateExportButtons() {
    const hasData = mappedResultRows.length > 0;
    btnExportXlsx.disabled = !hasData;
    btnExportCsv.disabled = !hasData;
}

btnExportXlsx.addEventListener('click', () => {
    if (mappedResultRows.length === 0 || !detectedFormat) return;

    const config = FORMAT_CONFIGS[detectedFormat];
    const headers = config.headers;
    const wsData = [headers, ...mappedResultRows];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    XLSX.utils.book_append_sheet(wb, ws, '工作表1');
    XLSX.writeFile(wb, config.exportFileName);
});

btnExportCsv.addEventListener('click', () => {
    if (mappedResultRows.length === 0 || !detectedFormat) return;

    const config = FORMAT_CONFIGS[detectedFormat];
    const headers = config.headers;
    const wsData = [headers, ...mappedResultRows];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = config.exportFileName.replace('.xlsx', '.csv');
    a.click();
    
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
});

// ==========================================
// ========== TAB 2: SDSS PDF+EXCEL =========
// ==========================================

// SDSS DOM Elements
const sdssPlDropZone = document.getElementById('sdss-pl-drop-zone');
const sdssPlFileInput = document.getElementById('sdss-pl-file-input');
const sdssPlFileList = document.getElementById('sdss-pl-file-list');

const sdssInvoiceDropZone = document.getElementById('sdss-invoice-drop-zone');
const sdssInvoiceFileInput = document.getElementById('sdss-invoice-file-input');
const sdssInvoiceStatus = document.getElementById('sdss-invoice-status');

const btnSdssRun = document.getElementById('btn-sdss-run');
const btnSdssClearFiles = document.getElementById('btn-sdss-clear-files');

const sdssStatusDot = document.getElementById('sdss-status-dot');
const sdssStatusText = document.getElementById('sdss-status-text');
const sdssProgressContainer = document.getElementById('sdss-progress-container');
const sdssProgressBarFill = document.getElementById('sdss-progress-bar-fill');
const sdssProgressDetail = document.getElementById('sdss-progress-detail');
const sdssProgressPercent = document.getElementById('sdss-progress-percent');
const sdssInfoBox = document.getElementById('sdss-info-box');
const sdssInfoText = document.getElementById('sdss-info-text');

const btnSdssExportXlsx = document.getElementById('btn-sdss-export-xlsx');
const btnSdssExportCsv = document.getElementById('btn-sdss-export-csv');

const sdssTablePlaceholder = document.getElementById('sdss-table-placeholder');
const sdssDataTable = document.getElementById('sdss-data-table');
const sdssTableBody = document.getElementById('sdss-table-body');
const sdssPreviewCount = document.getElementById('sdss-preview-count');
const btnSdssClearPreview = document.getElementById('btn-sdss-clear-preview');

// Tab 2 State
let sdssPlFiles = [];
let sdssInvoiceFile = null;
let sdssResultRows = [];

// Drag and drop for PL PDFs
sdssPlDropZone.addEventListener('click', (e) => {
    if (e.target !== sdssPlFileList && !sdssPlFileList.contains(e.target)) {
        sdssPlFileInput.click();
    }
});
sdssPlFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        addSdssPlFiles(e.target.files);
    }
});
sdssPlDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    sdssPlDropZone.classList.add('dragover');
});
sdssPlDropZone.addEventListener('dragleave', () => {
    sdssPlDropZone.classList.remove('dragover');
});
sdssPlDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    sdssPlDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        addSdssPlFiles(e.dataTransfer.files);
    }
});

function addSdssPlFiles(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.toUpperCase().endsWith('.PDF')) {
            if (!sdssPlFiles.some(f => f.name === file.name && f.size === file.size)) {
                sdssPlFiles.push(file);
            }
        }
    }
    updateSdssFileUI();
}

// Drag and drop for Invoice Excel
sdssInvoiceDropZone.addEventListener('click', () => {
    sdssInvoiceFileInput.click();
});
sdssInvoiceFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        setSdssInvoiceFile(e.target.files[0]);
    }
});
sdssInvoiceDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    sdssInvoiceDropZone.classList.add('dragover');
});
sdssInvoiceDropZone.addEventListener('dragleave', () => {
    sdssInvoiceDropZone.classList.remove('dragover');
});
sdssInvoiceDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    sdssInvoiceDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const ext = file.name.toUpperCase();
        if (ext.endsWith('.XLSX') || ext.endsWith('.XLS')) {
            setSdssInvoiceFile(file);
        }
    }
});

function setSdssInvoiceFile(file) {
    sdssInvoiceFile = file;
    updateSdssFileUI();
}

// Update SDSS file selector UI
function updateSdssFileUI() {
    sdssPlFileList.innerHTML = '';
    if (sdssPlFiles.length === 0) {
        sdssPlFileList.innerHTML = '<span class="item-name" style="color: var(--text-muted);">尚未載入任何 PDF</span>';
    } else {
        sdssPlFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'sdss-file-item';
            item.innerHTML = `
                <i data-lucide="file-text"></i>
                <span class="file-name" title="${file.name}">${file.name}</span>
                <button class="btn-remove-file" data-index="${index}" title="移除">
                    <i data-lucide="x"></i>
                </button>
            `;
            sdssPlFileList.appendChild(item);
        });
        
        sdssPlFileList.querySelectorAll('.btn-remove-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                sdssPlFiles.splice(idx, 1);
                updateSdssFileUI();
            });
        });
    }
    
    sdssInvoiceStatus.innerHTML = '';
    if (!sdssInvoiceFile) {
        sdssInvoiceStatus.innerHTML = '<span class="item-name" style="color: var(--text-muted);">尚未載入 Excel</span>';
    } else {
        const item = document.createElement('div');
        item.className = 'sdss-file-item excel-type';
        item.innerHTML = `
            <i data-lucide="sheet"></i>
            <span class="file-name" title="${sdssInvoiceFile.name}">${sdssInvoiceFile.name}</span>
            <button class="btn-remove-file" id="btn-remove-excel" title="移除">
                <i data-lucide="x"></i>
            </button>
        `;
        sdssInvoiceStatus.appendChild(item);
        
        document.getElementById('btn-remove-excel').addEventListener('click', (e) => {
            e.stopPropagation();
            sdssInvoiceFile = null;
            sdssInvoiceFileInput.value = '';
            updateSdssFileUI();
        });
    }
    
    const hasPl = sdssPlFiles.length > 0;
    const hasInvoice = sdssInvoiceFile !== null;
    
    btnSdssRun.disabled = !(hasPl && hasInvoice);
    btnSdssClearFiles.disabled = !(hasPl || hasInvoice);
    
    if (hasPl && hasInvoice) {
        sdssStatusText.textContent = `來源檔案就緒（PL x ${sdssPlFiles.length} + Excel），點擊 Run 開始對照...`;
    } else if (hasPl) {
        sdssStatusText.textContent = `已載入 ${sdssPlFiles.length} 個 PL，請載入 Invoice Excel 對照檔...`;
    } else if (hasInvoice) {
        sdssStatusText.textContent = `已載入 Excel 對照檔，請載入 PL PDF...`;
    } else {
        sdssStatusText.textContent = '請先載入 PDF 與 Excel 檔案...';
    }
    
    lucide.createIcons();
}

// Clear SDSS uploaded files
btnSdssClearFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    sdssPlFiles = [];
    sdssInvoiceFile = null;
    sdssPlFileInput.value = '';
    sdssInvoiceFileInput.value = '';
    updateSdssFileUI();
});

// Update progress bar for SDSS
function updateSdssProgress(percent, text) {
    sdssProgressContainer.style.display = 'flex';
    sdssProgressBarFill.style.width = `${percent}%`;
    sdssProgressDetail.textContent = text;
    sdssProgressPercent.textContent = `${percent}%`;
}

// Helper to read Excel using FileReader and SheetJS
function readExcelInvoice(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

// Clean and normalize Excel columns and values
function cleanExcelData(jsonRows) {
    return jsonRows.map(row => {
        const getVal = (possibleKeys) => {
            for (const key of Object.keys(row)) {
                if (possibleKeys.includes(key.trim())) {
                    return row[key];
                }
            }
            return null;
        };
        
        const partNo = getVal(['订单料号', '料号', 'Part Number', 'Material Number']);
        const qty = getVal(['数量', 'Quantity', 'Qty']);
        const totalPrice = getVal(['总价1', '总价', 'Total Price', 'Amount']);
        const stoNo = getVal(['销售单号', '销售單號', 'Sales Order', 'STO', 'STO#']);
        
        let cleanSto = "";
        if (stoNo !== null && stoNo !== undefined) {
            cleanSto = String(stoNo).trim();
            if (cleanSto.endsWith('.0')) {
                cleanSto = cleanSto.slice(0, -2);
            }
            if (cleanSto.toUpperCase() === 'NAN') {
                cleanSto = "";
            }
        }
        
        return {
            partNo: partNo ? String(partNo).trim() : "",
            qty: qty ? parseInt(String(qty).replace(/,/g, ''), 10) : 0,
            totalPrice: totalPrice ? parseFloat(String(totalPrice).replace(/,/g, '')) : 0.0,
            stoNo: cleanSto
        };
    }).filter(item => item.partNo !== "");
}

// Execute SDSS PDF + Excel Price Matching
btnSdssRun.addEventListener('click', async () => {
    if (sdssPlFiles.length === 0 || !sdssInvoiceFile) return;

    try {
        btnSdssRun.disabled = true;
        btnSdssClearFiles.disabled = true;

        // Step 1: Read Excel Invoice
        updateSdssProgress(20, '正在讀取 Invoice Excel 對照檔...');
        const excelRawJson = await readExcelInvoice(sdssInvoiceFile);
        const excelRows = cleanExcelData(excelRawJson);

        // Group Excel rows by (stoNo, partNo) to form Mapping Table
        const excelGroups = {};
        excelRows.forEach(row => {
            const key = `${row.stoNo}||${row.partNo}`;
            if (!excelGroups[key]) {
                excelGroups[key] = {
                    stoNo: row.stoNo,
                    partNo: row.partNo,
                    totalQty: 0,
                    totalPrice: 0.0
                };
            }
            excelGroups[key].totalQty += row.qty;
            excelGroups[key].totalPrice += row.totalPrice;
        });

        // Compute weighted price for each group
        const excelMappingTable = {};
        Object.keys(excelGroups).forEach(key => {
            const group = excelGroups[key];
            let unitPrice = 0.0;
            if (group.totalQty > 0) {
                unitPrice = group.totalPrice / group.totalQty;
            }
            excelMappingTable[key] = {
                unitPrice: parseFloat(unitPrice.toFixed(4)),
                totalQty: group.totalQty
            };
        });

        // Step 2: Parse PL PDFs
        const newResultRows = [];
        const totalPldf = sdssPlFiles.length;
        
        // Flexible PL regex that supports both having and not having STO# and STO Line
        const sdssItemRegex = /^(\d+)\s+([\w\-]+)\s+([\d,]+)\s*EA\s+(?:(\d+)\s+(\d+)\s+)?([\d\.,]+)\s*KG\s+([\d\.,]+)\s*KG\s+(\d+)/i;

        for (let idx = 0; idx < totalPldf; idx++) {
            const file = sdssPlFiles[idx];
            updateSdssProgress(30 + Math.floor((idx / totalPldf) * 50), `正在解析 PL PDF (${idx + 1}/${totalPldf}): ${file.name}`);
            
            const plText = await extractPdfTextFlat(file);
            
            // Extract Delivery Number
            let deliveryNo = "";
            const dnMatch = plText.match(/Delivery Number\s*:\s*(\d+)/i);
            if (dnMatch) {
                deliveryNo = dnMatch[1];
            }

            const lines = plText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(sdssItemRegex);
                if (match) {
                    const itemNo = match[1];
                    const materialNo = match[2];
                    const qty = parseInt(match[3].replace(/,/g, ''), 10);
                    
                    // Match optional STO# & STO Line
                    let stoNo = match[4] || "";
                    let stoLine = match[5] || "";
                    
                    const grossWeight = parseFloat(match[6]);
                    const netWeight = parseFloat(match[7]);
                    const noOfBox = parseInt(match[8], 10);

                    // Form QSS Part Number
                    let qssMaterialNo = materialNo;
                    if (!qssMaterialNo.toUpperCase().startsWith('7SD')) {
                        qssMaterialNo = '7SD' + qssMaterialNo;
                    }

                    // Look up price from mapping table by (stoNo, materialNo)
                    const lookupKey = `${stoNo}||${materialNo}`;
                    let unitPrice = "";
                    
                    if (excelMappingTable[lookupKey]) {
                        const matchedGroup = excelMappingTable[lookupKey];
                        // Also check qty match
                        if (matchedGroup.totalQty === qty) {
                            unitPrice = matchedGroup.unitPrice;
                        } else {
                            // Fallback to match even if qty mismatches
                            unitPrice = matchedGroup.unitPrice;
                        }
                    }

                    const today = new Date();
                    const formattedDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

                    newResultRows.push([
                        formattedDate,                             // 日期
                        stoNo,                                     // STO #
                        stoLine || itemNo,                         // Line
                        qssMaterialNo,                             // QSS 料號
                        qty,                                       // 數量
                        'SHNSSD03',                                // 廠商
                        'S01',                                     // 預計入庫倉
                        'B2B',                                     // 出貨指示類型
                        '\u3000',                                  // AI# (全形空白)
                        unitPrice !== null ? unitPrice : '',       // 單價
                        parseFloat(netWeight.toFixed(3)),          // 淨重 (3 decimals)
                        parseFloat(grossWeight.toFixed(3)),        // 毛重 (3 decimals)
                        noOfBox                                    // 箱數
                    ]);
                }
            }
        }

        if (newResultRows.length === 0) {
            throw new Error(`無法從所選的 PL PDF 中提取任何有效的項目資料。請確認檔案是否正確。`);
        }

        // Append to state
        sdssResultRows = sdssResultRows.concat(newResultRows);

        // Step 3: Render Table
        updateSdssProgress(90, '正在更新預覽表格...');
        renderSdssPreviewTable();
        updateSdssExportButtons();

        updateSdssProgress(100, '完成對照解析！');
        sdssStatusDot.className = 'status-dot completed';
        sdssStatusText.textContent = `解析對照完成！成功匹配並新增 ${newResultRows.length} 筆資料，累計共 ${sdssResultRows.length} 筆。`;

        // Keep files loaded in UI for manual clearing/swapping
        updateSdssFileUI();

        // Check for missing prices
        const missingPriceCount = newResultRows.filter(row => row[9] === '').length;
        if (missingPriceCount > 0) {
            sdssInfoBox.style.background = 'rgba(239, 68, 68, 0.05)';
            sdssInfoBox.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            sdssInfoText.innerHTML = `<span style="color: #ef4444; font-weight: 600;">警告：</span>本次新增項目中，有 <strong>${missingPriceCount}</strong> 筆單價未能在 Excel 中尋獲（銷售單號 + 訂單料號 + 數量 均需一致），已標記為紅色。`;
        } else {
            sdssInfoBox.style.background = 'rgba(16, 185, 129, 0.05)';
            sdssInfoBox.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            sdssInfoText.innerHTML = `<span style="color: #10b981; font-weight: 600;">成功：</span>所有行項目皆成功於 Excel 檔中完成對照！您可以繼續載入下一批檔案追加，或點擊下方按鈕進行導出。`;
        }

    } catch (error) {
        console.error(error);
        sdssStatusDot.className = 'status-dot error';
        sdssStatusText.textContent = '解析對照失敗！';
        updateSdssProgress(0, '處理出錯');
        
        sdssInfoBox.style.background = 'rgba(239, 68, 68, 0.05)';
        sdssInfoBox.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        sdssInfoText.innerHTML = `<span style="color: #ef4444; font-weight: 600;">錯誤訊息：</span>${error.message}`;
        
        btnSdssClearFiles.disabled = false;
        updateSdssFileUI();
    }
});

// Render SDSS Table Row Data
function renderSdssPreviewTable() {
    sdssTableBody.innerHTML = '';
    
    if (sdssResultRows.length === 0) {
        sdssTablePlaceholder.style.display = 'flex';
        sdssDataTable.style.display = 'none';
        sdssPreviewCount.style.display = 'none';
        btnSdssClearPreview.style.display = 'none';
        return;
    }

    sdssResultRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        row.forEach((cell, idx) => {
            const td = document.createElement('td');
            
            if (idx === 9) { // 單價
                td.textContent = cell !== '' ? Number(cell).toFixed(4) : '未尋獲';
                if (cell === '') td.style.color = '#ef4444';
            } else if (idx === 10 || idx === 11) { // 淨重 / 毛重 (3 decimals)
                td.textContent = cell !== undefined && cell !== '' ? Number(cell).toFixed(3) : '';
            } else if (idx === 12) { // 箱數
                td.textContent = cell !== undefined && cell !== '' ? Number(cell).toString() : '';
            } else {
                td.textContent = cell || '';
            }
            tr.appendChild(td);
        });
        
        const actionTd = document.createElement('td');
        actionTd.className = 'action-column';
        actionTd.innerHTML = `
            <button class="btn-delete-row" data-idx="${index}" title="刪除此筆">
                <i data-lucide="trash-2"></i>
            </button>
        `;
        tr.appendChild(actionTd);
        sdssTableBody.appendChild(tr);
    });

    sdssTablePlaceholder.style.display = 'none';
    sdssDataTable.style.display = 'table';
    sdssPreviewCount.style.display = 'inline-block';
    sdssPreviewCount.textContent = `${sdssResultRows.length} 筆資料`;
    btnSdssClearPreview.style.display = 'flex';
    
    lucide.createIcons();
    bindSdssRowDeleteEvents();
}

function bindSdssRowDeleteEvents() {
    const deleteButtons = sdssTableBody.querySelectorAll('.btn-delete-row');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-idx'), 10);
            sdssResultRows.splice(idx, 1);
            renderSdssPreviewTable();
            updateSdssExportButtons();
            
            sdssStatusDot.className = 'status-dot completed';
            sdssStatusText.textContent = `已刪除單筆項目。目前累計 ${sdssResultRows.length} 筆資料。`;
        });
    });
}

function updateSdssExportButtons() {
    const hasData = sdssResultRows.length > 0;
    btnSdssExportXlsx.disabled = !hasData;
    btnSdssExportCsv.disabled = !hasData;
}

// Clear SDSS Preview Data
btnSdssClearPreview.addEventListener('click', () => {
    sdssResultRows = [];
    renderSdssPreviewTable();
    updateSdssExportButtons();
    
    sdssInfoBox.style.background = 'rgba(139, 92, 246, 0.05)';
    sdssInfoBox.style.borderColor = 'rgba(139, 92, 246, 0.15)';
    sdssInfoText.innerHTML = `已清空所有對照資料。請重新載入對照檔案產生。`;
});

// SDSS Export Excel
btnSdssExportXlsx.addEventListener('click', () => {
    if (sdssResultRows.length === 0) return;

    const headers = ['日期', 'STO #', 'Line', 'QSS 料號', '數量', '廠商', '預計入庫倉', '出貨指示類型', 'AI#', '單價', '淨重', '毛重', '箱數'];
    const wsData = [headers, ...sdssResultRows];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    XLSX.utils.book_append_sheet(wb, ws, '工作表1');
    XLSX.writeFile(wb, 'template.xlsx');
});

// SDSS Export CSV
btnSdssExportCsv.addEventListener('click', () => {
    if (sdssResultRows.length === 0) return;

    const headers = ['日期', 'STO #', 'Line', 'QSS 料號', '數量', '廠商', '預計入庫倉', '出貨指示類型', 'AI#', '單價', '淨重', '毛重', '箱數'];
    const wsData = [headers, ...sdssResultRows];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template.csv';
    a.click();
    
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
});
