# DecisionLab SPK — Sistem Pendukung Keputusan Multi-Kriteria

> Aplikasi web analisis keputusan multi-kriteria (MCDM) berbasis browser. Mendukung 5 metode SPK, 3 metode pembobotan, dan ekspor hasil ke Excel (dengan formula), JSON, serta PDF — tanpa backend, tanpa instalasi.

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Demo & Alur Kerja](#demo--alur-kerja)
- [Metode SPK yang Didukung](#metode-spk-yang-didukung)
- [Metode Pembobotan](#metode-pembobotan)
- [Struktur Proyek](#struktur-proyek)
- [Cara Menjalankan](#cara-menjalankan)
- [Alur Data Internal](#alur-data-internal)
- [Format Input Data](#format-input-data)
- [Format Ekspor](#format-ekspor)
- [Dependensi](#dependensi)
- [Lisensi](#lisensi)

---

## Fitur Utama

| Fitur | Keterangan |
|---|---|
| **5 Metode SPK** | SAW, TOPSIS, WASPAS, MOORA, EDAS |
| **3 Pembobotan** | Manual, Entropy (Shannon), CRITIC |
| **Input fleksibel** | Upload CSV/XLSX/XLS, input manual via tabel, atau data contoh bawaan |
| **Langkah perhitungan** | Setiap tahap ditampilkan lengkap dengan formula dan tabel normalisasi |
| **Ekspor Excel** | `.xlsx` dengan formula Excel aktif per tahap (SAW, TOPSIS, WASPAS, MOORA, EDAS) |
| **Ekspor plain** | `.xlsx` tanpa formula — nilai murni, cocok untuk dibagikan |
| **Ekspor JSON** | Ranking final dalam format JSON terstruktur |
| **Cetak / PDF** | Halaman print khusus dengan layout tabel lengkap per tahap |
| **Perbandingan metode** | Jalankan semua 5 metode sekaligus, tampilkan rank mayoritas |
| **Dark mode** | Tema terang/gelap persisten via `localStorage` |
| **Responsif** | Mendukung layar desktop, tablet, dan mobile |
| **Tanpa backend** | 100% berjalan di browser, data tersimpan di `sessionStorage` |

---

## Demo & Alur Kerja

Aplikasi terdiri dari tiga halaman dengan alur linear:

```
index.html  ──▶  input.html (4 langkah)  ──▶  result.html
  (Landing)         (Wizard Input)              (Hasil & Ekspor)
```

### Langkah di `input.html`

```
Step 1: Upload & Preview
  ├─ Upload file CSV / XLSX / XLS
  ├─ Input manual (generate tabel kosong)
  └─ Pilih data contoh bawaan (laptop, supplier, karyawan, lokasi)

Step 2: Pilih Kolom
  ├─ Tentukan kolom label alternatif
  ├─ Centang kolom kriteria numerik
  └─ Atur tipe tiap kriteria: Benefit (+) atau Cost (−)

Step 3: Metode & Bobot
  ├─ Pilih metode SPK (SAW / TOPSIS / WASPAS / MOORA / EDAS)
  ├─ Untuk WASPAS: atur parameter λ (0–1)
  └─ Atur bobot: Manual · Entropy · CRITIC · Equal

Step 4: Konfirmasi & Proses
  ├─ Ringkasan konfigurasi (data, kriteria, metode, bobot)
  ├─ Tabel konfirmasi per kriteria (min, max, rata-rata, bobot)
  └─ Proses → simpan ke sessionStorage → redirect ke result.html
```

### Tampilan di `result.html`

```
Tab Ranking        → Podium top-3 + tabel ranking lengkap dengan score bar
Tab Grafik         → Bar chart horizontal per alternatif
Tab Langkah        → Accordion tiap tahap perhitungan + tabel + formula
Tab Matriks        → Data mentah + ringkasan bobot & tipe kriteria
Tab Perbandingan   → (opsional) Tabel rank semua 5 metode + rank mayoritas
```

---

## Metode SPK yang Didukung

### SAW — Simple Additive Weighting
Normalisasi linear kemudian penjumlahan terbobot.
```
Benefit:  r_ij = x_ij / MAX(x_j)
Cost:     r_ij = MIN(x_j) / x_ij
Skor:     V_i  = Σ (w_j × r_ij)
```

### TOPSIS
Peringkat berdasarkan jarak relatif ke solusi ideal positif dan negatif.
```
Normalisasi vektor: r_ij = x_ij / √(Σ x_ij²)
Terbobot:           v_ij = w_j × r_ij
Ideal positif A⁺:   MAX(v_j) untuk Benefit, MIN(v_j) untuk Cost
Ideal negatif A⁻:   MIN(v_j) untuk Benefit, MAX(v_j) untuk Cost
Jarak:              D⁺ = √Σ(v_ij − A⁺_j)²,  D⁻ = √Σ(v_ij − A⁻_j)²
Skor (CC):          CC_i = D⁻_i / (D⁺_i + D⁻_i)
```

### WASPAS — Weighted Aggregated Sum Product Assessment
Gabungan WSM dan WPM dengan parameter λ.
```
Normalisasi:  sama seperti SAW (linear)
Q¹ (WSM):     Σ (w_j × r_ij)
Q² (WPM):     Π (r_ij ^ w_j)
Skor akhir:   Q_i = λ × Q¹_i + (1 − λ) × Q²_i
```
λ = 1 → murni WSM, λ = 0 → murni WPM. Default λ = 0.5.

### MOORA — Multi-Objective Optimization on the Basis of Ratio Analysis
Normalisasi vektor Euclidean, kemudian benefit dikurangi cost.
```
Normalisasi:  x*_ij = x_ij / √(Σ x_ij²)
Terbobot:     w_j × x*_ij
Skor Yi:      Σ(w_j × x*_ij) [Benefit] − Σ(w_j × x*_ij) [Cost]
```

### EDAS — Evaluation based on Distance from Average Solution
Deviasi positif dan negatif dari rata-rata solusi.
```
Rata-rata:    AV_j = (1/n) × Σ x_ij
PDA:          MAX(0, x_ij − AV_j) / AV_j  [Benefit]
              MAX(0, AV_j − x_ij) / AV_j  [Cost]
NDA:          kebalikan PDA
SP / SN:      Σ (w_j × PDA_ij) / Σ (w_j × NDA_ij)
NSP / NSN:    SP_i / MAX(SP),  1 − SN_i / MAX(SN)
Skor (AS):    0.5 × (NSP_i + NSN_i)
```

---

## Metode Pembobotan

| Metode | Cara Kerja |
|---|---|
| **Manual** | Input langsung via slider + number input; validasi total = 1 |
| **Entropy** | Bobot otomatis dari variasi data (Shannon Information Theory). Kriteria dengan variasi tinggi → bobot lebih besar |
| **CRITIC** | Mempertimbangkan standar deviasi + korelasi Pearson antar kriteria. `C_j = σ_j × Σ(1 − r_jk)` |
| **Equal** | Semua kriteria mendapat bobot `1/n` |

---

## Struktur Proyek

```
decisionlab/
│
├── index.html                  # Landing page (pilih metode & pembobotan)
├── input.html                  # Wizard input 4 langkah
├── result.html                 # Halaman hasil ranking & ekspor
│
├── css/
│   ├── main.css                # Reset, variabel CSS, komponen global, tema
│   ├── components.css          # Navbar, dropzone, slider, tabel, badge, dll.
│   ├── input.css               # Layout & komponen khusus input.html
│   ├── result.css              # Layout & komponen khusus result.html
│   └── responsive.css          # Breakpoint tablet, mobile L/S, print, reduced-motion
│
├── js/
│   ├── utils/
│   │   └── helpers.js          # Fungsi bersama: escHtml, fmt, cap, setEl,
│   │                           #   delay, showToast, normalizeLinear,
│   │                           #   normalizeEuclidean, buildRankList
│   │
│   ├── core/
│   │   ├── spk-saw.js          # calcSAW() + buildRanking()
│   │   ├── spk-topsis.js       # calcTOPSIS()
│   │   ├── spk-waspas.js       # calcWASPAS()
│   │   ├── spk-moora.js        # calcMOORA()
│   │   ├── spk-edas.js         # calcEDAS()
│   │   └── calculation-engine.js  # buildDecisionMatrix(), runSPK()
│   │
│   ├── modules/
│   │   ├── file-handler.js     # handleFile(), parseCSV(), parseExcel()
│   │   ├── table-renderer.js   # renderPreviewTable(), buildManualInputTable()
│   │   ├── weighting-entropy.js   # calcEntropyWeights(), normalizeWeights()
│   │   ├── weighting-critic.js    # calcCriticWeights()
│   │   └── weight-input.js     # buildWeightSliders(), updateWeightTotalBar(),
│   │                           #   isWeightValid()
│   │
│   ├── app.js                  # Page loader, dark mode, mobile nav,
│   │                           #   scroll animation, toast, modal, smooth scroll
│   ├── input.js                # UI controller input.html (state + 4 step logic)
│   └── result.js               # UI controller result.html (render semua tab + ekspor)
│
├── lib/
│   ├── xlsx.full.min.js        # SheetJS (CDN lokal) — parsing & generate Excel
│   ├── export-xlsx.js          # exportXLSX() — Excel dengan formula aktif per metode
│   ├── export-xlsx-plain.js    # exportXLSXPlain() — Excel plain tanpa formula
│   └── print-preview.js        # printPreview() — jendela print layout tabel lengkap
│
└── Assets/
    └── icons/
        └── Logo.ico
```

### Urutan Load Script

Urutan `<script>` di setiap halaman **wajib** diikuti karena setiap file bergantung pada yang di atasnya:

**`input.html`**
```
helpers.js → app.js → table-renderer.js → file-handler.js →
weighting-entropy.js → weighting-critic.js → weight-input.js →
spk-saw.js → spk-topsis.js → spk-waspas.js → spk-moora.js → spk-edas.js →
calculation-engine.js → input.js
```

**`result.html`**
```
helpers.js → xlsx.full.min.js → spk-saw.js → spk-topsis.js → spk-waspas.js →
spk-moora.js → spk-edas.js → calculation-engine.js → app.js →
export-xlsx.js → export-xlsx-plain.js → print-preview.js → result.js
```

---

## Cara Menjalankan

Tidak ada build step, tidak ada backend, tidak ada `npm install`.

```bash
# Clone repo
git clone https://github.com/username/decisionlab.git
cd decisionlab

# Jalankan via server lokal (pilih salah satu)
npx serve .
# atau
python -m http.server 8080
# atau buka langsung via Live Server di VS Code
```

Buka `http://localhost:8080` di browser.

> **Catatan:** File harus diakses via HTTP (bukan `file://`) karena `sessionStorage` dan beberapa API browser tidak bekerja di protokol `file://`.

---

## Alur Data Internal

```
┌─────────────────────────────────────────────────────┐
│                    input.html                        │
│                                                     │
│  State (JS object)                                  │
│  ├─ rawData[][]     ← CSV / Excel / manual / sample │
│  ├─ headers[]                                       │
│  ├─ labelCol                                        │
│  ├─ selectedCols[]                                  │
│  ├─ criteriaTypes{} ← benefit | cost per kolom      │
│  ├─ method          ← saw | topsis | waspas | ...   │
│  ├─ lambda          ← khusus WASPAS (0–1)           │
│  ├─ weightMethod    ← manual | entropy | critic | eq│
│  └─ weights{}       ← { colName: number }           │
│                                                     │
│  Saat "Proses" diklik:                              │
│    buildDecisionMatrix(State) → dm                  │
│    runSPK(dm, method, weights, types, lambda) → res │
│    sessionStorage.setItem('spk_result', payload)    │
│    → redirect ke result.html                        │
└─────────────────────────────────────────────────────┘
                         │
                         ▼ sessionStorage
┌─────────────────────────────────────────────────────┐
│                    result.html                       │
│                                                     │
│  R = JSON.parse(sessionStorage.getItem('spk_result'))│
│  ├─ result.ranked[]  ← { rank, label, score }       │
│  ├─ rawData[][]      ← untuk rekonstruksi langkah   │
│  ├─ weights / types  ← untuk ekspor & langkah       │
│  └─ showSteps / compareAll                          │
│                                                     │
│  Tab Langkah → rekonstruksi ulang perhitungan di JS │
│  Ekspor      → exportXLSX(R) / exportXLSXPlain(R)  │
│              → printPreview(R)                      │
└─────────────────────────────────────────────────────┘
```

---

## Format Input Data

### Upload File (CSV / XLSX / XLS)

Baris pertama = header. Kolom pertama biasanya label alternatif, kolom berikutnya = nilai kriteria numerik.

```
Laptop,Harga (juta),RAM (GB),Storage (GB),Layar (inch),Baterai (jam)
Laptop A,8.5,8,512,14,8
Laptop B,12.0,16,512,15.6,6
Laptop C,6.5,8,256,13.3,10
```

- Delimiter CSV: auto-detect (`,` `;` `\t` `|`) atau pilih manual
- File Excel: sheet pertama yang digunakan

### Data Contoh Bawaan

| Nama | Alternatif | Kriteria |
|---|---|---|
| Pemilihan Laptop | 5 | 5 |
| Seleksi Supplier | 6 | 4 |
| Penilaian Karyawan | 8 | 6 |
| Pemilihan Lokasi | 4 | 5 |

---

## Format Ekspor

### Excel dengan Formula (`export-xlsx.js`)

Menghasilkan file `.xlsx` dengan 3 sheet:

| Sheet | Isi |
|---|---|
| `1. Dataset` | Data mentah + matriks normalisasi berdampingan |
| `2. Perhitungan` | Semua tahap per metode dengan formula Excel aktif |
| `3. Ranking` | Ranking final + konfigurasi bobot + formula `RANK()`, `REPT()` |

Formula Excel yang dihasilkan per metode:

| Metode | Formula Utama |
|---|---|
| SAW | `IFERROR(cell/MAX(range),0)` · `SUMPRODUCT({w},norm_row)` · `RANK()` |
| TOPSIS | `IFERROR(cell/SQRT(SUMPRODUCT(range,range)),0)` · `SQRT(SUMPRODUCT(...^2))` · `IFERROR(D/(C+D),0)` |
| WASPAS | `IFERROR(cell/MAX,0)` · `SUMPRODUCT` (WSM) · `B^w1*C^w2*...` (WPM) · `λ*C+（1−λ）*D` |
| MOORA | `IFERROR(cell/SQRT(SUMPRODUCT),0)` · `SUMPRODUCT({+w1,−w2,...},T3_row)` |
| EDAS | `IFERROR(MAX(0,cell-AV)/AV,0)` · `SUMPRODUCT({w},PDA_row)` · `0.5*(NSP+NSN)` |

### Excel Plain (`export-xlsx-plain.js`)

Nilai angka murni tanpa formula — lebih ringan, cocok untuk dibagikan ke pihak yang tidak perlu melihat proses.

### JSON

```json
{
  "method": "topsis",
  "weightMethod": "entropy",
  "lambda": 0.5,
  "selectedCols": ["Harga", "RAM", "Storage"],
  "weights": { "Harga": 0.45, "RAM": 0.32, "Storage": 0.23 },
  "criteriaTypes": { "Harga": "cost", "RAM": "benefit", "Storage": "benefit" },
  "ranking": [
    { "rank": 1, "label": "Laptop D", "score": 0.7821 },
    { "rank": 2, "label": "Laptop B", "score": 0.6134 }
  ]
}
```

### Cetak / PDF

Membuka jendela print baru dengan layout tabel per tahap yang dioptimalkan untuk kertas A4, lengkap dengan keterangan formula per section.

---

## Dependensi

| Library | Versi | Penggunaan |
|---|---|---|
| [SheetJS (xlsx)](https://sheetjs.com/) | `full.min` | Parse file Excel upload, generate file `.xlsx` ekspor |
| Google Fonts (Syne + DM Sans) | — | Tipografi UI |

Tidak ada framework JavaScript (React, Vue, dll.) — semua ditulis dalam **Vanilla JS ES5/ES6**.

---

## Lisensi

Dirilis di bawah [Apache License 2.0](LICENSE).

---
