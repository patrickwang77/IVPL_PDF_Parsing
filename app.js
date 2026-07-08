// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

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

// Application State
let plFile = null;
let eiFile = null;
let mappedResultRows = []; // cumulative list of mapped rows: each is an 11-element array

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
        
        let plParsedData = [];
        let invoicePrices = {}; // Key: "partNumber_lotNo" -> unitPrice (float)
        let newResultRows = [];

        // Step 1: Parse Packing List
        updateProgress(15, '正在讀取 Packing List PDF...');
        const plText = await extractPdfTextFlat(plFile);

        updateProgress(35, '正在解析 Packing List 欄位資料...');
        
        // Match STO # (e.g. 4501153806)
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
            throw new Error(`無法從 Packing List (${currentPlName}) 中提取有效的項目資料。`);
        }

        const plPartNumbers = [...new Set(plParsedData.map(item => item.partNumber))];

        // Step 2: Parse EI (Invoice) File
        updateProgress(55, '正在讀取 EI PDF...');
        const eiText = await extractPdfTextFlat(eiFile);

        updateProgress(75, '正在對照 EI 單價資料...');
        
        const eiLines = eiText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        let currentPartNumber = "";
        
        // Flexible regex supporting Chinese description "集成电路" or similar description text
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
                const qty = parseInt(match[3].replace(/,/g, ''), 10);
                const unitPrice = parseFloat(match[4]);
                
                const key = `${currentPartNumber}_${lotNo}`;
                invoicePrices[key] = unitPrice;
            }
        }

        // Step 3: Group and Aggregate Data (Group By: partNumber + unitPrice)
        updateProgress(90, '正在產生與合併對照資料...');
        const today = new Date();
        const formattedDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
        
        const groups = {};
        plParsedData.forEach(item => {
            let unitPrice = invoicePrices[`${item.partNumber}_${item.lotNo}`];
            if (unitPrice === undefined) {
                // Fallback: look for other lot prices of the same Part Number in the invoice
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

        // Convert grouped objects to output rows
        Object.keys(groups).forEach(key => {
            const group = groups[key];
            newResultRows.push([
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

        // Append to global state
        mappedResultRows = mappedResultRows.concat(newResultRows);

        // Step 4: Render UI Table
        updateProgress(95, '正在更新預覽表格...');
        renderPreviewTable();
        updateExportButtons();

        // Complete UI reset for next files
        updateProgress(100, '完成對照解析！');
        statusDot.className = 'status-dot completed';
        statusText.textContent = `解析完成！本次新增 ${newResultRows.length} 筆彙總資料，累計共 ${mappedResultRows.length} 筆。`;

        // Clear uploaded files in selector to prepare for the next drop
        clearUploadedFiles();

        const missingPriceCount = newResultRows.filter(row => row[5] === '').length;
        if (missingPriceCount > 0) {
            infoBox.style.background = 'rgba(239, 68, 68, 0.05)';
            infoBox.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            infoText.innerHTML = `<span style="color: #ef4444; font-weight: 600;">警告：</span>本次新增的項目中，有 <strong>${missingPriceCount}</strong> 筆單價未能在 EI 檔中尋獲，已呈現在列表底部（紅色標記）。`;
        } else {
            infoBox.style.background = 'rgba(16, 185, 129, 0.05)';
            infoBox.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            infoText.innerHTML = `<span style="color: #10b981; font-weight: 600;">成功：</span>本次配對檔案對照成功！資料已追加至預覽表，您可以繼續拖曳下一組檔案進行解析，或點擊下方按鈕匯出。`;
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

// Render Preview HTML Table
function renderPreviewTable() {
    tableBody.innerHTML = '';
    
    if (mappedResultRows.length === 0) {
        tablePlaceholder.style.display = 'flex';
        dataTable.style.display = 'none';
        previewCount.style.display = 'none';
        btnClearPreview.style.display = 'none';
        return;
    }

    mappedResultRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        row.forEach((cell, idx) => {
            const td = document.createElement('td');
            if (idx === 5) { // 單價
                td.textContent = cell !== '' ? Number(cell).toFixed(4) : '未尋獲';
                if (cell === '') td.style.color = '#ef4444';
            } else if (idx === 8) { // 淨重 (4 decimal places)
                td.textContent = cell !== undefined && cell !== '' ? Number(cell).toFixed(4) : '';
            } else if (idx === 9) { // 毛重 (2 decimal places)
                td.textContent = cell !== undefined && cell !== '' ? Number(cell).toFixed(2) : '';
            } else if (idx === 10) { // 箱數 (integer)
                td.textContent = cell !== undefined && cell !== '' ? Number(cell).toString() : '';
            } else {
                td.textContent = cell;
            }
            tr.appendChild(td);
        });
        
        // Add Delete Button Column
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

// Bind event listeners for row delete buttons
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

// Delete an individual row
function deleteRow(idx) {
    mappedResultRows.splice(idx, 1);
    renderPreviewTable();
    updateExportButtons();
    
    statusDot.className = 'status-dot completed';
    statusText.textContent = `已刪除單筆項目。目前累計 ${mappedResultRows.length} 筆資料。`;
}

// Update export buttons disabled/enabled state
function updateExportButtons() {
    const hasData = mappedResultRows.length > 0;
    btnExportXlsx.disabled = !hasData;
    btnExportCsv.disabled = !hasData;
}

// Export XLSX using SheetJS
btnExportXlsx.addEventListener('click', () => {
    if (mappedResultRows.length === 0) return;

    const headers = ['日期', '提單號碼', 'STO號碼', 'SSD 料號', '數量', '單價', '單位', 'storage loc', '淨重', '毛重', '箱數'];
    const wsData = [headers, ...mappedResultRows];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    XLSX.utils.book_append_sheet(wb, ws, '工作表1');
    XLSX.writeFile(wb, 'template.xlsx');
});

// Export CSV with UTF-8 BOM
btnExportCsv.addEventListener('click', () => {
    if (mappedResultRows.length === 0) return;

    const headers = ['日期', '提單號碼', 'STO號碼', 'SSD 料號', '數量', '單價', '單位', 'storage loc', '淨重', '毛重', '箱數'];
    const wsData = [headers, ...mappedResultRows];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    
    // Create Blob with UTF-8 BOM (\ufeff) so Excel reads Chinese columns correctly
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
