/* ============================================
   SPK WEB APP — input.js
   Multi-step input page controller
   Steps: 1-Upload  2-Columns  3-Method+Weight  4-Confirm+Process
   ============================================ */

   'use strict';

   /* ──────────────────────────────────────────
      STATE
   ────────────────────────────────────────── */
   const State = {
     rawData:       null,   // 2D array [ [header...], [row...], ... ]
     headers:       [],     // string[]
     labelCol:      null,   // string — name of the label column
     selectedCols:  [],     // string[] — criteria columns
     criteriaTypes: {},     // { colName: 'benefit'|'cost' }
     method:        'saw',  // saw | topsis | waspas | moora | edas
     lambda:        0.5,    // WASPAS lambda
     weightMethod:  'manual',
     weights:       {},     // { colName: number }
     dataSource:    '',     // 'file' | 'manual' | 'sample'
     fileName:      '',
   };
   
   /* ──────────────────────────────────────────
      SAMPLE DATA
   ────────────────────────────────────────── */
   const SAMPLES = {
     laptop: {
       headers: ['Laptop', 'Harga (juta)', 'RAM (GB)', 'Storage (GB)', 'Layar (inch)', 'Baterai (jam)'],
       rows: [
         ['Laptop A', 8.5, 8, 512, 14, 8],
         ['Laptop B', 12.0, 16, 512, 15.6, 6],
         ['Laptop C', 6.5, 8, 256, 13.3, 10],
         ['Laptop D', 15.0, 16, 1024, 15.6, 7],
         ['Laptop E', 9.9, 12, 512, 14, 9],
       ],
     },
     supplier: {
       headers: ['Supplier', 'Harga', 'Kualitas', 'Pengiriman (hari)', 'Layanan'],
       rows: [
         ['PT Abadi', 85, 90, 3, 88],
         ['CV Maju', 78, 85, 5, 80],
         ['PT Sejahtera', 92, 78, 2, 75],
         ['CV Berkah', 70, 88, 4, 92],
         ['PT Unggul', 88, 92, 3, 85],
         ['CV Prima', 75, 80, 6, 78],
       ],
     },
     karyawan: {
       headers: ['Karyawan', 'Kinerja', 'Kedisiplinan', 'Komunikasi', 'Inovasi', 'Team Work', 'Loyalitas'],
       rows: [
         ['Andi', 85, 90, 80, 75, 88, 92],
         ['Budi', 78, 85, 88, 80, 82, 86],
         ['Citra', 92, 78, 85, 90, 78, 80],
         ['Dian', 70, 88, 75, 85, 90, 78],
         ['Eko', 88, 82, 90, 78, 85, 84],
         ['Fitri', 75, 76, 82, 88, 80, 88],
         ['Gilang', 82, 90, 78, 82, 86, 82],
         ['Hani', 90, 84, 86, 80, 88, 76],
       ],
     },
     lokasi: {
       headers: ['Lokasi', 'Biaya Sewa (jt)', 'Akses Jalan', 'Luas (m2)', 'Keamanan', 'Parkir'],
       rows: [
         ['Lokasi A', 15, 85, 500, 90, 80],
         ['Lokasi B', 12, 78, 350, 80, 90],
         ['Lokasi C', 18, 92, 600, 85, 75],
         ['Lokasi D', 10, 70, 280, 75, 85],
       ],
     },
   };
   
   /* ──────────────────────────────────────────
      WEIGHT METHOD DESCRIPTIONS
   ────────────────────────────────────────── */
   const WEIGHT_DESCS = {
     manual:  { icon: '✏️', text: 'Masukkan bobot secara manual sesuai preferensi atau kebijakan Anda.' },
     entropy: { icon: '📊', text: 'Bobot dihitung otomatis dari variasi data menggunakan teori informasi Shannon. Kriteria dengan variasi tinggi mendapat bobot lebih besar.' },
     critic:  { icon: '🔬', text: 'CRITIC (Criteria Importance Through Intercriteria Correlation) mempertimbangkan standar deviasi dan korelasi antar kriteria secara bersamaan.' },
     equal:   { icon: '⚖️', text: 'Semua kriteria mendapat bobot yang sama rata. Cocok jika tidak ada preferensi khusus.' },
   };
   
   /* ──────────────────────────────────────────
      STEP NAVIGATION
   ────────────────────────────────────────── */
   let currentStep = 1;
   
   function goToStep(n) {
     // Hide all panels
     document.querySelectorAll('.step-panel').forEach(p => p.style.display = 'none');
   
     // Show target panel
     const target = document.getElementById(`step${n}`);
     if (target) target.style.display = 'block';
   
     // Update step indicator
     document.querySelectorAll('.step-indicator-item').forEach(item => {
       const s = parseInt(item.dataset.step);
       item.classList.remove('active', 'done');
       if (s === n) item.classList.add('active');
       if (s < n)  item.classList.add('done');
     });
   
     currentStep = n;
   
     // Step-specific init
     if (n === 2) initStep2();
     if (n === 3) initStep3();
     if (n === 4) initStep4();
   
     window.scrollTo({ top: 0, behavior: 'smooth' });
   }
   
   /* ──────────────────────────────────────────
      URL PARAM — pre-select method
   ────────────────────────────────────────── */
   (function readUrlParams() {
     const params = new URLSearchParams(location.search);
     const method = params.get('method');
     const weight = params.get('weight');
   
     if (method && ['saw','topsis','waspas','moora','edas'].includes(method)) {
       State.method = method;
   
       const badge = document.getElementById('methodBadge');
       const name  = document.getElementById('methodBadgeName');
       if (badge && name) {
         name.textContent = method.toUpperCase();
         badge.style.display = 'inline-flex';
       }
     }
   
     if (weight && ['manual','entropy','critic','equal'].includes(weight)) {
       State.weightMethod = weight;
     }
   
     const changeBtn = document.getElementById('methodBadgeChange');
     if (changeBtn) {
       changeBtn.addEventListener('click', () => goToStep(3));
     }
   })();
   
   /* ──────────────────────────────────────────
      STEP 1 — UPLOAD & PREVIEW
   ────────────────────────────────────────── */
   
   // Tab switching
   document.querySelectorAll('.upload-tab').forEach(tab => {
     tab.addEventListener('click', () => {
       document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
       document.querySelectorAll('.upload-tab-content').forEach(c => c.classList.remove('active'));
       tab.classList.add('active');
       const target = document.getElementById('tab' + cap(tab.dataset.tab));
       if (target) target.classList.add('active');
     });
   });
   
   function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
   
   // Dropzone
   const dropzone  = document.getElementById('dropzone');
   const fileInput = document.getElementById('fileInput');
   
   if (dropzone) {
     dropzone.addEventListener('click', () => fileInput && fileInput.click());
   
     dropzone.addEventListener('dragover', e => {
       e.preventDefault();
       dropzone.classList.add('drag-over');
     });
   
     dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
   
     dropzone.addEventListener('drop', e => {
       e.preventDefault();
       dropzone.classList.remove('drag-over');
       const file = e.dataTransfer.files[0];
       if (file) handleFile(file);
     });
   }
   
   if (fileInput) {
     fileInput.addEventListener('change', () => {
       if (fileInput.files[0]) handleFile(fileInput.files[0]);
     });
   }
   
   function handleFile(file) {
     const ext = file.name.split('.').pop().toLowerCase();
     if (!['csv','xlsx','xls'].includes(ext)) {
       showToast('Format file tidak didukung. Gunakan CSV, XLSX, atau XLS.', 'error');
       return;
     }
   
     State.fileName   = file.name;
     State.dataSource = 'file';
   
     const csvOptions = document.getElementById('csvOptions');
     if (csvOptions) csvOptions.style.display = ext === 'csv' ? 'block' : 'none';
   
     const reader = new FileReader();
     reader.onload = e => {
       try {
         let data;
         if (ext === 'csv') {
           data = parseCSV(e.target.result);
         } else {
           data = parseExcel(e.target.result);
         }
         if (data && data.length > 1) {
           loadData(data);
           showFilePreview(file);
         } else {
           showToast('File kosong atau tidak dapat dibaca.', 'error');
         }
       } catch(err) {
         showToast('Gagal membaca file: ' + err.message, 'error');
       }
     };
   
     if (ext === 'csv') {
       reader.readAsText(file);
     } else {
       reader.readAsArrayBuffer(file);
     }
   }
   
   function parseCSV(text) {
     const delimiter = detectDelimiter(text);
     const lines = text.split(/\r?\n/).filter(l => l.trim());
     return lines.map(line => splitCSVLine(line, delimiter));
   }
   
   function detectDelimiter(text) {
     const manualDelim = document.getElementById('csvDelimiter');
     if (manualDelim && manualDelim.value !== 'auto') {
       return manualDelim.value === '\\t' ? '\t' : manualDelim.value;
     }
     const firstLine = text.split('\n')[0];
     const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
     for (const c of firstLine) if (counts[c] !== undefined) counts[c]++;
     return Object.entries(counts).sort((a,b) => b[1]-a[1])[0][0];
   }
   
   function splitCSVLine(line, delimiter) {
     const result = [];
     let current = '';
     let inQuotes = false;
     for (let i = 0; i < line.length; i++) {
       const ch = line[i];
       if (ch === '"') {
         inQuotes = !inQuotes;
       } else if (ch === delimiter && !inQuotes) {
         result.push(current.trim());
         current = '';
       } else {
         current += ch;
       }
     }
     result.push(current.trim());
     return result;
   }
   
   function parseExcel(buffer) {
     if (typeof XLSX === 'undefined') {
       throw new Error('Library SheetJS belum dimuat. Pastikan file lib/xlsx.full.min.js ada.');
     }
     const wb    = XLSX.read(buffer, { type: 'array' });
     const ws    = wb.Sheets[wb.SheetNames[0]];
     const data  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
     return data.filter(row => row.some(cell => cell !== ''));
   }
   
   function loadData(data) {
     const hasHeader = document.getElementById('csvHeader');
     const useHeader = !hasHeader || hasHeader.checked;
   
     let rows;
     if (useHeader) {
       State.headers = data[0].map(h => String(h).trim());
       rows = data.slice(1);
     } else {
       State.headers = data[0].map((_, i) => `Kolom ${i+1}`);
       rows = data;
     }
   
     // Remove empty rows
     rows = rows.filter(r => r.some(c => c !== '' && c !== null && c !== undefined));
     State.rawData = [State.headers, ...rows];
   
     renderPreviewTable(State.rawData, 'previewThead', 'previewTbody', 10);
     updateDataInfo(rows.length, State.headers.length);
   
     document.getElementById('previewEmpty').style.display = 'none';
     document.getElementById('previewTableWrap').style.display = 'block';
     document.getElementById('manualTableWrap').style.display = 'none';
     document.getElementById('previewActions').style.display = 'flex';
   
     enableStep1Next();
   }
   
   function showFilePreview(file) {
     const wrap = document.getElementById('filePreviewWrap');
     if (!wrap) return;
     const kb = (file.size / 1024).toFixed(1);
     wrap.innerHTML = `
       <div class="file-preview">
         <div class="file-preview-icon">📄</div>
         <div class="file-preview-info">
           <div class="file-preview-name">${escHtml(file.name)}</div>
           <div class="file-preview-meta">${kb} KB</div>
         </div>
         <button class="file-preview-remove" id="btnRemoveFile" title="Hapus">✕</button>
       </div>`;
     wrap.style.display = 'block';
     document.getElementById('btnRemoveFile').addEventListener('click', clearData);
   }
   
   function updateDataInfo(rows, cols) {
     const card = document.getElementById('dataInfoCard');
     if (card) {
       card.style.display = 'block';
       document.getElementById('infoRows').textContent = rows;
       document.getElementById('infoCols').textContent = cols;
     }
   }
   
   // Manual input
   document.getElementById('btnGenerateManual') && document.getElementById('btnGenerateManual').addEventListener('click', generateManualTable);
   
   function generateManualTable() {
     const rows = parseInt(document.getElementById('manualRows').value) || 4;
     const cols = parseInt(document.getElementById('manualCols').value) || 4;
   
     if (rows < 2 || rows > 100) { showToast('Jumlah baris harus antara 2–100', 'error'); return; }
     if (cols < 2 || cols > 30)  { showToast('Jumlah kolom harus antara 2–30', 'error'); return; }
   
     State.dataSource = 'manual';
   
     // Build default headers
     const headers = ['Alternatif'];
     for (let c = 1; c <= cols; c++) headers.push(`K${c}`);
     State.headers = headers;
   
     // Build empty rows
     const data = [headers];
     for (let r = 1; r <= rows; r++) {
       const row = [`A${r}`];
       for (let c = 0; c < cols; c++) row.push('');
       data.push(row);
     }
     State.rawData = data;
   
     buildManualInputTable(data);
   
     document.getElementById('previewEmpty').style.display = 'none';
     document.getElementById('previewTableWrap').style.display = 'none';
     document.getElementById('manualTableWrap').style.display = 'block';
     document.getElementById('previewActions').style.display = 'flex';
     document.getElementById('dataInfoCard').style.display = 'block';
     document.getElementById('infoRows').textContent = rows;
     document.getElementById('infoCols').textContent = cols;
   
     enableStep1Next();
   }
   
   function buildManualInputTable(data) {
     const thead = document.getElementById('manualThead');
     const tbody = document.getElementById('manualTbody');
     if (!thead || !tbody) return;
   
     // Header row with editable inputs
     let thHTML = '<tr>';
     data[0].forEach((h, i) => {
       if (i === 0) {
         thHTML += `<th>Label</th>`;
       } else {
         thHTML += `<th class="editable-header"><input type="text" value="${escHtml(h)}" data-col="${i}" placeholder="K${i}" /></th>`;
       }
     });
     thHTML += '</tr>';
     thead.innerHTML = thHTML;
   
     // Body rows
     let tbHTML = '';
     data.slice(1).forEach((row, ri) => {
       tbHTML += '<tr>';
       row.forEach((cell, ci) => {
         if (ci === 0) {
           tbHTML += `<td><input type="text" value="${escHtml(cell)}" data-row="${ri}" data-col="0" placeholder="A${ri+1}" /></td>`;
         } else {
           tbHTML += `<td><input type="number" value="${cell}" data-row="${ri}" data-col="${ci}" step="any" placeholder="0" /></td>`;
         }
       });
       tbHTML += '</tr>';
     });
     tbody.innerHTML = tbHTML;
   
     // Bind header rename
     thead.querySelectorAll('input').forEach(inp => {
       inp.addEventListener('input', () => {
         const ci = parseInt(inp.dataset.col);
         State.headers[ci] = inp.value || `K${ci}`;
         State.rawData[0][ci] = State.headers[ci];
       });
     });
   
     // Bind cell edits
     tbody.querySelectorAll('input').forEach(inp => {
       inp.addEventListener('input', () => {
         const ri = parseInt(inp.dataset.row) + 1;
         const ci = parseInt(inp.dataset.col);
         State.rawData[ri][ci] = ci === 0 ? inp.value : (parseFloat(inp.value) || inp.value);
       });
     });
   }
   
   // Sample data
   document.querySelectorAll('.sample-item').forEach(btn => {
     btn.addEventListener('click', () => {
       const key = btn.dataset.sample;
       const sample = SAMPLES[key];
       if (!sample) return;
   
       State.dataSource = 'sample';
       State.fileName   = key;
   
       const data = [sample.headers, ...sample.rows];
       loadData(data);
   
       // Switch to file tab visual for preview
       document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
       document.querySelectorAll('.upload-tab-content').forEach(c => c.classList.remove('active'));
       // Don't change tab, just show preview
   
       showToast(`Data contoh "${btn.querySelector('.sample-title').textContent}" dimuat.`);
     });
   });
   
   // Clear data
   document.getElementById('btnClearData') && document.getElementById('btnClearData').addEventListener('click', clearData);
   
   function clearData() {
     State.rawData       = null;
     State.headers       = [];
     State.selectedCols  = [];
     State.criteriaTypes = {};
     State.weights       = {};
   
     document.getElementById('previewEmpty').style.display = 'block';
     document.getElementById('previewTableWrap').style.display = 'none';
     document.getElementById('manualTableWrap').style.display = 'none';
     document.getElementById('previewActions').style.display = 'none';
     document.getElementById('dataInfoCard').style.display = 'none';
     document.getElementById('filePreviewWrap').style.display = 'none';
     document.getElementById('csvOptions').style.display = 'none';
   
     if (fileInput) fileInput.value = '';
     disableStep1Next();
   }
   
   function enableStep1Next() {
     const btn = document.getElementById('btnStep1Next');
     if (btn) btn.disabled = false;
   }
   function disableStep1Next() {
     const btn = document.getElementById('btnStep1Next');
     if (btn) btn.disabled = true;
   }
   
   document.getElementById('btnStep1Next') && document.getElementById('btnStep1Next').addEventListener('click', () => {
     // Validate manual table has at least some numeric values
     if (State.dataSource === 'manual') {
       syncManualData();
     }
     if (!State.rawData || State.rawData.length < 3) {
       showToast('Data minimal 2 baris. Silakan upload file atau isi tabel manual.', 'error');
       return;
     }
     goToStep(2);
   });
   
   function syncManualData() {
     // Re-read manual table inputs into State.rawData
     const tbody = document.getElementById('manualTbody');
     if (!tbody) return;
     tbody.querySelectorAll('tr').forEach((tr, ri) => {
       tr.querySelectorAll('input').forEach((inp, ci) => {
         if (State.rawData[ri+1]) {
           State.rawData[ri+1][ci] = ci === 0 ? inp.value : (parseFloat(inp.value) || 0);
         }
       });
     });
     // Update headers from editable header inputs
     const thead = document.getElementById('manualThead');
     if (thead) {
       thead.querySelectorAll('input').forEach(inp => {
         const ci = parseInt(inp.dataset.col);
         State.rawData[0][ci] = inp.value || `K${ci}`;
       });
       State.headers = State.rawData[0];
     }
   }
   
   /* ──────────────────────────────────────────
      STEP 2 — PILIH KOLOM
   ────────────────────────────────────────── */
   function initStep2() {
     if (!State.rawData) return;
   
     const headers = State.rawData[0];
     const rows    = State.rawData.slice(1);
   
     // Detect numeric columns
     const isNumeric = headers.map((h, ci) => {
       if (ci === 0) return false;
       return rows.every(row => {
         const v = row[ci];
         return v !== '' && v !== null && v !== undefined && !isNaN(parseFloat(v));
       });
     });
   
     // Populate label column select
     const labelSel = document.getElementById('labelColSelect');
     if (labelSel) {
       labelSel.innerHTML = '<option value="">— Pilih kolom —</option>';
       headers.forEach((h, i) => {
         const opt = document.createElement('option');
         opt.value = h;
         opt.textContent = h;
         if (i === 0) opt.selected = true;
         labelSel.appendChild(opt);
       });
       State.labelCol = headers[0];
   
       labelSel.addEventListener('change', () => {
         State.labelCol = labelSel.value;
         document.getElementById('labelColHint').textContent =
           State.labelCol ? `Kolom "${State.labelCol}" akan dipakai sebagai nama alternatif.` : '';
         updateMatrixPreview();
       });
     }
   
     // Build column selector grid
     const grid = document.getElementById('colSelectorGrid');
     if (grid) {
       grid.innerHTML = '';
       headers.forEach((h, i) => {
         const numeric = isNumeric[i];
         const label = document.createElement('label');
         label.className = 'col-checkbox-label' + (numeric ? '' : ' disabled');
   
         const cb = document.createElement('input');
         cb.type    = 'checkbox';
         cb.value   = h;
         cb.disabled = !numeric;
   
         // Pre-select if previously selected or auto-select numeric by default
         const alreadySelected = State.selectedCols.includes(h);
         const autoSelect = numeric && State.selectedCols.length === 0;
         cb.checked = alreadySelected || autoSelect;
   
         const typeSpan = document.createElement('span');
         typeSpan.className = 'col-type-badge ' + (numeric ? 'num' : 'txt');
         typeSpan.textContent = numeric ? 'NUM' : 'TXT';
   
         label.append(cb, document.createTextNode(h), typeSpan);
         if (numeric) label.classList.toggle('selected', cb.checked);
   
         cb.addEventListener('change', () => {
           label.classList.toggle('selected', cb.checked);
           updateSelectedCols();
         });
   
         grid.appendChild(label);
       });
   
       // Initialize selectedCols
       updateSelectedCols();
     }
   
     // Select all / deselect all
     document.getElementById('btnSelectAll') && document.getElementById('btnSelectAll').addEventListener('click', () => {
       grid.querySelectorAll('input:not(:disabled)').forEach(cb => {
         cb.checked = true;
         cb.closest('label').classList.add('selected');
       });
       updateSelectedCols();
     });
   
     document.getElementById('btnDeselectAll') && document.getElementById('btnDeselectAll').addEventListener('click', () => {
       grid.querySelectorAll('input').forEach(cb => {
         cb.checked = false;
         cb.closest('label').classList.remove('selected');
       });
       updateSelectedCols();
     });
   }
   
   function updateSelectedCols() {
     const grid = document.getElementById('colSelectorGrid');
     if (!grid) return;
   
     State.selectedCols = [];
     grid.querySelectorAll('input:checked').forEach(cb => {
       State.selectedCols.push(cb.value);
     });
   
     const count = State.selectedCols.length;
     const countEl = document.getElementById('colSelectCount');
     if (countEl) countEl.textContent = `${count} kolom dipilih`;
   
     // Update criteria type list
     updateCriteriaTypePanel();
   
     // Enable/disable next
     const btn = document.getElementById('btnStep2Next');
     if (btn) btn.disabled = count < 2;
   
     // Update matrix preview
     updateMatrixPreview();
   }
   
   function updateCriteriaTypePanel() {
     const panel = document.getElementById('criteriaTypePanel');
     const list  = document.getElementById('criteriaTypeList');
     if (!panel || !list) return;
   
     if (State.selectedCols.length === 0) {
       panel.style.display = 'none';
       return;
     }
   
     panel.style.display = 'block';
     list.innerHTML = '';
   
     State.selectedCols.forEach(col => {
       if (!State.criteriaTypes[col]) State.criteriaTypes[col] = 'benefit';
   
       const row = document.createElement('div');
       row.className = 'criteria-type-row';
       row.innerHTML = `
         <span class="criteria-type-name" title="${escHtml(col)}">${escHtml(col)}</span>
         <div class="criteria-type-toggle">
           <button class="type-btn ${State.criteriaTypes[col] === 'benefit' ? 'active-benefit' : ''}"
             data-col="${escHtml(col)}" data-type="benefit">+ Benefit</button>
           <button class="type-btn ${State.criteriaTypes[col] === 'cost' ? 'active-cost' : ''}"
             data-col="${escHtml(col)}" data-type="cost">– Cost</button>
         </div>`;
   
       row.querySelectorAll('.type-btn').forEach(btn => {
         btn.addEventListener('click', () => {
           const c = btn.dataset.col;
           const t = btn.dataset.type;
           State.criteriaTypes[c] = t;
           // Update buttons in this toggle
           row.querySelectorAll('.type-btn').forEach(b => {
             b.classList.remove('active-benefit', 'active-cost');
           });
           btn.classList.add(t === 'benefit' ? 'active-benefit' : 'active-cost');
         });
       });
   
       list.appendChild(row);
     });
   }
   
   function updateMatrixPreview() {
     const wrap    = document.getElementById('matrixPreviewWrap');
     const subtitle = document.getElementById('matrixPreviewSubtitle');
   
     if (!State.rawData || State.selectedCols.length === 0) {
       if (wrap) wrap.style.display = 'none';
       if (subtitle) subtitle.textContent = 'Pilih kolom di atas untuk melihat matriks keputusan.';
       return;
     }
   
     // Build preview data
     const labelCol = State.labelCol || State.rawData[0][0];
     const colsToShow = State.selectedCols.slice(0, 8); // max 8 cols in preview
   
     const headers = State.rawData[0];
     const rows    = State.rawData.slice(1);
   
     const labelIdx = headers.indexOf(labelCol);
     const colIdxs  = colsToShow.map(c => headers.indexOf(c)).filter(i => i >= 0);
   
     const previewData = [
       [labelCol, ...colsToShow],
       ...rows.slice(0, 8).map(row => [
         labelIdx >= 0 ? row[labelIdx] : '—',
         ...colIdxs.map(ci => row[ci] ?? '—')
       ])
     ];
   
     renderPreviewTable(previewData, 'matrixPreviewThead', 'matrixPreviewTbody', 8);
   
     if (wrap) wrap.style.display = 'block';
     if (subtitle) subtitle.textContent = `Menampilkan ${Math.min(rows.length, 8)} dari ${rows.length} alternatif.`;
   }
   
   document.getElementById('btnStep2Back') && document.getElementById('btnStep2Back').addEventListener('click', () => goToStep(1));
   
   document.getElementById('btnStep2Next') && document.getElementById('btnStep2Next').addEventListener('click', () => {
     if (State.selectedCols.length < 2) {
       showToast('Pilih minimal 2 kolom kriteria numerik.', 'error');
       return;
     }
     if (!State.labelCol) {
       showToast('Pilih kolom label alternatif terlebih dahulu.', 'error');
       return;
     }
     goToStep(3);
   });
   
   /* ──────────────────────────────────────────
      STEP 3 — METODE & BOBOT
   ────────────────────────────────────────── */
   function initStep3() {
     initMethodSelector();
     initWeightInputs();
   }
   
   function initMethodSelector() {
     const radios = document.querySelectorAll('input[name="spkMethod"]');
   
     // Set pre-selected method
     radios.forEach(r => {
       r.checked = r.value === State.method;
     });
   
     radios.forEach(r => {
       r.addEventListener('change', () => {
         if (r.checked) {
           State.method = r.value;
           const lambdaPanel = document.getElementById('waspasPanelLambda');
           if (lambdaPanel) lambdaPanel.style.display = r.value === 'waspas' ? 'block' : 'none';
           checkStep3Valid();
         }
       });
     });
   
     // Init WASPAS lambda
     const lambdaPanel = document.getElementById('waspasPanelLambda');
     if (lambdaPanel) lambdaPanel.style.display = State.method === 'waspas' ? 'block' : 'none';
   
     const lambdaSlider = document.getElementById('lambdaSlider');
     const lambdaInput  = document.getElementById('lambdaInput');
     if (lambdaSlider && lambdaInput) {
       lambdaSlider.value = State.lambda;
       lambdaInput.value  = State.lambda;
   
       lambdaSlider.addEventListener('input', () => {
         State.lambda = parseFloat(lambdaSlider.value);
         lambdaInput.value = State.lambda;
       });
       lambdaInput.addEventListener('input', () => {
         let v = parseFloat(lambdaInput.value);
         if (isNaN(v)) v = 0.5;
         v = Math.max(0, Math.min(1, v));
         State.lambda = v;
         lambdaSlider.value = v;
       });
     }
   }
   
   function initWeightInputs() {
     // Weight method tabs
     document.querySelectorAll('.weight-method-tab').forEach(tab => {
       tab.classList.toggle('active', tab.dataset.wmethod === State.weightMethod);
       tab.addEventListener('click', () => {
         document.querySelectorAll('.weight-method-tab').forEach(t => t.classList.remove('active'));
         tab.classList.add('active');
         State.weightMethod = tab.dataset.wmethod;
         updateWeightMethodDesc();
         buildWeightInputs();
       });
     });
   
     updateWeightMethodDesc();
     buildWeightInputs();
   }
   
   function updateWeightMethodDesc() {
     const d = WEIGHT_DESCS[State.weightMethod] || WEIGHT_DESCS.manual;
     const iconEl = document.querySelector('.weight-method-desc-icon');
     const textEl = document.getElementById('weightMethodDescText');
     if (iconEl) iconEl.textContent = d.icon;
     if (textEl) textEl.textContent = d.text;
   }
   
   function buildWeightInputs() {
     const wrap = document.getElementById('weightInputsWrap');
     if (!wrap || State.selectedCols.length === 0) return;
   
     if (State.weightMethod === 'equal') {
       // Auto-set equal weights
       const w = 1 / State.selectedCols.length;
       State.selectedCols.forEach(c => State.weights[c] = parseFloat(w.toFixed(4)));
       buildManualWeightSliders(true);
       updateWeightTotal();
       checkStep3Valid();
       return;
     }
   
     if (State.weightMethod === 'entropy' || State.weightMethod === 'critic') {
       buildAutoWeights(State.weightMethod);
       return;
     }
   
     // Manual
     buildManualWeightSliders(false);
   }
   
   function buildManualWeightSliders(readOnly) {
     const wrap = document.getElementById('weightInputsWrap');
     if (!wrap) return;
   
     const n = State.selectedCols.length;
     const defaultW = parseFloat((1/n).toFixed(4));
   
     let html = '<div class="weight-inputs-list">';
     State.selectedCols.forEach(col => {
       if (!State.weights[col] || State.weights[col] === 0) {
         State.weights[col] = defaultW;
       }
       const w    = State.weights[col];
       const type = State.criteriaTypes[col] || 'benefit';
       html += `
         <div class="weight-input-row">
           <div class="weight-input-label" title="${escHtml(col)}">${escHtml(col)}</div>
           <span class="weight-input-type ${type}">${type === 'benefit' ? '+ B' : '– C'}</span>
           <input type="range" class="weight-row-slider weight-slider"
             data-col="${escHtml(col)}" min="0" max="1" step="0.001"
             value="${w}" ${readOnly ? 'disabled' : ''} />
           <input type="number" class="weight-row-number"
             data-col="${escHtml(col)}" min="0" max="1" step="0.001"
             value="${w}" ${readOnly ? 'disabled readonly' : ''} />
         </div>`;
     });
     html += '</div>';
     wrap.innerHTML = html;
   
     // Bind slider ↔ number
     wrap.querySelectorAll('.weight-row-slider').forEach(slider => {
       slider.addEventListener('input', () => syncWeight(slider, false));
     });
     wrap.querySelectorAll('.weight-row-number').forEach(num => {
       num.addEventListener('input', () => syncWeight(num, true));
     });
   
     updateWeightTotal();
   }
   
   function syncWeight(input, fromNumber) {
     const col = input.dataset.col;
     const val = parseFloat(input.value) || 0;
     State.weights[col] = val;
   
     const row = input.closest('.weight-input-row');
     if (row) {
       if (fromNumber) {
         const slider = row.querySelector('.weight-row-slider');
         if (slider) slider.value = val;
       } else {
         const num = row.querySelector('.weight-row-number');
         if (num) num.value = val.toFixed(3);
       }
     }
     updateWeightTotal();
     checkStep3Valid();
   }
   
   function updateWeightTotal() {
     const total = State.selectedCols.reduce((s, c) => s + (State.weights[c] || 0), 0);
     const pct   = Math.min(total / 1, 1) * 100;
   
     const fill   = document.getElementById('weightTotalFill');
     const label  = document.getElementById('weightTotalLabel');
     const status = document.getElementById('weightTotalStatus');
   
     if (fill)   { fill.style.width = pct + '%'; fill.classList.toggle('over', total > 1.001); }
     if (label)  { label.textContent = `Total: ${total.toFixed(3)}`; }
   
     const diff = Math.abs(total - 1);
     if (status) {
       if (diff < 0.001) {
         status.textContent = '✓ Total tepat';
         status.className = 'weight-total-status ok';
       } else if (total > 1.001) {
         status.textContent = `↑ Melebihi 1 (${(total - 1).toFixed(3)})`;
         status.className = 'weight-total-status over';
       } else {
         status.textContent = `↓ Kurang ${(1 - total).toFixed(3)}`;
         status.className = 'weight-total-status under';
       }
     }
   }
   
   async function buildAutoWeights(method) {
     const loading = document.getElementById('autoWeightLoading');
     const wrap    = document.getElementById('weightInputsWrap');
   
     if (loading) loading.style.display = 'flex';
     if (wrap)    wrap.innerHTML = '';
   
     // Simulate async calculation (actually sync but shows feedback)
     await delay(300);
   
     try {
       const weights = method === 'entropy'
         ? calcEntropyWeights()
         : calcCriticWeights();
   
       State.weights = weights;
       buildManualWeightSliders(true);
       updateWeightTotal();
       checkStep3Valid();
     } catch(err) {
       showToast('Gagal menghitung bobot otomatis: ' + err.message, 'error');
       State.weightMethod = 'manual';
       document.querySelectorAll('.weight-method-tab').forEach(t => {
         t.classList.toggle('active', t.dataset.wmethod === 'manual');
       });
       buildManualWeightSliders(false);
     } finally {
       if (loading) loading.style.display = 'none';
     }
   }
   
   function calcEntropyWeights() {
     const cols = State.selectedCols;
     const rows = State.rawData.slice(1);
     const headers = State.rawData[0];
   
     // Get numeric matrix
     const matrix = cols.map(col => {
       const ci = headers.indexOf(col);
       return rows.map(row => parseFloat(row[ci]) || 0);
     }); // [col][row]
   
     const m = rows.length;
   
     // Normalize each column (sum normalization)
     const normalized = matrix.map(col => {
       const sum = col.reduce((a, b) => a + b, 0);
       return sum === 0 ? col.map(() => 1/m) : col.map(v => v / sum);
     });
   
     // Calculate entropy for each column
     const entropies = normalized.map(col => {
       const e = col.reduce((sum, p) => {
         if (p <= 0) return sum;
         return sum - p * Math.log(p);
       }, 0);
       return e / Math.log(m); // normalize to [0,1]
     });
   
     // Degree of divergence
     const d = entropies.map(e => 1 - e);
     const dSum = d.reduce((a, b) => a + b, 0);
   
     if (dSum === 0) {
       // All equal — fallback to equal weights
       const w = 1 / cols.length;
       return Object.fromEntries(cols.map(c => [c, parseFloat(w.toFixed(4))]));
     }
   
     const weights = {};
     cols.forEach((col, i) => {
       weights[col] = parseFloat((d[i] / dSum).toFixed(4));
     });
   
     // Normalize to sum = 1
     return normalizeWeights(weights, cols);
   }
   
   function calcCriticWeights() {
     const cols = State.selectedCols;
     const rows = State.rawData.slice(1);
     const headers = State.rawData[0];
     const m = rows.length;
   
     // Get numeric matrix [row][col]
     const matrix = rows.map(row =>
       cols.map(col => parseFloat(row[headers.indexOf(col)]) || 0)
     );
   
     // Standard deviation for each col
     const stdDevs = cols.map((_, ci) => {
       const vals = matrix.map(row => row[ci]);
       const mean = vals.reduce((a, b) => a + b, 0) / m;
       const variance = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / m;
       return Math.sqrt(variance);
     });
   
     // Correlation matrix (Pearson)
     const corr = cols.map((_, ci) => cols.map((_, cj) => {
       if (ci === cj) return 1;
       const xi = matrix.map(r => r[ci]);
       const xj = matrix.map(r => r[cj]);
       const mi = xi.reduce((a, b) => a + b, 0) / m;
       const mj = xj.reduce((a, b) => a + b, 0) / m;
       const num = xi.reduce((s, v, k) => s + (v - mi) * (xj[k] - mj), 0);
       const di  = Math.sqrt(xi.reduce((s, v) => s + (v - mi) ** 2, 0));
       const dj  = Math.sqrt(xj.reduce((s, v) => s + (v - mj) ** 2, 0));
       return (di === 0 || dj === 0) ? 0 : num / (di * dj);
     }));
   
     // C_j = σ_j * sum(1 - r_jk) for all k
     const C = cols.map((_, ci) => {
       const symSum = cols.reduce((sum, _, cj) => sum + (1 - corr[ci][cj]), 0);
       return stdDevs[ci] * symSum;
     });
   
     const Csum = C.reduce((a, b) => a + b, 0);
     if (Csum === 0) {
       const w = 1 / cols.length;
       return Object.fromEntries(cols.map(c => [c, parseFloat(w.toFixed(4))]));
     }
   
     const weights = {};
     cols.forEach((col, i) => { weights[col] = parseFloat((C[i] / Csum).toFixed(4)); });
     return normalizeWeights(weights, cols);
   }
   
   function normalizeWeights(weights, cols) {
     const sum = cols.reduce((s, c) => s + (weights[c] || 0), 0);
     if (Math.abs(sum - 1) < 0.001) return weights;
     const out = {};
     cols.forEach(c => { out[c] = parseFloat((weights[c] / sum).toFixed(4)); });
     return out;
   }
   
   function checkStep3Valid() {
     const methodOk  = !!State.method;
     const total     = State.selectedCols.reduce((s, c) => s + (State.weights[c] || 0), 0);
     const weightOk  = Math.abs(total - 1) < 0.01;
   
     const btn = document.getElementById('btnStep3Next');
     if (btn) btn.disabled = !(methodOk && weightOk);
   }
   
   document.getElementById('btnStep3Back') && document.getElementById('btnStep3Back').addEventListener('click', () => goToStep(2));
   
   document.getElementById('btnStep3Next') && document.getElementById('btnStep3Next').addEventListener('click', () => {
     const total = State.selectedCols.reduce((s, c) => s + (State.weights[c] || 0), 0);
     if (Math.abs(total - 1) > 0.01) {
       showToast(`Total bobot harus 1.000. Sekarang: ${total.toFixed(3)}`, 'error');
       return;
     }
     goToStep(4);
   });
   
   /* ──────────────────────────────────────────
      STEP 4 — KONFIRMASI & PROSES
   ────────────────────────────────────────── */
   function initStep4() {
     const rows    = State.rawData.slice(1);
     const headers = State.rawData[0];
   
     // Summary cards
     const srcLabel = State.dataSource === 'file' ? State.fileName
                    : State.dataSource === 'sample' ? `Contoh (${State.fileName})`
                    : 'Input Manual';
   
     setEl('confirmDataValue',   srcLabel);
     setEl('confirmDataDetail',  `${rows.length} alternatif, ${State.selectedCols.length} kriteria`);
   
     const colsText  = State.selectedCols.slice(0,3).join(', ') + (State.selectedCols.length > 3 ? '…' : '');
     const typesText = State.selectedCols.map(c => State.criteriaTypes[c] === 'cost' ? '↓' : '↑').join(' ');
     setEl('confirmColsValue',   `${State.selectedCols.length} Kolom`);
     setEl('confirmColsDetail',  colsText + ' · ' + typesText);
   
     const METHOD_LABELS = { saw:'SAW', topsis:'TOPSIS', waspas:'WASPAS', moora:'MOORA', edas:'EDAS' };
     setEl('confirmMethodValue', METHOD_LABELS[State.method] || State.method.toUpperCase());
     setEl('confirmMethodDetail', State.method === 'waspas' ? `λ = ${State.lambda}` : '—');
   
     const wTotal = State.selectedCols.reduce((s, c) => s + (State.weights[c] || 0), 0);
     setEl('confirmWeightValue',  State.weightMethod.charAt(0).toUpperCase() + State.weightMethod.slice(1));
     setEl('confirmWeightDetail', `Total: ${wTotal.toFixed(3)} · ${State.selectedCols.length} kriteria`);
   
     // Detail table
     buildConfirmDetailTable();
   
     // Edit buttons
     document.querySelectorAll('.confirm-card-edit').forEach(btn => {
       btn.addEventListener('click', () => {
         const step = parseInt(btn.dataset.goto);
         if (step) goToStep(step);
       });
     });
   }
   
   function buildConfirmDetailTable() {
     const tbody   = document.getElementById('confirmDetailTbody');
     if (!tbody || !State.rawData) return;
   
     const headers = State.rawData[0];
     const rows    = State.rawData.slice(1);
   
     let html = '';
     State.selectedCols.forEach(col => {
       const ci   = headers.indexOf(col);
       const vals = rows.map(r => parseFloat(r[ci])).filter(v => !isNaN(v));
       const min  = vals.length ? Math.min(...vals) : '—';
       const max  = vals.length ? Math.max(...vals) : '—';
       const avg  = vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length) : '—';
       const type = State.criteriaTypes[col] || 'benefit';
       const w    = State.weights[col] || 0;
   
       html += `<tr>
         <td style="font-weight:500;color:var(--text-primary)">${escHtml(col)}</td>
         <td><span class="weight-input-type ${type}" style="font-size:0.72rem;padding:2px 8px;border-radius:999px;font-weight:600;">
           ${type === 'benefit' ? '+ Benefit' : '– Cost'}
         </span></td>
         <td style="font-family:'Syne',sans-serif;font-weight:700">${(w * 100).toFixed(1)}%</td>
         <td>${typeof min === 'number' ? min.toFixed(2) : min}</td>
         <td>${typeof max === 'number' ? max.toFixed(2) : max}</td>
         <td>${typeof avg === 'number' ? avg.toFixed(2) : avg}</td>
       </tr>`;
     });
   
     tbody.innerHTML = html;
   }
   
   document.getElementById('btnStep4Back') && document.getElementById('btnStep4Back').addEventListener('click', () => goToStep(3));
   
   document.getElementById('btnProcess') && document.getElementById('btnProcess').addEventListener('click', runProcess);
   
   async function runProcess() {
     const btnProcess = document.getElementById('btnProcess');
     const statusDiv  = document.getElementById('processStatus');
     const fillEl     = document.getElementById('processProgressFill');
     const labelEl    = document.getElementById('processProgressLabel');
   
     if (btnProcess) btnProcess.disabled = true;
     if (statusDiv)  statusDiv.style.display = 'block';
   
     function setProgress(pct, text) {
       if (fillEl)  fillEl.style.width = pct + '%';
       if (labelEl) labelEl.textContent = text;
     }
   
     try {
       setProgress(10, 'Mempersiapkan data…');
       await delay(200);
   
       setProgress(25, 'Membangun matriks keputusan…');
       const matrix = buildDecisionMatrix();
       await delay(200);
   
       setProgress(50, `Menjalankan metode ${State.method.toUpperCase()}…`);
       const result = runSPK(matrix);
       await delay(300);
   
       setProgress(80, 'Menyusun hasil ranking…');
       await delay(200);
   
       // Save to sessionStorage
       const payload = {
         method:        State.method,
         lambda:        State.lambda,
         weightMethod:  State.weightMethod,
         labelCol:      State.labelCol,
         selectedCols:  State.selectedCols,
         criteriaTypes: State.criteriaTypes,
         weights:       State.weights,
         dataSource:    State.dataSource,
         fileName:      State.fileName,
         rawData:       State.rawData,
         result:        result,
         showSteps:     document.getElementById('chkShowSteps')?.checked ?? true,
         compareAll:    document.getElementById('chkCompareAll')?.checked ?? false,
       };
   
       sessionStorage.setItem('spk_result', JSON.stringify(payload));
   
       setProgress(100, 'Selesai! Mengarahkan ke halaman hasil…');
       await delay(400);
   
       window.location.href = 'result.html';
   
     } catch(err) {
       showToast('Gagal memproses: ' + err.message, 'error');
       if (btnProcess) btnProcess.disabled = false;
       if (statusDiv)  statusDiv.style.display = 'none';
       console.error(err);
     }
   }
   
   /* ──────────────────────────────────────────
      SPK CALCULATION ENGINE
   ────────────────────────────────────────── */
   function buildDecisionMatrix() {
     const headers = State.rawData[0];
     const rows    = State.rawData.slice(1);
     const labelIdx = headers.indexOf(State.labelCol);
   
     const labels = rows.map(row =>
       labelIdx >= 0 ? String(row[labelIdx]) : `A${rows.indexOf(row)+1}`
     );
   
     const matrix = rows.map(row =>
       State.selectedCols.map(col => {
         const ci = headers.indexOf(col);
         return parseFloat(row[ci]) || 0;
       })
     );
   
     return { labels, matrix, cols: State.selectedCols };
   }
   
   function runSPK(dm) {
     switch (State.method) {
       case 'saw':    return calcSAW(dm);
       case 'topsis': return calcTOPSIS(dm);
       case 'waspas': return calcWASPAS(dm, State.lambda);
       case 'moora':  return calcMOORA(dm);
       case 'edas':   return calcEDAS(dm);
       default:       return calcSAW(dm);
     }
   }
   
   // ── SAW ──
   function calcSAW(dm) {
     const { labels, matrix, cols } = dm;
     const m = matrix.length;
     const n = cols.length;
   
     // Normalize
     const normalized = matrix.map(row => row.map(() => 0));
     for (let j = 0; j < n; j++) {
       const colVals = matrix.map(r => r[j]);
       const max = Math.max(...colVals);
       const min = Math.min(...colVals);
       const type = State.criteriaTypes[cols[j]] || 'benefit';
   
       for (let i = 0; i < m; i++) {
         if (type === 'benefit') {
           normalized[i][j] = max === 0 ? 0 : matrix[i][j] / max;
         } else {
           normalized[i][j] = matrix[i][j] === 0 ? 0 : min / matrix[i][j];
         }
       }
     }
   
     // Weighted sum
     const scores = matrix.map((_, i) => {
       return cols.reduce((sum, col, j) => {
         return sum + (State.weights[col] || 0) * normalized[i][j];
       }, 0);
     });
   
     return buildRanking(labels, scores, { normalized, method: 'SAW' });
   }
   
   // ── TOPSIS ──
   function calcTOPSIS(dm) {
     const { labels, matrix, cols } = dm;
     const m = matrix.length;
     const n = cols.length;
   
     // Vector normalization
     const normalized = matrix.map(row => row.slice());
     for (let j = 0; j < n; j++) {
       const norm = Math.sqrt(matrix.reduce((s, r) => s + r[j] ** 2, 0));
       for (let i = 0; i < m; i++) {
         normalized[i][j] = norm === 0 ? 0 : matrix[i][j] / norm;
       }
     }
   
     // Weighted normalized
     const weighted = normalized.map(row =>
       row.map((v, j) => v * (State.weights[cols[j]] || 0))
     );
   
     // Ideal solutions
     const idealPos = cols.map((col, j) => {
       const vals = weighted.map(r => r[j]);
       return (State.criteriaTypes[col] || 'benefit') === 'benefit'
         ? Math.max(...vals) : Math.min(...vals);
     });
     const idealNeg = cols.map((col, j) => {
       const vals = weighted.map(r => r[j]);
       return (State.criteriaTypes[col] || 'benefit') === 'benefit'
         ? Math.min(...vals) : Math.max(...vals);
     });
   
     // Distances
     const dPos = weighted.map(row =>
       Math.sqrt(row.reduce((s, v, j) => s + (v - idealPos[j]) ** 2, 0))
     );
     const dNeg = weighted.map(row =>
       Math.sqrt(row.reduce((s, v, j) => s + (v - idealNeg[j]) ** 2, 0))
     );
   
     // Closeness coefficient
     const scores = dPos.map((dp, i) => {
       const dn = dNeg[i];
       return (dp + dn) === 0 ? 0 : dn / (dp + dn);
     });
   
     return buildRanking(labels, scores, { normalized, weighted, idealPos, idealNeg, dPos, dNeg, method: 'TOPSIS' });
   }
   
   // ── WASPAS ──
   function calcWASPAS(dm, lambda) {
     const { labels, matrix, cols } = dm;
     const m = matrix.length;
     const n = cols.length;
   
     // Normalize (linear, same as SAW)
     const normalized = matrix.map(row => row.map(() => 0));
     for (let j = 0; j < n; j++) {
       const colVals = matrix.map(r => r[j]);
       const max = Math.max(...colVals);
       const min = Math.min(...colVals);
       const type = State.criteriaTypes[cols[j]] || 'benefit';
       for (let i = 0; i < m; i++) {
         normalized[i][j] = type === 'benefit'
           ? (max === 0 ? 0 : matrix[i][j] / max)
           : (matrix[i][j] === 0 ? 0 : min / matrix[i][j]);
       }
     }
   
     // WSM score
     const wsm = matrix.map((_, i) =>
       cols.reduce((s, col, j) => s + (State.weights[col] || 0) * normalized[i][j], 0)
     );
   
     // WPM score
     const wpm = matrix.map((_, i) =>
       cols.reduce((prod, col, j) => prod * (normalized[i][j] ** (State.weights[col] || 0)), 1)
     );
   
     const scores = wsm.map((w, i) => lambda * w + (1 - lambda) * wpm[i]);
   
     return buildRanking(labels, scores, { normalized, wsm, wpm, method: 'WASPAS' });
   }
   
   // ── MOORA ──
   function calcMOORA(dm) {
     const { labels, matrix, cols } = dm;
     const m = matrix.length;
     const n = cols.length;
   
     // Vector normalization
     const normalized = matrix.map(row => row.slice());
     for (let j = 0; j < n; j++) {
       const norm = Math.sqrt(matrix.reduce((s, r) => s + r[j] ** 2, 0));
       for (let i = 0; i < m; i++) {
         normalized[i][j] = norm === 0 ? 0 : matrix[i][j] / norm;
       }
     }
   
     // Weighted normalized
     const weighted = normalized.map(row =>
       row.map((v, j) => v * (State.weights[cols[j]] || 0))
     );
   
     // Yi = sum(benefit) – sum(cost)
     const scores = weighted.map(row =>
       cols.reduce((s, col, j) => {
         const type = State.criteriaTypes[col] || 'benefit';
         return type === 'benefit' ? s + row[j] : s - row[j];
       }, 0)
     );
   
     return buildRanking(labels, scores, { normalized, weighted, method: 'MOORA' });
   }
   
   // ── EDAS ──
   function calcEDAS(dm) {
     const { labels, matrix, cols } = dm;
     const m = matrix.length;
     const n = cols.length;
   
     // Average solution
     const avgSol = cols.map((_, j) => matrix.reduce((s, r) => s + r[j], 0) / m);
   
     // PDA and NDA
     const PDA = matrix.map(row =>
       cols.map((col, j) => {
         const type = State.criteriaTypes[col] || 'benefit';
         const diff = type === 'benefit'
           ? Math.max(0, row[j] - avgSol[j])
           : Math.max(0, avgSol[j] - row[j]);
         return avgSol[j] === 0 ? 0 : diff / avgSol[j];
       })
     );
   
     const NDA = matrix.map(row =>
       cols.map((col, j) => {
         const type = State.criteriaTypes[col] || 'benefit';
         const diff = type === 'benefit'
           ? Math.max(0, avgSol[j] - row[j])
           : Math.max(0, row[j] - avgSol[j]);
         return avgSol[j] === 0 ? 0 : diff / avgSol[j];
       })
     );
   
     // Weighted SP and SN
     const SP = PDA.map(row => cols.reduce((s, col, j) => s + (State.weights[col] || 0) * row[j], 0));
     const SN = NDA.map(row => cols.reduce((s, col, j) => s + (State.weights[col] || 0) * row[j], 0));
   
     const maxSP = Math.max(...SP);
     const maxSN = Math.max(...SN);
   
     // Normalized SP and SN
     const NSP = SP.map(v => maxSP === 0 ? 0 : v / maxSP);
     const NSN = SN.map(v => maxSN === 0 ? 1 - v / maxSN : 1 - v / maxSN);
   
     // Appraisal score
     const scores = NSP.map((v, i) => 0.5 * (v + NSN[i]));
   
     return buildRanking(labels, scores, { avgSol, PDA, NDA, SP, SN, NSP, NSN, method: 'EDAS' });
   }
   
   function buildRanking(labels, scores, extra) {
     const ranked = labels
       .map((label, i) => ({ label, score: scores[i], originalIndex: i }))
       .sort((a, b) => b.score - a.score)
       .map((item, rank) => ({ ...item, rank: rank + 1 }));
   
     return { labels, scores, ranked, ...extra };
   }
   
   /* ──────────────────────────────────────────
      HELPER: RENDER TABLE
   ────────────────────────────────────────── */
   function renderPreviewTable(data, theadId, tbodyId, maxRows) {
     const thead = document.getElementById(theadId);
     const tbody = document.getElementById(tbodyId);
     if (!thead || !tbody || !data || data.length === 0) return;
   
     // Header
     thead.innerHTML = '<tr>' + data[0].map(h =>
       `<th>${escHtml(String(h))}</th>`
     ).join('') + '</tr>';
   
     // Body
     const rows = data.slice(1, maxRows + 1);
     tbody.innerHTML = rows.map(row =>
       '<tr>' + row.map(cell => `<td>${escHtml(String(cell ?? ''))}</td>`).join('') + '</tr>'
     ).join('');
   
     // If there are more rows
     if (data.length - 1 > maxRows) {
       const remaining = data.length - 1 - maxRows;
       tbody.innerHTML += `<tr><td colspan="${data[0].length}" style="text-align:center;color:var(--text-muted);font-style:italic;padding:10px;">
         … dan ${remaining} baris lainnya
       </td></tr>`;
     }
   }
   
   /* ──────────────────────────────────────────
      UTILITIES
   ────────────────────────────────────────── */
   function setEl(id, text) {
     const el = document.getElementById(id);
     if (el) el.textContent = text;
   }
   
   function escHtml(str) {
     return String(str)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;');
   }
   
   function delay(ms) {
     return new Promise(resolve => setTimeout(resolve, ms));
   }
   
   function showToast(message, type) {
     if (window.Toast) {
       window.Toast.show(message);
     } else {
       console.log('[Toast]', message);
     }
   }
   
   /* ──────────────────────────────────────────
      INIT
   ────────────────────────────────────────── */
   (function init() {
     // Show step 1 by default
     goToStep(1);
   
     // If sessionStorage has previous data (coming back), restore
     try {
       const saved = sessionStorage.getItem('spk_input_state');
       if (saved) {
         const prev = JSON.parse(saved);
         // We only restore method preference if available
         if (prev.method) State.method = prev.method;
       }
     } catch(e) { /* ignore */ }
   })();