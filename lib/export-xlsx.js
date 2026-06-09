/* ============================================
   SPK MODULES — export-xlsx.js
   Export hasil SPK ke file .xlsx dengan:
   - Sheet 1: Dataset asli + normalisasi (di samping)
   - Sheet 2: Perhitungan semua tahap per metode
   - Sheet 3: Ranking final
   
   Formula Excel disertakan dengan cached value
   sehingga user melihat nilai, klik cell lihat formula.
   
   Dependensi: SheetJS (xlsx.full.min.js)
   ============================================ */

   'use strict';

   /* ──────────────────────────────────────────
      STYLE HELPERS
      Warna dan font konsisten di semua sheet
   ────────────────────────────────────────── */
   const XStyle = {
     // Header utama (judul section)
     sectionTitle: {
       font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
       fill: { fgColor: { rgb: '1A1917' } },
       alignment: { horizontal: 'left', vertical: 'center' },
       border: _allBorder('FF000000'),
     },
     // Header kolom tabel
     colHeader: {
       font: { bold: true, sz: 10, color: { rgb: '1A1917' } },
       fill: { fgColor: { rgb: 'ECEAE4' } },
       alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
       border: _allBorder('FFAAAAAA'),
     },
     // Sub-header tipe kriteria (Benefit/Cost)
     typeHeader: {
       font: { bold: true, sz: 9 },
       alignment: { horizontal: 'center' },
       border: _allBorder('FFAAAAAA'),
     },
     // Cell data biasa
     data: {
       font: { sz: 10 },
       alignment: { horizontal: 'center', vertical: 'center' },
       border: _allBorder('FFDDDDDD'),
     },
     // Cell data label alternatif (kolom pertama)
     label: {
       font: { bold: true, sz: 10 },
       alignment: { horizontal: 'left', vertical: 'center' },
       border: _allBorder('FFDDDDDD'),
     },
     // Cell formula / nilai kalkulasi
     formula: {
       font: { sz: 10, color: { rgb: '0A5C9E' } },
       alignment: { horizontal: 'center', vertical: 'center' },
       border: _allBorder('FFDDDDDD'),
       numFmt: '0.0000',
     },
     // Cell ranking terbaik (rank 1)
     rank1: {
       font: { bold: true, sz: 10, color: { rgb: '78350F' } },
       fill: { fgColor: { rgb: 'FBBF24' } },
       alignment: { horizontal: 'center' },
       border: _allBorder('FFDDDDDD'),
     },
     // Cell ranking 2
     rank2: {
       font: { bold: true, sz: 10, color: { rgb: '1F2937' } },
       fill: { fgColor: { rgb: 'E5E7EB' } },
       alignment: { horizontal: 'center' },
       border: _allBorder('FFDDDDDD'),
     },
     // Cell ranking 3
     rank3: {
       font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
       fill: { fgColor: { rgb: 'CD7C32' } },
       alignment: { horizontal: 'center' },
       border: _allBorder('FFDDDDDD'),
     },
   };
   
   function _allBorder(color) {
     const b = { style: 'thin', color: { rgb: color } };
     return { top: b, bottom: b, left: b, right: b };
   }
   
   /* ──────────────────────────────────────────
      UTILITY: buat cell dengan style + value
   ────────────────────────────────────────── */
   function _cell(v, style, formula, numFmt) {
     const c = { v, t: typeof v === 'number' ? 'n' : 's', s: style };
     if (formula) c.f = formula;
     if (numFmt)  c.z = numFmt;
     return c;
   }
   
   function _numCell(v, formula, style) {
     return _cell(v, style || XStyle.formula, formula, '0.0000');
   }
   
   function _labelCell(v) {
     return _cell(String(v), XStyle.label);
   }
   
   function _headerCell(v) {
     return _cell(String(v), XStyle.colHeader);
   }
   
   function _sectionCell(v) {
     return _cell(String(v), XStyle.sectionTitle);
   }
   
   /* ──────────────────────────────────────────
      UTILITY: konversi index kolom → huruf Excel
      0 → A, 1 → B, 25 → Z, 26 → AA, dst
   ────────────────────────────────────────── */
   function _col(idx) {
     let result = '';
     let n = idx;
     do {
       result = String.fromCharCode(65 + (n % 26)) + result;
       n = Math.floor(n / 26) - 1;
     } while (n >= 0);
     return result;
   }
   
   /* ──────────────────────────────────────────
      UTILITY: addr → "A1" dari (row, col) 0-indexed
   ────────────────────────────────────────── */
   function _addr(row, col) {
     return _col(col) + (row + 1);
   }
   
   /* ──────────────────────────────────────────
      UTILITY: tulis blok tabel ke ws (worksheet object)
      ws     : { cells: {}, merges: [], colWidths: [] }
      startR : baris mulai (0-indexed)
      startC : kolom mulai (0-indexed)
      returns: baris berikutnya setelah tabel
   ────────────────────────────────────────── */
   function _writeBlock(ws, startR, startC, rows) {
     rows.forEach((row, ri) => {
       row.forEach((cell, ci) => {
         if (cell !== null && cell !== undefined) {
           ws.cells[_addr(startR + ri, startC + ci)] = cell;
         }
       });
     });
   }
   
   /* ──────────────────────────────────────────
      UTILITY: tulis section title (1 baris penuh)
   ────────────────────────────────────────── */
   function _writeSectionTitle(ws, row, col, text, spanCols, merges) {
     ws.cells[_addr(row, col)] = _sectionCell(text);
     if (spanCols > 1 && merges) {
       merges.push({
         s: { r: row, c: col },
         e: { r: row, c: col + spanCols - 1 },
       });
     }
   }
   
   /* ──────────────────────────────────────────
      KONVERSI ws object → SheetJS worksheet
   ────────────────────────────────────────── */
   function _toSheetJS(ws) {
     const sheet = {};
     let maxR = 0;
     let maxC = 0;
   
     Object.entries(ws.cells).forEach(([addr, cell]) => {
       sheet[addr] = cell;
       // parse addr untuk ref range
       const match = addr.match(/([A-Z]+)(\d+)/);
       if (match) {
         const c = match[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
         const r = parseInt(match[2]) - 1;
         if (r > maxR) maxR = r;
         if (c > maxC) maxC = c;
       }
     });
   
     sheet['!ref'] = `A1:${_col(maxC)}${maxR + 1}`;
   
     if (ws.merges && ws.merges.length) {
       sheet['!merges'] = ws.merges;
     }
   
     if (ws.colWidths && ws.colWidths.length) {
       sheet['!cols'] = ws.colWidths.map(w => ({ wch: w }));
     }
   
     return sheet;
   }
   
   /* ══════════════════════════════════════════
      SHEET 1 — DATASET + NORMALISASI
   ══════════════════════════════════════════ */
   function buildSheet1(R) {
     const ws    = { cells: {}, merges: [], colWidths: [] };
     const { rawData, labelCol, selectedCols, criteriaTypes, weights, method } = R;
     const headers  = rawData[0];
     const dataRows = rawData.slice(1);
     const labelIdx = headers.indexOf(labelCol);
     const m        = dataRows.length;
     const n        = selectedCols.length;
   
     // ── Tentukan apakah metode butuh normalisasi ──
     const needsNorm = ['saw', 'topsis', 'waspas', 'moora', 'edas'].includes(method);
   
     // ── Kolom: [Label, ...selectedCols] ──
     // Tabel asli mulai di kolom 0
     // Tabel normalisasi mulai di kolom n+2 (ada 1 kolom gap)
   
     const dataStartC = 0;
     const normStartC = needsNorm ? n + 2 : null; // +1 label +1 gap
   
     // ── Section title: Dataset Asli ──
     let r = 0;
     _writeSectionTitle(ws, r, dataStartC, '📊 DATASET ASLI', n + 1, ws.merges);
     if (normStartC !== null) {
       _writeSectionTitle(ws, r, normStartC, '📐 MATRIKS NORMALISASI', n + 1, ws.merges);
     }
     r++;
   
     // ── Sub-header: bobot dan tipe ──
     // Baris bobot
     ws.cells[_addr(r, dataStartC)] = _cell('Bobot →', XStyle.typeHeader);
     selectedCols.forEach((col, ci) => {
       const w = weights[col] || 0;
       ws.cells[_addr(r, dataStartC + 1 + ci)] = _cell(
         parseFloat((w * 100).toFixed(2)) + '%', XStyle.typeHeader
       );
     });
     if (normStartC !== null) {
       ws.cells[_addr(r, normStartC)] = _cell('Bobot →', XStyle.typeHeader);
       selectedCols.forEach((col, ci) => {
         const w = weights[col] || 0;
         ws.cells[_addr(r, normStartC + 1 + ci)] = _cell(
           parseFloat((w * 100).toFixed(2)) + '%', XStyle.typeHeader
         );
       });
     }
     r++;
   
     // Baris tipe Benefit/Cost
     ws.cells[_addr(r, dataStartC)] = _cell('Tipe →', XStyle.typeHeader);
     selectedCols.forEach((col, ci) => {
       const type = criteriaTypes[col] || 'benefit';
       const cell = {
         v: type === 'benefit' ? 'Benefit (+)' : 'Cost (−)',
         t: 's',
         s: {
           ...XStyle.typeHeader,
           font: {
             ...XStyle.typeHeader.font,
             bold: true,
             color: { rgb: type === 'benefit' ? '0A7A4A' : 'D4570A' },
           },
         },
       };
       ws.cells[_addr(r, dataStartC + 1 + ci)] = cell;
     });
     if (normStartC !== null) {
       ws.cells[_addr(r, normStartC)] = _cell('Tipe →', XStyle.typeHeader);
       selectedCols.forEach((col, ci) => {
         const type = criteriaTypes[col] || 'benefit';
         ws.cells[_addr(r, normStartC + 1 + ci)] = {
           v: type === 'benefit' ? 'Benefit (+)' : 'Cost (−)',
           t: 's',
           s: {
             ...XStyle.typeHeader,
             font: { bold: true, color: { rgb: type === 'benefit' ? '0A7A4A' : 'D4570A' } },
           },
         };
       });
     }
     r++;
   
     // ── Header kolom ──
     ws.cells[_addr(r, dataStartC)] = _headerCell(labelCol);
     selectedCols.forEach((col, ci) => {
       ws.cells[_addr(r, dataStartC + 1 + ci)] = _headerCell(col);
     });
     if (normStartC !== null) {
       ws.cells[_addr(r, normStartC)] = _headerCell(labelCol);
       selectedCols.forEach((col, ci) => {
         ws.cells[_addr(r, normStartC + 1 + ci)] = _headerCell(col + '\n(norm)');
       });
     }
     r++;
   
     // ── Baris data + normalisasi ──
     // Hitung dulu max/min tiap kolom untuk formula
     const dataRowStart = r; // baris Excel pertama data (0-indexed)
   
     dataRows.forEach((row, ri) => {
       // Label
       const lbl = labelIdx >= 0 ? row[labelIdx] : `A${ri + 1}`;
       ws.cells[_addr(r + ri, dataStartC)] = _labelCell(lbl);
   
       // Nilai asli
       selectedCols.forEach((col, ci) => {
         const colIdx  = headers.indexOf(col);
         const val     = parseFloat(row[colIdx]) || 0;
         ws.cells[_addr(r + ri, dataStartC + 1 + ci)] = _numCell(val, null, XStyle.data);
       });
   
       // Normalisasi
       if (normStartC !== null) {
         ws.cells[_addr(r + ri, normStartC)] = _labelCell(lbl);
   
         selectedCols.forEach((col, ci) => {
           const type    = criteriaTypes[col] || 'benefit';
           const colIdx  = headers.indexOf(col);
           const val     = parseFloat(row[colIdx]) || 0;
           const srcCol  = _col(dataStartC + 1 + ci);
   
           // Range data kolom ini (absolut row)
           const dataFirst = dataRowStart + 1; // Excel 1-indexed
           const dataLast  = dataRowStart + m;
           const range     = `${srcCol}$${dataFirst}:${srcCol}$${dataLast}`;
   
           // Nilai normalisasi (dihitung JS untuk cached value)
           const colVals = dataRows.map(dr => parseFloat(dr[headers.indexOf(col)]) || 0);
           const maxVal  = Math.max(...colVals);
           const minVal  = Math.min(...colVals);
           let normVal, formula;
   
           if (method === 'topsis' || method === 'moora') {
             // Normalisasi vektor Euclidean
             const norm = Math.sqrt(colVals.reduce((s, v) => s + v ** 2, 0));
             normVal = norm === 0 ? 0 : val / norm;
             const normFormula = `SQRT(SUMPRODUCT(${range},${range}))`;
             formula = `${srcCol}${dataRowStart + ri + 1}/IFERROR(${normFormula},1)`;
           } else {
             // Normalisasi linear (SAW, WASPAS, EDAS)
             if (type === 'benefit') {
               normVal = maxVal === 0 ? 0 : val / maxVal;
               formula = `${srcCol}${dataRowStart + ri + 1}/IFERROR(MAX(${range}),1)`;
             } else {
               normVal = val === 0 ? 0 : minVal / val;
               formula = `IFERROR(MIN(${range})/${srcCol}${dataRowStart + ri + 1},0)`;
             }
           }
   
           ws.cells[_addr(r + ri, normStartC + 1 + ci)] = _numCell(normVal, formula);
         });
       }
     });
   
     r += m;
   
     // ── Set lebar kolom ──
     const totalCols = normStartC !== null ? normStartC + n + 2 : n + 2;
     ws.colWidths = Array(totalCols).fill(0).map((_, i) => {
       if (i === dataStartC || i === normStartC) return 18; // label
       if (normStartC !== null && i === n + 1) return 3;   // gap
       return 14;
     });
   
     return ws;
   }
   
   /* ══════════════════════════════════════════
      SHEET 2 — PERHITUNGAN TAHAP PER METODE
   ══════════════════════════════════════════ */
   function buildSheet2(R) {
     const ws = { cells: {}, merges: [], colWidths: [] };
     const builders = {
       saw:    _calcSAW,
       topsis: _calcTOPSIS,
       waspas: _calcWASPAS,
       moora:  _calcMOORA,
       edas:   _calcEDAS,
     };
   
     const builder = builders[R.method];
     if (!builder) return ws;
   
     builder(ws, R);
     return ws;
   }
   
   /* ──────────────────────────────────────────
      Helper: tulis blok tabel perhitungan
      dengan section title + header + rows
   ────────────────────────────────────────── */
   function _writeCalcTable(ws, startR, title, desc, colHeaders, dataRows, merges) {
     const totalCols = colHeaders.length;
     let r = startR;
   
     // Section title
     _writeSectionTitle(ws, r, 0, title, totalCols, merges);
     r++;
   
     // Deskripsi (jika ada)
     if (desc) {
       ws.cells[_addr(r, 0)] = _cell(desc, {
         font: { italic: true, sz: 9, color: { rgb: '666666' } },
         alignment: { horizontal: 'left' },
       });
       if (totalCols > 1 && merges) {
         merges.push({ s: { r, c: 0 }, e: { r, c: totalCols - 1 } });
       }
       r++;
     }
   
     // Header baris
     colHeaders.forEach((h, ci) => {
       ws.cells[_addr(r, ci)] = _headerCell(h);
     });
     r++;
   
     // Data rows
     dataRows.forEach(row => {
       row.forEach((cell, ci) => {
         if (cell !== null && cell !== undefined) {
           ws.cells[_addr(r, ci)] = cell;
         }
       });
       r++;
     });
   
     return r + 1; // +1 baris gap
   }
   
   /* ──────────────────────────────────────────
      Ambil matrix numerik dari rawData
   ────────────────────────────────────────── */
   function _getMatrix(R) {
     const { rawData, labelCol, selectedCols } = R;
     const headers  = rawData[0];
     const dataRows = rawData.slice(1);
     const labelIdx = headers.indexOf(labelCol);
     const labels   = dataRows.map((r, i) => labelIdx >= 0 ? String(r[labelIdx]) : `A${i + 1}`);
     const matrix   = dataRows.map(row =>
       selectedCols.map(col => parseFloat(row[headers.indexOf(col)]) || 0)
     );
     return { labels, matrix };
   }
   
   /* ============================================
   PATCH — _calcSAW dengan Formula Excel
   
   Ganti fungsi _calcSAW() yang lama di
   file lib/export-xlsx.js dengan fungsi ini.
   
   Formula yang ditambahkan:
   
   TAHAP 1 — Matriks Awal:
     Tidak ada formula (nilai mentah dari data)
   
   TAHAP 2 — Normalisasi:
     Benefit → =B_raw / MAX($B$first:$B$last)
     Cost    → =MIN($B$first:$B$last) / B_raw
               dengan IFERROR untuk hindari #DIV/0
   
   TAHAP 3 — Skor Akhir:
     Rank  → =RANK(C_score, $C$range, 0)
     Skor  → =SUMPRODUCT({w1,w2,...,wn}, norm_row_range)
   ============================================ */
    function _setDefaultColWidths(ws, colCount) {
      ws.colWidths = [18, ...Array(Math.max(colCount - 1, 0)).fill(14)];
    }
    function _calcSAW(ws, R) {
      const { selectedCols, criteriaTypes, weights } = R;
      const { labels, matrix } = _getMatrix(R);
      const m = matrix.length;   // jumlah alternatif
      const n = selectedCols.length; // jumlah kriteria
      let r = 0;

      /* ─────────────────────────────────────────
        TAHAP 1 — Matriks Keputusan Awal
        Layout:
          r+0 : section title
          r+1 : desc
          r+2 : header
          r+3 : data A1        ← t1DataFirst (0-indexed) → Excel = r+3+1 = r+4
          ...
          r+2+m : data Am
          r+2+m+1 : gap (dari return _writeCalcTable)
      ───────────────────────────────────────── */
      const t1Start = r; // baris mulai tahap 1 (0-indexed)

      const headers1 = ['Alternatif', ...selectedCols];
      const rows1 = labels.map((lbl, i) => [
        _labelCell(lbl),
        ...matrix[i].map(v => _numCell(v, null, XStyle.data)),
      ]);

      r = _writeCalcTable(
        ws, r,
        '📋 TAHAP 1 — Matriks Keputusan Awal (X)',
        'Nilai asli setiap alternatif pada setiap kriteria.',
        headers1, rows1, ws.merges
      );

      // Hitung posisi Excel (1-indexed) untuk baris data Tahap 1
      // _writeCalcTable: title(+1) + desc(+1) + header(+1) + m data rows
      // → data mulai di: t1Start + 3  (0-indexed) → Excel = t1Start + 4
      const t1DataFirstExcel = t1Start + 4; // Excel row alternatif pertama T1
      const t1DataLastExcel  = t1DataFirstExcel + m - 1;

      /* ─────────────────────────────────────────
        TAHAP 2 — Normalisasi Linear
        
        Referensi sumber: kolom B, C, D, ... di Tahap 1
        Kolom mapping (0-indexed di sheet):
          col 0 = A = label alternatif
          col 1 = B = kriteria ke-1
          col 2 = C = kriteria ke-2
          ...
          col n = n+1 = kriteria ke-n (= n karena 0-indexed col)

        Layout setelah rows2.unshift():
          r+0 : section title
          r+1 : desc
          r+2 : header
          r+3 : baris "Formula →"  ← unshift row (BUKAN data)
          r+4 : norm A1            ← t2DataFirst
          ...
          r+3+m : norm Am
          r+3+m+1 : gap
      ───────────────────────────────────────── */
      const t2Start = r; // baris mulai tahap 2 (0-indexed)

      // Hitung normalisasi (cached value tetap dihitung JS)
      const normalized = matrix.map(row => row.slice());
      for (let j = 0; j < n; j++) {
        const vals = matrix.map(rr => rr[j]);
        const max  = Math.max(...vals);
        const min  = Math.min(...vals);
        const type = criteriaTypes[selectedCols[j]] || 'benefit';
        for (let i = 0; i < m; i++) {
          normalized[i][j] = type === 'benefit'
            ? (max === 0 ? 0 : matrix[i][j] / max)
            : (matrix[i][j] === 0 ? 0 : min / matrix[i][j]);
        }
      }

      // Baris unshift (keterangan formula per kolom)
      const formulaNoteRow = [
        _cell('Formula:', {
          font: { italic: true, sz: 8, color: { rgb: '888888' } },
          alignment: { horizontal: 'left' },
        }),
        ...selectedCols.map(col => {
          const type = criteriaTypes[col] || 'benefit';
          return _cell(
            type === 'benefit' ? '= xij / MAX(kolom)' : '= MIN(kolom) / xij',
            {
              font: { italic: true, sz: 8, color: { rgb: '0A5C9E' } },
              alignment: { horizontal: 'center' },
            }
          );
        }),
      ];

      // Bangun rows2 dengan formula per cell
      // t2DataFirstExcel = t2Start + title(1) + desc(1) + header(1) + unshiftRow(1) + 1(1-indexed)
      //                 = t2Start + 5
      const t2DataFirstExcel = t2Start + 5;

      const rows2 = labels.map((lbl, i) => {
        const excelRow = t2DataFirstExcel + i; // baris Excel untuk alternatif i

        return [
          _labelCell(lbl),
          ...selectedCols.map((col, j) => {
            const type     = criteriaTypes[col] || 'benefit';
            const srcColLetter = _col(j + 1); // +1 karena col 0 = A = label

            // Range absolut kolom sumber di Tahap 1
            const srcRange = `$${srcColLetter}$${t1DataFirstExcel}:$${srcColLetter}$${t1DataLastExcel}`;

            // Cell sumber untuk baris ini di Tahap 1
            const srcCell  = `${srcColLetter}${t1DataFirstExcel + i}`;

            let formula, normVal;
            if (type === 'benefit') {
              formula = `IFERROR(${srcCell}/MAX(${srcRange}),0)`;
              normVal = normalized[i][j];
            } else {
              formula = `IFERROR(MIN(${srcRange})/${srcCell},0)`;
              normVal = normalized[i][j];
            }

            return {
              v: parseFloat(normVal.toFixed(6)),
              t: 'n',
              s: XStyle.formula,
              f: formula,
              z: '0.0000',
            };
          }),
        ];
      });

      // Sisipkan baris note di posisi pertama (sebelum data)
      rows2.unshift(formulaNoteRow);

      r = _writeCalcTable(
        ws, r,
        '📐 TAHAP 2 — Normalisasi Linear (r)',
        'Benefit: r = x / MAX(kolom) | Cost: r = MIN(kolom) / x',
        headers1, rows2, ws.merges
      );

      /* ─────────────────────────────────────────
        TAHAP 3 — Skor Akhir SAW (V)
        
        Formula Skor V:
          =SUMPRODUCT({w1,w2,...,wn}, norm_row)
          
          Contoh n=4, bobot=[0.25,0.25,0.25,0.25]:
          =SUMPRODUCT({0.25,0.25,0.25,0.25}, B13:E13)
          
        Formula Rank:
          =RANK(C{row}, $C$scoreFirst:$C$scoreLast, 0)
          
        Layout setelah rows3.unshift():
          t3Start+0 : section title
          t3Start+1 : desc
          t3Start+2 : header
          t3Start+3 : baris "Formula →"   ← unshift row
          t3Start+4 : ranked[0]           ← scoreFirstExcel
          ...
      ───────────────────────────────────────── */
      const t3Start = r;

      // Hitung skor (cached)
      const scores = matrix.map((_, i) =>
        selectedCols.reduce((s, col, j) => s + (weights[col] || 0) * normalized[i][j], 0)
      );

      // Buat ranked array dengan index original untuk referensi norm row
      const ranked = labels
        .map((lbl, i) => ({ lbl, score: scores[i], origIdx: i }))
        .sort((a, b) => b.score - a.score)
        .map((item, ri) => ({ ...item, rank: ri + 1 }));

      // t3DataFirstExcel = t3Start + title(1) + desc(1) + header(1) + unshift(1) + 1-indexed(1)
      //                 = t3Start + 5
      const t3DataFirstExcel = t3Start + 5;
      const t3DataLastExcel  = t3DataFirstExcel + m - 1;

      // Range skor untuk RANK()
      const scoreColLetter = 'C'; // kolom C = Skor V (col index 2)
      const scoreRange = `$${scoreColLetter}$${t3DataFirstExcel}:$${scoreColLetter}$${t3DataLastExcel}`;

      // Array bobot sebagai konstanta Excel: {0.25,0.25,0.25,0.25}
      const weightsArray = '{' + selectedCols.map(col => (weights[col] || 0)).join(',') + '}';

      const rows3 = ranked.map((item, idx) => {
        const excelRow      = t3DataFirstExcel + idx;
        const normExcelRow  = t2DataFirstExcel + item.origIdx; // baris normalisasi alternatif ini

        // Range baris normalisasi untuk SUMPRODUCT
        // col 1 = B (kriteria pertama), col n = _col(n) (kriteria terakhir)
        const normFirstColLetter = _col(1); // B
        const normLastColLetter  = _col(n); // tergantung n
        const normRowRange = `${normFirstColLetter}${normExcelRow}:${normLastColLetter}${normExcelRow}`;

        const rankStyle = item.rank === 1 ? XStyle.rank1
                        : item.rank === 2 ? XStyle.rank2
                        : item.rank === 3 ? XStyle.rank3
                        : XStyle.data;

        return [
          // Kolom A — Rank
          {
            v: item.rank,
            t: 'n',
            s: rankStyle,
            f: `RANK(${scoreColLetter}${excelRow},${scoreRange},0)`,
          },
          // Kolom B — Alternatif
          _labelCell(item.lbl),
          // Kolom C — Skor V
          {
            v: parseFloat(item.score.toFixed(6)),
            t: 'n',
            s: XStyle.formula,
            f: `SUMPRODUCT(${weightsArray},${normRowRange})`,
            z: '0.0000',
          },
        ];
      });

      // Baris keterangan formula (unshift)
      rows3.unshift([
        _cell('', XStyle.colHeader),
        _cell('Formula Skor V →', {
          font: { italic: true, sz: 8, color: { rgb: '888888' } },
        }),
        _cell(`=SUMPRODUCT({bobot}, baris_normalisasi)`, {
          font: { italic: true, sz: 8, color: { rgb: '0A5C9E' } },
          alignment: { horizontal: 'left' },
        }),
      ]);

      r = _writeCalcTable(
        ws, r,
        '🏆 TAHAP 3 — Skor Akhir SAW (V)',
        'V = Σ (wj × rij) | Alternatif dengan V tertinggi adalah terbaik.',
        ['Rank', 'Alternatif', 'Skor V'],
        rows3, ws.merges
      );

      _setDefaultColWidths(ws, n + 2);
    }
   
   /* ──────────────────────────────────────────
      TOPSIS — 6 tahap
   ────────────────────────────────────────── */
   function _calcTOPSIS(ws, R) {
     const { selectedCols, criteriaTypes, weights } = R;
     const { labels, matrix } = _getMatrix(R);
     const m = matrix.length;
     const n = selectedCols.length;
     let r = 0;
   
     // Tahap 1: Matriks asli
     r = _writeCalcTable(ws, r, '📋 TAHAP 1 — Matriks Keputusan Awal',
       null, ['Alternatif', ...selectedCols],
       labels.map((lbl, i) => [_labelCell(lbl), ...matrix[i].map(v => _numCell(v, null, XStyle.data))]),
       ws.merges);
   
     // Tahap 2: Normalisasi vektor
     const norm = matrix.map(rr => rr.slice());
     for (let j = 0; j < n; j++) {
       const d = Math.sqrt(matrix.reduce((s, rr) => s + rr[j] ** 2, 0));
       for (let i = 0; i < m; i++) norm[i][j] = d === 0 ? 0 : matrix[i][j] / d;
     }
     r = _writeCalcTable(ws, r, '📐 TAHAP 2 — Normalisasi Vektor (r)',
       'rij = xij / √(Σ xij²)', ['Alternatif', ...selectedCols],
       labels.map((lbl, i) => [_labelCell(lbl), ...norm[i].map(v => _numCell(v))]),
       ws.merges);
   
     // Tahap 3: Matriks terbobot
     const weighted = norm.map(row => row.map((v, j) => v * (weights[selectedCols[j]] || 0)));
     r = _writeCalcTable(ws, r, '⚖️ TAHAP 3 — Matriks Ternormalisasi Terbobot (v)',
       'vij = wj × rij', ['Alternatif', ...selectedCols],
       labels.map((lbl, i) => [_labelCell(lbl), ...weighted[i].map(v => _numCell(v))]),
       ws.merges);
   
     // Tahap 4: Ideal
     const idealPos = selectedCols.map((col, j) => {
       const vals = weighted.map(rr => rr[j]);
       return (criteriaTypes[col] || 'benefit') === 'benefit' ? Math.max(...vals) : Math.min(...vals);
     });
     const idealNeg = selectedCols.map((col, j) => {
       const vals = weighted.map(rr => rr[j]);
       return (criteriaTypes[col] || 'benefit') === 'benefit' ? Math.min(...vals) : Math.max(...vals);
     });
     r = _writeCalcTable(ws, r, '🎯 TAHAP 4 — Solusi Ideal Positif (A⁺) & Negatif (A⁻)',
       'A⁺: MAX untuk Benefit, MIN untuk Cost | A⁻: sebaliknya',
       ['Solusi', ...selectedCols],
       [
         [_labelCell('A⁺ (Ideal Positif)'), ...idealPos.map(v => _numCell(v, null, { ...XStyle.formula, fill: { fgColor: { rgb: 'E6F4EA' } } }))],
         [_labelCell('A⁻ (Ideal Negatif)'), ...idealNeg.map(v => _numCell(v, null, { ...XStyle.formula, fill: { fgColor: { rgb: 'FEE2E2' } } }))],
       ], ws.merges);
   
     // Tahap 5: Jarak
     const dPos = weighted.map(row => Math.sqrt(row.reduce((s, v, j) => s + (v - idealPos[j]) ** 2, 0)));
     const dNeg = weighted.map(row => Math.sqrt(row.reduce((s, v, j) => s + (v - idealNeg[j]) ** 2, 0)));
     r = _writeCalcTable(ws, r, '📏 TAHAP 5 — Jarak Euclidean (D⁺ dan D⁻)',
       'D⁺ = √Σ(vij − A⁺j)² | D⁻ = √Σ(vij − A⁻j)²',
       ['Alternatif', 'D⁺ (ke ideal positif)', 'D⁻ (ke ideal negatif)'],
       labels.map((lbl, i) => [_labelCell(lbl), _numCell(dPos[i]), _numCell(dNeg[i])]),
       ws.merges);
   
     // Tahap 6: CC
     const scores = dPos.map((dp, i) => (dp + dNeg[i]) === 0 ? 0 : dNeg[i] / (dp + dNeg[i]));
     const ranked = labels.map((lbl, i) => ({ lbl, score: scores[i] }))
       .sort((a, b) => b.score - a.score).map((item, ri) => ({ ...item, rank: ri + 1 }));
   
     r = _writeCalcTable(ws, r, '🏆 TAHAP 6 — Closeness Coefficient (CC)',
       'CCi = D⁻ / (D⁺ + D⁻) | Mendekati 1 = terbaik',
       ['Rank', 'Alternatif', 'D⁺', 'D⁻', 'CC (Skor Akhir)'],
       ranked.map(item => {
         const rs = item.rank <= 3 ? [XStyle.rank1, XStyle.rank2, XStyle.rank3][item.rank - 1] : XStyle.data;
         const idx = labels.indexOf(item.lbl);
         return [_cell(item.rank, rs), _labelCell(item.lbl), _numCell(dPos[idx]), _numCell(dNeg[idx]), _numCell(item.score)];
       }), ws.merges);
   
     _setDefaultColWidths(ws, n + 2);
   }
   
   /* ──────────────────────────────────────────
      WASPAS — 5 tahap
   ────────────────────────────────────────── */
   function _calcWASPAS(ws, R) {
     const { selectedCols, criteriaTypes, weights, lambda } = R;
     const { labels, matrix } = _getMatrix(R);
     const m = matrix.length;
     const n = selectedCols.length;
     const lam = lambda ?? 0.5;
     let r = 0;
   
     // Tahap 1
     r = _writeCalcTable(ws, r, '📋 TAHAP 1 — Matriks Keputusan Awal',
       null, ['Alternatif', ...selectedCols],
       labels.map((lbl, i) => [_labelCell(lbl), ...matrix[i].map(v => _numCell(v, null, XStyle.data))]),
       ws.merges);
   
     // Normalisasi linear
     const normalized = matrix.map(row => row.slice());
     for (let j = 0; j < n; j++) {
       const vals = matrix.map(rr => rr[j]);
       const max  = Math.max(...vals);
       const min  = Math.min(...vals);
       const type = criteriaTypes[selectedCols[j]] || 'benefit';
       for (let i = 0; i < m; i++) {
         normalized[i][j] = type === 'benefit'
           ? (max === 0 ? 0 : matrix[i][j] / max)
           : (matrix[i][j] === 0 ? 0 : min / matrix[i][j]);
       }
     }
   
     // Tahap 2: Normalisasi
     r = _writeCalcTable(ws, r, '📐 TAHAP 2 — Normalisasi Linear (r)',
       'Benefit: r = x/MAX | Cost: r = MIN/x', ['Alternatif', ...selectedCols],
       labels.map((lbl, i) => [_labelCell(lbl), ...normalized[i].map(v => _numCell(v))]),
       ws.merges);
   
     // WSM
     const wsm = matrix.map((_, i) =>
       selectedCols.reduce((s, col, j) => s + (weights[col] || 0) * normalized[i][j], 0));
     r = _writeCalcTable(ws, r, '➕ TAHAP 3 — Weighted Sum Model (Q¹)',
       'Q¹ = Σ(wj × rij)', ['Alternatif', 'Q¹ (WSM Score)'],
       labels.map((lbl, i) => [_labelCell(lbl), _numCell(wsm[i])]), ws.merges);
   
     // WPM
     const wpm = matrix.map((_, i) =>
       selectedCols.reduce((p, col, j) => p * (normalized[i][j] ** (weights[col] || 0)), 1));
     r = _writeCalcTable(ws, r, '✖️ TAHAP 4 — Weighted Product Model (Q²)',
       'Q² = Π(rij ^ wj)', ['Alternatif', 'Q² (WPM Score)'],
       labels.map((lbl, i) => [_labelCell(lbl), _numCell(wpm[i])]), ws.merges);
   
     // Skor akhir
     const scores = wsm.map((w, i) => lam * w + (1 - lam) * wpm[i]);
     const ranked = labels.map((lbl, i) => ({ lbl, score: scores[i] }))
       .sort((a, b) => b.score - a.score).map((item, ri) => ({ ...item, rank: ri + 1 }));
   
     r = _writeCalcTable(ws, r, `🏆 TAHAP 5 — Skor Akhir WASPAS (λ=${lam})`,
       `Q = λ×Q¹ + (1−λ)×Q² | λ=${lam} → ${(lam*100).toFixed(0)}% WSM + ${((1-lam)*100).toFixed(0)}% WPM`,
       ['Rank', 'Alternatif', 'Q¹ (WSM)', 'Q² (WPM)', `Skor Q (λ=${lam})`],
       ranked.map(item => {
         const rs = item.rank <= 3 ? [XStyle.rank1, XStyle.rank2, XStyle.rank3][item.rank - 1] : XStyle.data;
         const idx = labels.indexOf(item.lbl);
         return [_cell(item.rank, rs), _labelCell(item.lbl), _numCell(wsm[idx]), _numCell(wpm[idx]), _numCell(item.score)];
       }), ws.merges);
   
     _setDefaultColWidths(ws, n + 2);
   }
   
   /* ──────────────────────────────────────────
      MOORA — 4 tahap
   ────────────────────────────────────────── */
   function _calcMOORA(ws, R) {
     const { selectedCols, criteriaTypes, weights } = R;
     const { labels, matrix } = _getMatrix(R);
     const m = matrix.length;
     const n = selectedCols.length;
     let r = 0;
   
     r = _writeCalcTable(ws, r, '📋 TAHAP 1 — Matriks Keputusan Awal',
       null, ['Alternatif', ...selectedCols],
       labels.map((lbl, i) => [_labelCell(lbl), ...matrix[i].map(v => _numCell(v, null, XStyle.data))]),
       ws.merges);
   
     // Normalisasi vektor
     const norm = matrix.map(rr => rr.slice());
     for (let j = 0; j < n; j++) {
       const d = Math.sqrt(matrix.reduce((s, rr) => s + rr[j] ** 2, 0));
       for (let i = 0; i < m; i++) norm[i][j] = d === 0 ? 0 : matrix[i][j] / d;
     }
     r = _writeCalcTable(ws, r, '📐 TAHAP 2 — Normalisasi Vektor Rasio',
       'x*ij = xij / √(Σ xij²)', ['Alternatif', ...selectedCols],
       labels.map((lbl, i) => [_labelCell(lbl), ...norm[i].map(v => _numCell(v))]),
       ws.merges);
   
     // Weighted
     const weighted = norm.map(row => row.map((v, j) => v * (weights[selectedCols[j]] || 0)));
     r = _writeCalcTable(ws, r, '⚖️ TAHAP 3 — Matriks Ternormalisasi Terbobot',
       'wj × x*ij', ['Alternatif', ...selectedCols],
       labels.map((lbl, i) => [_labelCell(lbl), ...weighted[i].map(v => _numCell(v))]),
       ws.merges);
   
     // Yi
     const scores = weighted.map(row =>
       selectedCols.reduce((s, col, j) =>
         (criteriaTypes[col] || 'benefit') === 'benefit' ? s + row[j] : s - row[j], 0));
     const ranked = labels.map((lbl, i) => ({ lbl, score: scores[i] }))
       .sort((a, b) => b.score - a.score).map((item, ri) => ({ ...item, rank: ri + 1 }));
   
     r = _writeCalcTable(ws, r, '🏆 TAHAP 4 — Skor Yi (Ratio System)',
       'Yi = Σ(wj×x*ij) [Benefit] − Σ(wj×x*ij) [Cost]',
       ['Rank', 'Alternatif', 'Skor Yi'],
       ranked.map(item => {
         const rs = item.rank <= 3 ? [XStyle.rank1, XStyle.rank2, XStyle.rank3][item.rank - 1] : XStyle.data;
         return [_cell(item.rank, rs), _labelCell(item.lbl), _numCell(item.score)];
       }), ws.merges);
   
     _setDefaultColWidths(ws, n + 2);
   }
   
   /* ──────────────────────────────────────────
      EDAS — 4 tahap
   ────────────────────────────────────────── */
   /* ============================================
   PATCH — _calcEDAS dengan Formula Excel

   Ganti fungsi _calcEDAS() yang lama di
   file lib/export-xlsx.js dengan fungsi ini.

   Rantai referensi formula:
   
   Tahap 1 (nilai mentah + AV)
     ↓ MAX(0, raw - AV) / AV
   Tahap 2 PDA
     ↓ MAX(0, AV - raw) / AV
   Tahap 3 NDA
     ↓ SUMPRODUCT(bobot, PDA/NDA row)
   Tahap 4 SP → NSP → AS → Rank
   ============================================ */

function _calcEDAS(ws, R) {
  const { selectedCols, criteriaTypes, weights } = R;
  const { labels, matrix } = _getMatrix(R);
  const m = matrix.length;
  const n = selectedCols.length;
  let r = 0;

  /* ─────────────────────────────────────────
     Hitung semua nilai cached (JS) dulu
     agar setiap cell punya cached value
     yang benar sebelum Excel recalculate
  ───────────────────────────────────────── */

  // AV per kolom
  const avg = selectedCols.map((_, j) =>
    matrix.reduce((s, row) => s + row[j], 0) / m
  );

  // PDA
  const PDA = matrix.map(row =>
    selectedCols.map((col, j) => {
      const type = criteriaTypes[col] || 'benefit';
      const diff = type === 'benefit'
        ? Math.max(0, row[j] - avg[j])
        : Math.max(0, avg[j] - row[j]);
      return avg[j] === 0 ? 0 : diff / avg[j];
    })
  );

  // NDA
  const NDA = matrix.map(row =>
    selectedCols.map((col, j) => {
      const type = criteriaTypes[col] || 'benefit';
      const diff = type === 'benefit'
        ? Math.max(0, avg[j] - row[j])
        : Math.max(0, row[j] - avg[j]);
      return avg[j] === 0 ? 0 : diff / avg[j];
    })
  );

  // SP, SN
  const SP = PDA.map(row =>
    selectedCols.reduce((s, col, j) => s + (weights[col] || 0) * row[j], 0)
  );
  const SN = NDA.map(row =>
    selectedCols.reduce((s, col, j) => s + (weights[col] || 0) * row[j], 0)
  );

  // NSP, NSN, AS
  const maxSP = Math.max(...SP);
  const maxSN = Math.max(...SN);
  const NSP   = SP.map(v => maxSP === 0 ? 0 : v / maxSP);
  const NSN   = SN.map(v => maxSN === 0 ? 1 : 1 - v / maxSN);
  const scores = NSP.map((v, i) => 0.5 * (v + NSN[i]));

  // Ranked (simpan origIdx untuk referensi baris PDA/NDA)
  const ranked = labels
    .map((lbl, i) => ({ lbl, score: scores[i], origIdx: i }))
    .sort((a, b) => b.score - a.score)
    .map((item, ri) => ({ ...item, rank: ri + 1 }));

  /* ─────────────────────────────────────────
     Posisi Excel (1-indexed) setiap tahap
     Rumus umum _writeCalcTable:
       title(+1) + desc(+1) + header(+1) + dataRows + gap(+1)
     
     T1: dataRows = m+1 (m data + 1 baris AV)
     T2: dataRows = m
     T3: dataRows = m
     T4: dataRows = m
  ───────────────────────────────────────── */
  const t1Start          = 0;
  const t1DataFirstExcel = t1Start + 3 + 1;        // = 4
  const t1AvgRowExcel    = t1DataFirstExcel + m;    // = m+4
  // setelah T1: r = t1Start + 3 + (m+1) + 1 = m+5

  const t2Start          = m + 5;
  const t2DataFirstExcel = t2Start + 3 + 1;        // = m+9
  const t2DataLastExcel  = t2DataFirstExcel + m - 1;
  // setelah T2: r = t2Start + 3 + m + 1 = 2m+9

  const t3Start          = 2 * m + 9;
  const t3DataFirstExcel = t3Start + 3 + 1;        // = 2m+13
  const t3DataLastExcel  = t3DataFirstExcel + m - 1;
  // setelah T3: r = t3Start + 3 + m + 1 = 3m+13

  const t4Start          = 3 * m + 13;
  const t4DataFirstExcel = t4Start + 3 + 1;        // = 3m+17
  const t4DataLastExcel  = t4DataFirstExcel + m - 1;

  // Huruf kolom kriteria (B = pertama, _col(n) = terakhir)
  const firstCritColLetter = _col(1);              // B
  const lastCritColLetter  = _col(n);              // tergantung n

  // Array bobot sebagai konstanta Excel: {w1,w2,...,wn}
  const weightsArray = '{' + selectedCols.map(col =>
    (weights[col] || 0)
  ).join(',') + '}';

  /* ─────────────────────────────────────────
     TAHAP 1 — Matriks Keputusan + AV
  ───────────────────────────────────────── */
  const dataRows1 = labels.map((lbl, i) => [
    _labelCell(lbl),
    ...matrix[i].map(v => _numCell(v, null, XStyle.data)),
  ]);

  // Baris AV dengan formula AVERAGE
  const avgRow = [
    _cell('Rata-rata (AV)', {
      ...XStyle.label,
      font: { bold: true, sz: 10, color: { rgb: '78350F' } },
      fill: { fgColor: { rgb: 'FFF9C4' } },
    }),
    ...selectedCols.map((_, j) => {
      const colLetter = _col(j + 1);
      const range     = `$${colLetter}$${t1DataFirstExcel}:$${colLetter}$${t1DataFirstExcel + m - 1}`;
      return {
        v: parseFloat(avg[j].toFixed(6)),
        t: 'n',
        s: {
          ...XStyle.formula,
          fill: { fgColor: { rgb: 'FFF9C4' } },
        },
        f: `AVERAGE(${range})`,
        z: '0.0000',
      };
    }),
  ];

  dataRows1.push(avgRow);

  r = _writeCalcTable(
    ws, r,
    '📋 TAHAP 1 — Matriks Keputusan & Rata-rata Solusi (AV)',
    'AVj = (1/n) × Σ xij  |  Baris AV dihitung otomatis dari data di atasnya.',
    ['Alternatif', ...selectedCols],
    dataRows1, ws.merges
  );

  /* ─────────────────────────────────────────
     TAHAP 2 — Positive Distance from Average (PDA)
     Formula: IFERROR(MAX(0, raw - AV) / AV, 0)  [Benefit]
              IFERROR(MAX(0, AV - raw) / AV, 0)  [Cost]
  ───────────────────────────────────────── */
  const dataRows2 = labels.map((lbl, i) => [
    _labelCell(lbl),
    ...selectedCols.map((col, j) => {
      const type      = criteriaTypes[col] || 'benefit';
      const colLetter = _col(j + 1);
      const rawCell   = `$${colLetter}$${t1DataFirstExcel + i}`;  // absolut
      const avgCell   = `$${colLetter}$${t1AvgRowExcel}`;         // absolut

      const formula = type === 'benefit'
        ? `IFERROR(MAX(0,${rawCell}-${avgCell})/${avgCell},0)`
        : `IFERROR(MAX(0,${avgCell}-${rawCell})/${avgCell},0)`;

      return {
        v: parseFloat(PDA[i][j].toFixed(6)),
        t: 'n',
        s: XStyle.formula,
        f: formula,
        z: '0.0000',
      };
    }),
  ]);

  r = _writeCalcTable(
    ws, r,
    '📈 TAHAP 2 — Positive Distance from Average (PDA)',
    'Benefit: MAX(0, xij−AVj)/AVj  |  Cost: MAX(0, AVj−xij)/AVj',
    ['Alternatif', ...selectedCols],
    dataRows2, ws.merges
  );

  /* ─────────────────────────────────────────
     TAHAP 3 — Negative Distance from Average (NDA)
     Formula: IFERROR(MAX(0, AV - raw) / AV, 0)  [Benefit]
              IFERROR(MAX(0, raw - AV) / AV, 0)  [Cost]
  ───────────────────────────────────────── */
  const dataRows3 = labels.map((lbl, i) => [
    _labelCell(lbl),
    ...selectedCols.map((col, j) => {
      const type      = criteriaTypes[col] || 'benefit';
      const colLetter = _col(j + 1);
      const rawCell   = `$${colLetter}$${t1DataFirstExcel + i}`;
      const avgCell   = `$${colLetter}$${t1AvgRowExcel}`;

      const formula = type === 'benefit'
        ? `IFERROR(MAX(0,${avgCell}-${rawCell})/${avgCell},0)`
        : `IFERROR(MAX(0,${rawCell}-${avgCell})/${avgCell},0)`;

      return {
        v: parseFloat(NDA[i][j].toFixed(6)),
        t: 'n',
        s: XStyle.formula,
        f: formula,
        z: '0.0000',
      };
    }),
  ]);

  r = _writeCalcTable(
    ws, r,
    '📉 TAHAP 3 — Negative Distance from Average (NDA)',
    'Benefit: MAX(0, AVj−xij)/AVj  |  Cost: MAX(0, xij−AVj)/AVj',
    ['Alternatif', ...selectedCols],
    dataRows3, ws.merges
  );

  /* ─────────────────────────────────────────
     TAHAP 4 — Appraisal Score (AS)
     Kolom: [Rank, Alt, SP, SN, NSP, NSN, AS]
             A     B    C   D   E    F    G

     SP  = SUMPRODUCT(bobot, PDA_row)
     SN  = SUMPRODUCT(bobot, NDA_row)
     NSP = C_row / MAX($C$first:$C$last)
     NSN = 1 - D_row / MAX($D$first:$D$last)
     AS  = 0.5 * (E_row + F_row)
     Rank= RANK(G_row, $G$first:$G$last, 0)
  ───────────────────────────────────────── */

  // Huruf kolom Tahap 4
  const colSP   = 'C';
  const colSN   = 'D';
  const colNSP  = 'E';
  const colNSN  = 'F';
  const colAS   = 'G';
  const colRank = 'A';

  // Range absolut untuk MAX() di NSP dan NSN
  const spRange = `$${colSP}$${t4DataFirstExcel}:$${colSP}$${t4DataLastExcel}`;
  const snRange = `$${colSN}$${t4DataFirstExcel}:$${colSN}$${t4DataLastExcel}`;
  const asRange = `$${colAS}$${t4DataFirstExcel}:$${colAS}$${t4DataLastExcel}`;

  const dataRows4 = ranked.map((item, idx) => {
    const excelRow     = t4DataFirstExcel + idx;
    const origI        = item.origIdx;

    // Baris PDA dan NDA untuk alternatif ini
    const pdaRow       = t2DataFirstExcel + origI;
    const ndaRow       = t3DataFirstExcel + origI;
    const pdaRowRange  = `${firstCritColLetter}${pdaRow}:${lastCritColLetter}${pdaRow}`;
    const ndaRowRange  = `${firstCritColLetter}${ndaRow}:${lastCritColLetter}${ndaRow}`;

    const rankStyle = item.rank === 1 ? XStyle.rank1
                    : item.rank === 2 ? XStyle.rank2
                    : item.rank === 3 ? XStyle.rank3
                    : XStyle.data;

    return [
      // A — Rank
      {
        v: item.rank,
        t: 'n',
        s: rankStyle,
        f: `RANK(${colAS}${excelRow},${asRange},0)`,
      },
      // B — Alternatif
      _labelCell(item.lbl),
      // C — SP
      {
        v: parseFloat(SP[origI].toFixed(6)),
        t: 'n',
        s: XStyle.formula,
        f: `SUMPRODUCT(${weightsArray},${pdaRowRange})`,
        z: '0.0000',
      },
      // D — SN
      {
        v: parseFloat(SN[origI].toFixed(6)),
        t: 'n',
        s: XStyle.formula,
        f: `SUMPRODUCT(${weightsArray},${ndaRowRange})`,
        z: '0.0000',
      },
      // E — NSP
      {
        v: parseFloat(NSP[origI].toFixed(6)),
        t: 'n',
        s: XStyle.formula,
        f: `IFERROR(${colSP}${excelRow}/MAX(${spRange}),0)`,
        z: '0.0000',
      },
      // F — NSN
      {
        v: parseFloat(NSN[origI].toFixed(6)),
        t: 'n',
        s: XStyle.formula,
        f: `IFERROR(1-${colSN}${excelRow}/MAX(${snRange}),1)`,
        z: '0.0000',
      },
      // G — AS (Skor Akhir)
      {
        v: parseFloat(item.score.toFixed(6)),
        t: 'n',
        s: { ...XStyle.formula, font: { bold: true, sz: 10, color: { rgb: '1A1917' } } },
        f: `0.5*(${colNSP}${excelRow}+${colNSN}${excelRow})`,
        z: '0.0000',
      },
    ];
  });

  r = _writeCalcTable(
    ws, r,
    '🏆 TAHAP 4 — Appraisal Score (AS)',
    'SP=Σ(wj×PDA)  |  SN=Σ(wj×NDA)  |  NSP=SP/max(SP)  |  NSN=1−SN/max(SN)  |  AS=0.5×(NSP+NSN)',
    ['Rank', 'Alternatif', 'SP', 'SN', 'NSP', 'NSN', 'AS (Skor Akhir)'],
    dataRows4, ws.merges
  );

  _setDefaultColWidths(ws, Math.max(n + 2, 7));
}
   
   /* ============================================
   SHEET 3 PERANGKINGAN
   ============================================ */

    function buildSheet3(R) {
      const ws = { cells: {}, merges: [], colWidths: [8, 22, 14, 14, 14, 18] };
      const { result, method, weightMethod, selectedCols, weights, criteriaTypes, lambda } = R;
      const ranked = result.ranked;
      const METHOD_LABELS = { saw:'SAW', topsis:'TOPSIS', waspas:'WASPAS', moora:'MOORA', edas:'EDAS' };
      let r = 0;

      /* ── SECTION 1: Konfigurasi ── */
      _writeSectionTitle(ws, r, 0, '⚙️ KONFIGURASI ANALISIS', 6, ws.merges);
      r++;

      const configRows = [
        ['Metode SPK',       METHOD_LABELS[method] || method.toUpperCase()],
        ['Pembobotan',       weightMethod],
        ['Jumlah Kriteria',  selectedCols.length],
        ['Jumlah Alternatif', ranked.length],
      ];
      if (method === 'waspas') configRows.push(['Lambda (λ)', lambda ?? 0.5]);

      configRows.forEach(([k, v]) => {
        ws.cells[_addr(r, 0)] = _cell(k, { font: { bold: true, sz: 10 }, alignment: { horizontal: 'left' } });
        ws.cells[_addr(r, 1)] = _cell(String(v), XStyle.data);
        r++;
      });
      r++; // baris kosong pemisah

      /* ── SECTION 2: Bobot & Tipe Kriteria ── */
      _writeSectionTitle(ws, r, 0, '⚖️ BOBOT & TIPE KRITERIA', 6, ws.merges);
      r++;

      // Header tabel bobot
      [
        _headerCell('No'),
        _headerCell('Kriteria'),
        _headerCell('Tipe'),
        _headerCell('Bobot'),
        _headerCell('Bobot (%)'),
      ].forEach((cell, ci) => { ws.cells[_addr(r, ci)] = cell; });
      r++;

      // Baris data bobot
      selectedCols.forEach((col, idx) => {
        const type = criteriaTypes[col] || 'benefit';
        const w    = weights[col] || 0;
        ws.cells[_addr(r, 0)] = _cell(idx + 1, XStyle.data);
        ws.cells[_addr(r, 1)] = _labelCell(col);
        ws.cells[_addr(r, 2)] = _cell(
          type === 'benefit' ? 'Benefit (+)' : 'Cost (−)',
          {
            ...XStyle.data,
            font: {
              color: { rgb: type === 'benefit' ? '0A7A4A' : 'D4570A' },
              bold: true, sz: 10,
            },
          }
        );
        ws.cells[_addr(r, 3)] = _numCell(w);
        ws.cells[_addr(r, 4)] = _cell(
          parseFloat((w * 100).toFixed(2)) + '%',
          XStyle.data
        );
        r++;
      });
      r++; // baris kosong pemisah

      /* ── SECTION 3: Ranking Final ── */
      _writeSectionTitle(ws, r, 0, '🏆 HASIL RANKING FINAL', 6, ws.merges);
      r++;

      // Header ranking — 6 kolom
      [
        _headerCell('Rank'),
        _headerCell('Alternatif'),
        _headerCell('Skor Akhir'),
        _headerCell('Persentil (%)'),
        _headerCell('Keterangan'),
        _headerCell('Bar Visual'),
      ].forEach((cell, ci) => { ws.cells[_addr(r, ci)] = cell; });
      r++;

      // ── Catat baris pertama data ranking (1-indexed untuk Excel) ──
      const rankDataFirstRow = r + 1; // Excel row, 1-indexed
      const rankDataLastRow  = r + ranked.length;

      // Kolom C = skor (index 2 = kolom C, karena A=0,B=1,C=2)
      const colSkor      = 'C'; // kolom Skor Akhir
      const colPersentil = 'D'; // kolom Persentil
      const colRank      = 'A'; // kolom Rank

      // Range absolut kolom skor untuk MAX() dan RANK()
      const skorRange = `$${colSkor}$${rankDataFirstRow}:$${colSkor}$${rankDataLastRow}`;

      // ── Tulis baris per alternatif ──
      ranked.forEach((item, idx) => {
        const excelRow = r + 1; // 1-indexed

        // Tentukan style berdasarkan rank
        const rankStyle = item.rank === 1 ? XStyle.rank1
                        : item.rank === 2 ? XStyle.rank2
                        : item.rank === 3 ? XStyle.rank3
                        : XStyle.data;

        /* Kolom A — Rank
          Formula: =RANK(C{row}, $C$first:$C$last, 0)
          0 = descending (skor tertinggi = rank 1)
          Cached value = item.rank (ditampilkan sebelum Excel hitung ulang) */
        ws.cells[_addr(r, 0)] = {
          v: item.rank,
          t: 'n',
          s: rankStyle,
          f: `RANK(${colSkor}${excelRow},${skorRange},0)`,
        };

        /* Kolom B — Alternatif (label, tidak perlu formula) */
        ws.cells[_addr(r, 1)] = _labelCell(item.label);

        /* Kolom C — Skor Akhir
          Nilai cached murni — ini SUMBER KEBENARAN.
          Formula di kolom lain mereferensikan kolom ini.
          Tidak diberi formula agar user bisa edit manual jika perlu. */
        ws.cells[_addr(r, 2)] = _numCell(item.score);

        /* Kolom D — Persentil (%)
          Formula: =C{row}/MAX($C$first:$C$last)*100
          Cached value = pct */
        const pct = result.ranked[0].score > 0
          ? (item.score / result.ranked[0].score * 100)
          : 0;

        ws.cells[_addr(r, 3)] = {
          v: parseFloat(pct.toFixed(2)),
          t: 'n',
          s: { ...XStyle.formula, numFmt: '0.00' },
          f: `${colSkor}${excelRow}/MAX(${skorRange})*100`,
          z: '0.00',
        };

        /* Kolom E — Keterangan
          Formula: =IF(A{row}=1,"🥇 Terbaik",IF(A{row}=2,"🥈 Runner-up",IF(A{row}=3,"🥉 Posisi 3","")))
          Cached value = teks keterangan */
        const ketMap = { 1: '🥇 Terbaik', 2: '🥈 Runner-up', 3: '🥉 Posisi 3' };
        const ketVal = ketMap[item.rank] || '';

        ws.cells[_addr(r, 4)] = {
          v: ketVal,
          t: 's',
          s: XStyle.data,
          f: `IF(${colRank}${excelRow}=1,"🥇 Terbaik",IF(${colRank}${excelRow}=2,"🥈 Runner-up",IF(${colRank}${excelRow}=3,"🥉 Posisi 3","")))`,
        };

        /* Kolom F — Bar Visual
          Formula: =REPT("█",ROUND(D{row}/10,0))
          Cached value = string bar */
        const barLen = Math.round(pct / 10);
        const barStr = '█'.repeat(Math.max(0, barLen));

        ws.cells[_addr(r, 5)] = {
          v: barStr,
          t: 's',
          s: {
            font: {
              sz: 10,
              color: { rgb: '0A7A4A' }, // hijau
            },
            alignment: { horizontal: 'left', vertical: 'center' },
          },
          f: `REPT("█",ROUND(${colPersentil}${excelRow}/10,0))`,
        };

        r++;
      });

      /* ── SECTION 4: Baris summary di bawah tabel ── */
      r++; // baris kosong

      // Baris total / summary
      const summaryLabelStyle = {
        font: { bold: true, sz: 10, italic: true, color: { rgb: '666666' } },
        alignment: { horizontal: 'right' },
      };
      const summaryValStyle = {
        ...XStyle.formula,
        font: { bold: true, sz: 10, color: { rgb: '0A5C9E' } },
      };

      // Max Skor
      ws.cells[_addr(r, 1)] = _cell('Skor Tertinggi:', summaryLabelStyle);
      ws.cells[_addr(r, 2)] = {
        v: result.ranked[0].score,
        t: 'n',
        s: summaryValStyle,
        f: `MAX(${skorRange})`,
        z: '0.0000',
      };
      r++;

      // Min Skor
      ws.cells[_addr(r, 1)] = _cell('Skor Terendah:', summaryLabelStyle);
      ws.cells[_addr(r, 2)] = {
        v: result.ranked[result.ranked.length - 1].score,
        t: 'n',
        s: summaryValStyle,
        f: `MIN(${skorRange})`,
        z: '0.0000',
      };
      r++;

      // Rata-rata Skor
      const avgScore = result.ranked.reduce((s, item) => s + item.score, 0) / result.ranked.length;
      ws.cells[_addr(r, 1)] = _cell('Rata-rata Skor:', summaryLabelStyle);
      ws.cells[_addr(r, 2)] = {
        v: parseFloat(avgScore.toFixed(4)),
        t: 'n',
        s: summaryValStyle,
        f: `AVERAGE(${skorRange})`,
        z: '0.0000',
      };
      r++;

      // Rentang (range)
      const rangeScore = result.ranked[0].score - result.ranked[result.ranked.length - 1].score;
      ws.cells[_addr(r, 1)] = _cell('Rentang Skor:', summaryLabelStyle);
      ws.cells[_addr(r, 2)] = {
        v: parseFloat(rangeScore.toFixed(4)),
        t: 'n',
        s: summaryValStyle,
        f: `MAX(${skorRange})-MIN(${skorRange})`,
        z: '0.0000',
      };

      /* ── Set lebar kolom ── */
      ws.colWidths = [
        8,   // A: Rank
        22,  // B: Alternatif
        14,  // C: Skor Akhir
        14,  // D: Persentil
        16,  // E: Keterangan
        18,  // F: Bar Visual
      ];

      return ws;
    }
   
   /* ══════════════════════════════════════════
      MAIN EXPORT FUNCTION
      Dipanggil dari result.js:
      exportXLSX(R)  — R adalah payload sessionStorage
   ══════════════════════════════════════════ */
   function exportXLSX(R) {
     if (typeof XLSX === 'undefined') {
       if (window.Toast) window.Toast.show('Library SheetJS belum dimuat. Tidak dapat export XLSX.');
       return;
     }
   
     try {
       const wb = XLSX.utils.book_new();
       const METHOD_LABELS = { saw:'SAW', topsis:'TOPSIS', waspas:'WASPAS', moora:'MOORA', edas:'EDAS' };
   
       // Sheet 1
       const ws1 = buildSheet1(R);
       XLSX.utils.book_append_sheet(wb, _toSheetJS(ws1), '1. Dataset');
   
       // Sheet 2
       const ws2 = buildSheet2(R);
       XLSX.utils.book_append_sheet(wb, _toSheetJS(ws2), '2. Perhitungan');
   
       // Sheet 3
       const ws3 = buildSheet3(R);
       XLSX.utils.book_append_sheet(wb, _toSheetJS(ws3), '3. Ranking');
   
       const fileName = `SPK_${METHOD_LABELS[R.method] || R.method.toUpperCase()}_${R.fileName || 'hasil'}.xlsx`;
       XLSX.writeFile(wb, fileName);
   
       if (window.Toast) window.Toast.show('✓ File XLSX berhasil diunduh.');
     } catch (err) {
       console.error('Export XLSX error:', err);
       if (window.Toast) window.Toast.show('Gagal export XLSX: ' + err.message);
     }
   }