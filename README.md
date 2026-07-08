# PDF Extractor & Mapper v2.0

離線安全的 PDF 資料自動萃取與單價對照轉換工具，專為 **Invoice** 與 **Packing List** 檔案之對照彙總設計。

---

## 🌟 核心特色

- 🔒 **100% 離線處理，隱私安全**：所有 PDF 解析、欄位對照與 Excel/CSV 匯出皆在使用者本機瀏覽器完成，任何商業機密均不對外上傳。
- 🖥️ **極致美學深色 UI**：基於 Glassmorphic (毛玻璃) 的深色科技感主題設計，配備漸層發光霓虹邊框與平滑微動畫。
- 📊 **自動化單價對照與合併 (Group By)**：
  - 精確解析 PL 中的多箱明細與 STO 編號。
  - 自動依 **SSD 料號** 與 **Lot No** 於 Invoice 中交叉比對抓取對應單價（支援批次單價均一化 fallback 機制）。
  - 將相同料號與單價之 Carton 明細進行加總（數量、淨重、毛重）與計數（箱數），生成最乾淨的彙總資料。
- 📁 **極簡啟動與 Standalone 獨立包**：
  - 提供整合 CSS 與所有依賴庫的單一 HTML Standalone 檔案。
  - 直接滑鼠按兩下開啟，無任何 CORS 跨域限制與執行環境門檻。

---

## 📂 專案結構

```
d:/Antigravity workspace/PDF-Extractor2/
├── Temp/                        # 本機資料暫存區
│   ├── TJ260611104031p.pdf      # 範例 Packing List (PL)
│   ├── TJ260611104031i.pdf      # 範例 Invoice (EI)
│   ├── template.xlsx            # 預期 Excel 樣板答案
│   └── template.csv             # 預期 CSV 樣板答案
├── lib/                         # 本機離線 JS 庫依賴
│   ├── lucide.min.js            # 圖標渲染
│   ├── pdf.min.js               # PDF 核心解析 (PDF.js)
│   ├── pdf.worker.min.js        # PDF.js 背景執行緒 (Bundler 以 base64 內嵌)
│   └── xlsx.full.min.js         # Excel/CSV 生成與匯出 (SheetJS)
├── index.html                   # 主應用介面 HTML
├── styles.css                   # 深色科技感毛玻璃樣式系統
├── app.js                       # 核心解析與對照邏輯程式
├── bundle.py                    # 打包指令，生成 Standalone 單一 HTML 檔
├── run.bat                      # 啟動本機極簡 Web 伺服器並自動開啟網頁
├── stop_server.bat              # 結束 port 8000 的伺服器行程
└── run_offline.vbs              # 無終端機視窗的背景靜默啟動腳本
```

---

## 🚀 使用指南

### 方法 A：使用 Standalone 獨立網頁版 (最推薦)
1. 直接在檔案瀏覽器中滑鼠按兩下打開 `PDF-Extractor-Standalone.html`。
2. 將一組 **Packing List (結尾為 p.pdf)** 及 **Invoice (結尾為 i.pdf)** 檔案拖曳至網頁的拖放區中。
3. 點擊 **Run (開始解析)**，系統將自動解析出彙總資料並於右側以試算表形式預覽。
4. 點擊下載 XLSX 或 CSV 檔案。

### 方法 B：使用本機伺服器模式 (適用於開發與偵錯)
1. 滑鼠按兩下執行 `run.bat`，系統將啟動一個本機的 HTTP 伺服器 (Port 8000) 並在 Microsoft Edge 中自動載入網頁。
2. 使用完畢後，執行 `stop_server.bat` 關閉伺服器。

---

## 📋 輸出欄位規格

產生的 Excel / CSV 檔案包含以下 11 個欄位，其格式與範本完全一致：

| 欄位名稱 | 資料類型 | 說明 |
| :--- | :--- | :--- |
| **日期** | 字串 | 執行當天日期 (格式: `yyyy/m/d`) |
| **提單號碼** | (空值) | 保留欄位，預設為空 |
| **STO號碼** | 字串 | 從 Packing List 中抓取的 PO# |
| **SSD 料號** | 字串 | 廠商料號 |
| **數量** | 整數 | 相同料號與單價加總之總數量 |
| **單價** | 浮點數 | Invoice 中對照出的單價 (小數點 4 位) |
| **單位** | 字串 | 固定值 `"EA"` |
| **storage loc**| 字串 | 固定值 `"FG"` |
| **淨重** | 浮點數 | 相同料號與單價加總之淨重 (小數點 4 位) |
| **毛重** | 浮點數 | 相同料號與單價加總之毛重 (小數點 2 位) |
| **箱數** | 整數 | 相同料號與單價包含的 Carton 箱數計數 |
