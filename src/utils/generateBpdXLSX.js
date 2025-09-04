import * as XLSX from 'xlsx';

// Fungsi helper untuk mengunduh file
const downloadBlob = (blob, fileName) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

export const generateBpdXLSX = (groupedData, periodeFilter) => {
    const wb = XLSX.utils.book_new();
    const ws_data = [];

    // Judul Dinamis
    const title = periodeFilter 
        ? `BPD PERIODE ${periodeFilter.toUpperCase()}` 
        : `DATA BPD KESELURUHAN TAHUN ${new Date().getFullYear()}`;

    ws_data.push([title]);
    ws_data.push(["TP. Pemerintahan Kec. Punggelan"]);
    ws_data.push([]); 

    // --- FIX: Struktur Header Baru dengan ALAMAT Gabungan ---
    const mainHeaders = [
        "NO", "NO. SK Bupati", "Tgl. SK Bupati", "PERIODE", 
        "Tgl Pelantikan/Pengambilan Sumpah", "Wil Pmlhn", "NAMA", 
        "Tempat Lahir", "Tgl Lahir", "Pekerjaan", "Pendidikan", "Agama", 
        "ALAMAT", null, null, "Jabatan" // 'ALAMAT' akan digabung di atas 3 kolom
    ];
    const subHeaders = [
        null, null, null, null, null, null, null, null, null, null, null, null,
        "DESA", "RT", "RW", null // Sub-header di bawah ALAMAT
    ];

    ws_data.push(mainHeaders);
    ws_data.push(subHeaders);

    let overallIndex = 1;

    // Iterasi melalui setiap desa dalam data yang sudah dikelompokkan
    for (const desa in groupedData) {
        if (Object.hasOwnProperty.call(groupedData, desa)) {
            const bpdList = groupedData[desa];

            bpdList.forEach((bpd) => {
                const row = [
                    overallIndex++,
                    bpd.no_sk_bupati || '',
                    bpd.tgl_sk_bupati || '',
                    bpd.periode || '',
                    bpd.tgl_pelantikan || '',
                    bpd.wil_pmlhn || '',
                    bpd.nama || '',
                    bpd.tempat_lahir || '',
                    bpd.tgl_lahir || '',
                    bpd.pekerjaan || '',
                    bpd.pendidikan || '',
                    bpd.agama || '',
                    bpd.desa || '',   // Data untuk kolom DESA
                    bpd.rt || '',     // Data untuk kolom RT
                    bpd.rw || '',     // Data untuk kolom RW
                    bpd.jabatan || ''
                ];
                ws_data.push(row);
            });
        }
    }

    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // --- Styling Otomatis ---
    
    // 1. Mengatur Lebar Kolom
    const colWidths = [
        { wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 },
        { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
        { wch: 18 }, { wch: 5 }, { wch: 5 }, { wch: 20 }
    ];
    ws['!cols'] = colWidths;
    
    // 2. Mengatur Perataan Teks (Center) dan Border
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (!ws[cell_ref]) continue;
            
            ws[cell_ref].s = {
                alignment: { horizontal: "center", vertical: "center", wrapText: true },
                border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };
        }
    }

    // 3. Menggabungkan Sel (Merge)
    const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }, // Judul Utama
        { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } }, // Sub-judul
        { s: { r: 3, c: 12 }, e: { r: 3, c: 14 } }  // Header ALAMAT
    ];
    
    // Gabungkan sel header lainnya secara vertikal
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15].forEach(colIndex => {
        merges.push({ s: { r: 3, c: colIndex }, e: { r: 4, c: colIndex } });
    });

    ws['!merges'] = merges;
    
    // 4. Atur Style Font
    const titleStyle = { font: { sz: 16, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
    const subtitleStyle = { font: { sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
    const headerStyle = { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } };

    ws['A1'].s = titleStyle;
    ws['A2'].s = subtitleStyle;
    
    // Terapkan style ke semua sel di baris header (baris ke-4 dan ke-5)
    for (let C = 0; C <= 15; ++C) {
        const cell_ref4 = XLSX.utils.encode_cell({c: C, r: 3});
        if(ws[cell_ref4] && ws[cell_ref4].v) ws[cell_ref4].s = { ...ws[cell_ref4].s, ...headerStyle };
        
        const cell_ref5 = XLSX.utils.encode_cell({c: C, r: 4});
        if(ws[cell_ref5] && ws[cell_ref5].v) ws[cell_ref5].s = { ...ws[cell_ref5].s, ...headerStyle };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Data BPD");

    // Buat file Excel dan unduh
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    downloadBlob(blob, `Data_BPD_${periodeFilter || new Date().getFullYear()}.xlsx`);
};

