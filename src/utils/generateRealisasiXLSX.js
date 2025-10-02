import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// --- FUNGSI BANTUAN ---
const formatCurrency = (value) => (typeof value === 'number' ? value : 0);

export const generateRealisasiXLSX = async ({ laporanData, tahun, desa, exportConfig, allPerangkat }) => {
    if (!laporanData || laporanData.length === 0) {
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

    // --- KELOMPOKKAN DATA ---
    const { pendapatan, belanja, totalAnggaranPendapatan, totalRealisasiPendapatan, totalAnggaranBelanja, totalRealisasiBelanja } = laporanData.reduce((acc, item) => {
        const isPendapatan = item.jenis === 'Pendapatan';
        const target = isPendapatan ? acc.pendapatan : acc.belanja;
        if (!target[item.bidang]) target[item.bidang] = [];
        target[item.bidang].push(item);
        if (isPendapatan) {
            acc.totalAnggaranPendapatan += item.jumlah;
            acc.totalRealisasiPendapatan += item.totalRealisasi;
        } else {
            acc.totalAnggaranBelanja += item.jumlah;
            acc.totalRealisasiBelanja += item.totalRealisasi;
        }
        return acc;
    }, { pendapatan: {}, belanja: {}, totalAnggaranPendapatan: 0, totalRealisasiPendapatan: 0, totalAnggaranBelanja: 0, totalRealisasiBelanja: 0 });

    // --- FUNGSI UNTUK MENAMBAHKAN BAGIAN DATA ---
    const addDataSection = (title, data) => {
        const titleRow = worksheet.addRow([, title]);
        for (let i = 1; i <= totalColumns; i++) titleRow.getCell(i).style = boldTextStyle;
        
        Object.entries(data).forEach(([bidang, items]) => {
            if (items.length > 0) {
                const bidangRow = worksheet.addRow([, bidang]);
                for (let i = 1; i <= totalColumns; i++) bidangRow.getCell(i).style = { ...italicTextStyle, alignment: {...italicTextStyle.alignment, indent: 1} };

                items.forEach(item => {
                    const sisa = item.jumlah - item.totalRealisasi;
                    const persentase = item.jumlah > 0 ? item.totalRealisasi / item.jumlah : 0;
                    const itemRow = worksheet.addRow([
                        item.kode_rekening || '',
                        `    ${item.uraian}`,
                        formatCurrency(item.jumlah),
                        formatCurrency(item.totalRealisasi),
                        formatCurrency(sisa),
                        persentase
                    ]);

                    itemRow.getCell('A').style = { ...baseCellStyle, alignment: { ...baseCellStyle.alignment, horizontal: 'left' } };
                    itemRow.getCell('B').style = { ...textCellStyle, alignment: { ...textCellStyle.alignment, indent: 2 } };
                    itemRow.getCell('C').style = currencyCellStyle;
                    itemRow.getCell('D').style = currencyCellStyle;
                    itemRow.getCell('E').style = currencyCellStyle;
                    itemRow.getCell('F').style = percentCellStyle;
                });
            }
        });
    };

    // --- RENDER BAGIAN PENDAPATAN & BELANJA ---
    addDataSection('PENDAPATAN', pendapatan);
    const totalPendapatanRow = worksheet.addRow([
        '', 'JUMLAH PENDAPATAN',
        formatCurrency(totalAnggaranPendapatan),
        formatCurrency(totalRealisasiPendapatan),
        formatCurrency(totalRealisasiPendapatan - totalAnggaranPendapatan),
        totalAnggaranPendapatan > 0 ? totalRealisasiPendapatan / totalAnggaranPendapatan : 0
    ]);
    for (let i = 1; i <= totalColumns; i++) totalPendapatanRow.getCell(i).style = totalRowStyle;
    ['C', 'D', 'E'].forEach(col => totalPendapatanRow.getCell(col).style = totalCurrencyStyle);
    totalPendapatanRow.getCell('F').style = totalPercentStyle;
    
    worksheet.addRow([]);

    addDataSection('BELANJA', belanja);
    const totalBelanjaRow = worksheet.addRow([
        '', 'JUMLAH BELANJA',
        formatCurrency(totalAnggaranBelanja),
        formatCurrency(totalRealisasiBelanja),
        formatCurrency(totalAnggaranBelanja - totalRealisasiBelanja),
        totalAnggaranBelanja > 0 ? totalRealisasiBelanja / totalAnggaranBelanja : 0
    ]);
     for (let i = 1; i <= totalColumns; i++) totalBelanjaRow.getCell(i).style = totalRowStyle;
    ['C', 'D', 'E'].forEach(col => totalBelanjaRow.getCell(col).style = totalCurrencyStyle);
    totalBelanjaRow.getCell('F').style = totalPercentStyle;
    worksheet.addRow([]);

    // --- RENDER BARIS SURPLUS/DEFISIT ---
    const surplusDefisitAnggaran = totalAnggaranPendapatan - totalAnggaranBelanja;
    const surplusDefisitRealisasi = totalRealisasiPendapatan - totalRealisasiBelanja;
    const surplusSisa = surplusDefisitRealisasi - surplusDefisitAnggaran;
    const surplusPersentase = surplusDefisitAnggaran !== 0 ? surplusDefisitRealisasi / surplusDefisitAnggaran : 0;
    const surplusRow = worksheet.addRow([
        '', 'SURPLUS / (DEFISIT)',
        formatCurrency(surplusDefisitAnggaran),
        formatCurrency(surplusDefisitRealisasi),
        formatCurrency(surplusSisa),
        surplusPersentase
    ]);
    for (let i = 1; i <= totalColumns; i++) surplusRow.getCell(i).style = totalRowStyle;
    ['C', 'D', 'E'].forEach(col => surplusRow.getCell(col).style = totalCurrencyStyle);
    surplusRow.getCell('F').style = totalPercentStyle;

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

        worksheet.getCell(`B${sigRowIndex}`).value = 'Mengetahui,';
        worksheet.getCell(`B${sigRowIndex}`).style = signatureStyle;
        worksheet.getCell(`B${sigRowIndex + 1}`).value = 'Kepala Desa';
        worksheet.getCell(`B${sigRowIndex + 1}`).style = signatureStyle;
        worksheet.getCell(`B${sigRowIndex + 5}`).value = (kades?.nama || '(....................................)').toUpperCase();
        worksheet.getCell(`B${sigRowIndex + 5}`).style = nameStyle;

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
