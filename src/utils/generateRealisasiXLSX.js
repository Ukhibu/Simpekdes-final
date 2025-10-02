import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// --- FUNGSI BANTUAN ---
const formatCurrency = (value) => (typeof value === 'number' ? value : 0);

export const generateRealisasiXLSX = async ({ laporanData, tahun, desa, exportConfig, allPerangkat }) => {
    if (!laporanData) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan Realisasi APBDes');

    // --- PENGATURAN HALAMAN ---
    worksheet.pageSetup = {
        orientation: 'portrait', paperSize: 9, // A4
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
        horizontalCentered: true,
    };

    // --- STYLES ---
    const titleStyle = { font: { name: 'Arial', size: 14, bold: true }, alignment: { horizontal: 'center' } };
    const subtitleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } } };
    const baseCellStyle = { font: { name: 'Arial', size: 9 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const currencyCellStyle = { ...baseCellStyle, numFmt: '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"??_);_(@_)' };
    const percentCellStyle = { ...baseCellStyle, numFmt: '0.00%', alignment: { ...baseCellStyle.alignment, horizontal: 'center' } };
    const textCellStyle = { ...baseCellStyle, alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } };
    const boldTextStyle = { ...textCellStyle, font: { ...textCellStyle.font, bold: true } };
    const italicTextStyle = { ...textCellStyle, font: { ...textCellStyle.font, italic: true } };
    const totalRowStyle = { ...boldTextStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } } };
    const totalCurrencyStyle = { ...totalRowStyle, numFmt: currencyCellStyle.numFmt };
    const totalPercentStyle = { ...totalRowStyle, numFmt: percentCellStyle.numFmt, alignment: { ...totalRowStyle.alignment, horizontal: 'center' } };

    // --- HEADER DOKUMEN ---
    const totalColumns = 6;
    worksheet.mergeCells(1, 1, 1, totalColumns);
    worksheet.getCell('A1').value = `LAPORAN REALISASI PELAKSANAAN APBDES`;
    worksheet.getCell('A1').style = titleStyle;
    worksheet.mergeCells(2, 1, 2, totalColumns);
    worksheet.getCell('A2').value = `PEMERINTAH DESA ${desa.toUpperCase()}`;
    worksheet.getCell('A2').style = subtitleStyle;
    worksheet.mergeCells(3, 1, 3, totalColumns);
    worksheet.getCell('A3').value = `TAHUN ANGGARAN ${tahun}`;
    worksheet.getCell('A3').style = subtitleStyle;
    worksheet.addRow([]);

    // --- HEADER TABEL ---
    const headerRow = worksheet.addRow(['KODE REKENING', 'URAIAN', 'ANGGARAN (Rp)', 'REALISASI (Rp)', 'LEBIH / (KURANG) (Rp)', 'PERSENTASE (%)']);
    headerRow.eachCell(cell => cell.style = headerStyle);
    headerRow.height = 30;

    // --- FUNGSI UNTUK MENAMBAHKAN BAGIAN DATA ---
    const addDataSection = (title, data) => {
        let sectionTotalAnggaran = 0;
        let sectionTotalRealisasi = 0;

        const titleRow = worksheet.addRow([, title]);
        for (let i = 1; i <= totalColumns; i++) titleRow.getCell(i).style = boldTextStyle;
        
        Object.entries(data).forEach(([bidang, items]) => {
            // **PERBAIKAN**: Hanya tampilkan bidang jika ada item di dalamnya
            if (items.length > 0) {
                const bidangRow = worksheet.addRow([, bidang]);
                for (let i = 1; i <= totalColumns; i++) bidangRow.getCell(i).style = { ...italicTextStyle, alignment: {...italicTextStyle.alignment, indent: 1} };

                items.forEach(item => {
                    const sisa = item.anggaran - item.realisasi;
                    const persentase = item.anggaran > 0 ? item.realisasi / item.anggaran : 0;
                    const itemRow = worksheet.addRow([
                        , `    ${item.kategori}`,
                        formatCurrency(item.anggaran),
                        formatCurrency(item.realisasi),
                        formatCurrency(sisa),
                        persentase
                    ]);

                    for (let i = 1; i <= totalColumns; i++) itemRow.getCell(i).style = baseCellStyle;
                    itemRow.getCell(2).style = { ...textCellStyle, alignment: { ...textCellStyle.alignment, indent: 2 } };
                    itemRow.getCell(3).style = currencyCellStyle;
                    itemRow.getCell(4).style = currencyCellStyle;
                    itemRow.getCell(5).style = currencyCellStyle;
                    itemRow.getCell(6).style = percentCellStyle;

                    sectionTotalAnggaran += item.anggaran;
                    sectionTotalRealisasi += item.realisasi;
                });
            }
        });

        const sectionSisa = sectionTotalAnggaran - sectionTotalRealisasi;
        const sectionPersentase = sectionTotalAnggaran > 0 ? sectionTotalRealisasi / sectionTotalAnggaran : 0;
        const totalRow = worksheet.addRow([
            , `JUMLAH ${title.toUpperCase()}`,
            formatCurrency(sectionTotalAnggaran),
            formatCurrency(sectionTotalRealisasi),
            formatCurrency(sectionSisa),
            sectionPersentase
        ]);
        
        for (let i = 1; i <= totalColumns; i++) totalRow.getCell(i).style = totalRowStyle;
        totalRow.getCell(3).style = totalCurrencyStyle;
        totalRow.getCell(4).style = totalCurrencyStyle;
        totalRow.getCell(5).style = totalCurrencyStyle;
        totalRow.getCell(6).style = totalPercentStyle;
        
        return { anggaran: sectionTotalAnggaran, realisasi: sectionTotalRealisasi };
    };

    // --- RENDER BAGIAN PENDAPATAN & BELANJA ---
    const { anggaran: totalAnggaranPendapatan, realisasi: totalRealisasiPendapatan } = addDataSection('PENDAPATAN', laporanData.pendapatan);
    worksheet.addRow([]);
    const { anggaran: totalAnggaranBelanja, realisasi: totalRealisasiBelanja } = addDataSection('BELANJA', laporanData.belanja);
    worksheet.addRow([]);

    // --- RENDER BARIS SURPLUS/DEFISIT ---
    const surplusDefisitAnggaran = totalAnggaranPendapatan - totalAnggaranBelanja;
    const surplusDefisitRealisasi = totalRealisasiPendapatan - totalRealisasiBelanja;
    const surplusSisa = surplusDefisitRealisasi - surplusDefisitAnggaran;
    const surplusPersentase = surplusDefisitAnggaran !== 0 ? surplusDefisitRealisasi / surplusDefisitAnggaran : 0;
    const surplusRow = worksheet.addRow([
        , 'SURPLUS / (DEFISIT)',
        formatCurrency(surplusDefisitAnggaran),
        formatCurrency(surplusDefisitRealisasi),
        formatCurrency(surplusSisa),
        surplusPersentase
    ]);
    for (let i = 1; i <= totalColumns; i++) surplusRow.getCell(i).style = totalRowStyle;
    surplusRow.getCell(3).style = totalCurrencyStyle;
    surplusRow.getCell(4).style = totalCurrencyStyle;
    surplusRow.getCell(5).style = totalCurrencyStyle;
    surplusRow.getCell(6).style = totalPercentStyle;
    
    // --- LEBAR KOLOM ---
    worksheet.columns = [ { width: 15 }, { width: 45 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 12 }];

    // --- BLOK TANDA TANGAN ---
    if (exportConfig && desa !== 'all') {
        worksheet.addRow([]);
        const sigRowIndex = worksheet.lastRow.number + 2;
        const kades = allPerangkat.find(p => p.desa === desa && p.jabatan?.toLowerCase() === 'kepala desa');
        const sekdes = allPerangkat.find(p => p.desa === desa && p.jabatan?.toLowerCase() === 'sekretaris desa');

        const signatureStyle = { font: { name: 'Arial', size: 10 }, alignment: { horizontal: 'center' } };
        const nameStyle = { ...signatureStyle, font: { ...signatureStyle.font, bold: true, underline: true } };

        // Mengetahui (Kiri)
        worksheet.getCell(`B${sigRowIndex}`).value = 'Mengetahui,';
        worksheet.getCell(`B${sigRowIndex}`).style = signatureStyle;
        worksheet.getCell(`B${sigRowIndex + 1}`).value = 'Kepala Desa';
        worksheet.getCell(`B${sigRowIndex + 1}`).style = signatureStyle;
        worksheet.getCell(`B${sigRowIndex + 5}`).value = (kades?.nama || '(....................................)').toUpperCase();
        worksheet.getCell(`B${sigRowIndex + 5}`).style = nameStyle;

        // Disusun oleh (Kanan)
        worksheet.getCell(`E${sigRowIndex}`).value = `${desa}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.getCell(`E${sigRowIndex}`).style = signatureStyle;
        worksheet.getCell(`E${sigRowIndex + 1}`).value = 'Disusun oleh,';
        worksheet.getCell(`E${sigRowIndex + 1}`).style = signatureStyle;
        worksheet.getCell(`E${sigRowIndex + 2}`).value = 'Sekretaris Desa';
        worksheet.getCell(`E${sigRowIndex + 2}`).style = signatureStyle;
        worksheet.getCell(`E${sigRowIndex + 5}`).value = (sekdes?.nama || '(....................................)').toUpperCase();
        worksheet.getCell(`E${sigRowIndex + 5}`).style = nameStyle;
    }


    // --- SIMPAN FILE ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Laporan_Realisasi_APBDes_${desa}_${tahun}.xlsx`);
};

