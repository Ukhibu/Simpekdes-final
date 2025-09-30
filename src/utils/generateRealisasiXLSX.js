import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const formatCurrency = (value) => (typeof value === 'number' ? value : 0);
const formatPercentage = (value) => (typeof value === 'number' ? value / 100 : 0);

export const generateRealisasiXLSX = async ({ laporanData, tahun, desa, exportConfig }) => {
    if (!laporanData) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan Realisasi APBDes');

    // --- STYLES ---
    const titleStyle = { font: { name: 'Arial', size: 14, bold: true }, alignment: { horizontal: 'center' } };
    const subtitleStyle = { font: { name: 'Arial', size: 12 }, alignment: { horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } };
    const baseCellStyle = { font: { name: 'Arial', size: 9 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle' } };
    const boldCellStyle = { ...baseCellStyle, font: { ...baseCellStyle.font, bold: true } };
    const currencyCellStyle = { ...baseCellStyle, numFmt: '"Rp"#,##0;[Red]-"Rp"#,##0' };
    const percentCellStyle = { ...baseCellStyle, numFmt: '0.00%' };
    const totalRowStyle = { ...boldCellStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } } };
    const totalCurrencyStyle = { ...totalRowStyle, numFmt: '"Rp"#,##0;[Red]-"Rp"#,##0' };
    const totalPercentStyle = { ...totalRowStyle, numFmt: '0.00%' };

    // --- HEADER DOKUMEN ---
    const desaName = desa === 'all' ? 'SE-KECAMATAN PUNGGELAN' : `DESA ${desa.toUpperCase()}`;
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = `LAPORAN REALISASI PELAKSANAAN APBDES`;
    worksheet.getCell('A1').style = titleStyle;
    worksheet.mergeCells('A2:G2');
    worksheet.getCell('A2').value = `PEMERINTAH ${desaName}`;
    worksheet.getCell('A2').style = subtitleStyle;
    worksheet.mergeCells('A3:G3');
    worksheet.getCell('A3').value = `TAHUN ANGGARAN ${tahun}`;
    worksheet.getCell('A3').style = subtitleStyle;
    worksheet.addRow([]);

    // --- HEADER TABEL ---
    const headerRow = worksheet.addRow(['KODE', 'URAIAN', 'ANGGARAN', 'REALISASI', 'LEBIH/(KURANG)', '%']);
    headerRow.eachCell(cell => cell.style = headerStyle);

    let totalAnggaranPendapatan = 0;
    let totalRealisasiPendapatan = 0;
    let totalAnggaranBelanja = 0;
    let totalRealisasiBelanja = 0;

    const addDataSection = (title, data) => {
        const titleRow = worksheet.addRow([, title]);
        titleRow.font = { name: 'Arial', size: 10, bold: true };
        let sectionTotalAnggaran = 0;
        let sectionTotalRealisasi = 0;

        Object.entries(data).forEach(([bidang, items]) => {
            const bidangRow = worksheet.addRow([, bidang]);
            bidangRow.font = { bold: true };
            items.forEach(item => {
                const sisa = item.anggaran - item.realisasi;
                const persentase = item.anggaran > 0 ? item.realisasi / item.anggaran : 0;
                worksheet.addRow([
                    , `    ${item.kategori}`,
                    formatCurrency(item.anggaran),
                    formatCurrency(item.realisasi),
                    formatCurrency(sisa),
                    formatPercentage(persentase)
                ]);
                sectionTotalAnggaran += item.anggaran;
                sectionTotalRealisasi += item.realisasi;
            });
        });

        // Total per section
        const sisa = sectionTotalAnggaran - sectionTotalRealisasi;
        const persentase = sectionTotalAnggaran > 0 ? sectionTotalRealisasi / sectionTotalAnggaran : 0;
        const totalRow = worksheet.addRow([
            , `JUMLAH ${title.toUpperCase()}`,
            formatCurrency(sectionTotalAnggaran),
            formatCurrency(sectionTotalRealisasi),
            formatCurrency(sisa),
            formatPercentage(persentase)
        ]);
        totalRow.eachCell(cell => cell.style = totalRowStyle);
        
        return { anggaran: sectionTotalAnggaran, realisasi: sectionTotalRealisasi };
    };

    // --- PENDAPATAN ---
    const { anggaran: totalAP, realisasi: totalRP } = addDataSection('PENDAPATAN', laporanData.pendapatan);
    totalAnggaranPendapatan = totalAP;
    totalRealisasiPendapatan = totalRP;
    worksheet.addRow([]);

    // --- BELANJA ---
    const { anggaran: totalAB, realisasi: totalRB } = addDataSection('BELANJA', laporanData.belanja);
    totalAnggaranBelanja = totalAB;
    totalRealisasiBelanja = totalRB;
    worksheet.addRow([]);

    // --- SURPLUS/DEFISIT ---
    const surplusDefisitAnggaran = totalAnggaranPendapatan - totalAnggaranBelanja;
    const surplusDefisitRealisasi = totalRealisasiPendapatan - totalRealisasiBelanja;
    const surplusRow = worksheet.addRow([
        , 'SURPLUS/(DEFISIT)',
        formatCurrency(surplusDefisitAnggaran),
        formatCurrency(surplusDefisitRealisasi),
        formatCurrency(surplusDefisitAnggaran - surplusDefisitRealisasi)
    ]);
    surplusRow.eachCell(cell => cell.style = totalRowStyle);

    // --- STYLING AKHIR & LEBAR KOLOM ---
    worksheet.columns = [
        { width: 5 }, { width: 40 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 10 }
    ];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 5) {
            row.getCell(2).alignment = { indent: (row.getCell(2).value || '').startsWith('    ') ? 2 : 1, vertical: 'middle', wrapText: true };
            row.getCell(3).style = { ...currencyCellStyle, border: baseCellStyle.border };
            row.getCell(4).style = { ...currencyCellStyle, border: baseCellStyle.border };
            row.getCell(5).style = { ...currencyCellStyle, border: baseCellStyle.border };
            row.getCell(6).style = { ...percentCellStyle, border: baseCellStyle.border, alignment: { ...percentCellStyle.alignment, horizontal: 'center' } };
            
            // Apply total styles
            if ((row.getCell(2).value || '').startsWith('JUMLAH') || (row.getCell(2).value || '').startsWith('SURPLUS')) {
                row.getCell(2).style = { ...totalRowStyle, alignment: { ...totalRowStyle.alignment, indent: 1 } };
                row.getCell(3).style = totalCurrencyStyle;
                row.getCell(4).style = totalCurrencyStyle;
                row.getCell(5).style = totalCurrencyStyle;
                row.getCell(6).style = totalPercentStyle;
            }
        }
    });

    // --- SIGNATURE BLOCK ---
    if (exportConfig && desa !== 'all') {
        worksheet.addRow([]);
        const sigRowIndex = worksheet.lastRow.number + 2;
        const kades = exportConfig.kepalaDesa?.[desa];
        
        worksheet.mergeCells(`E${sigRowIndex}:G${sigRowIndex}`);
        worksheet.getCell(`E${sigRowIndex}`).value = `${desa}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.getCell(`E${sigRowIndex}`).alignment = { horizontal: 'center' };
        
        worksheet.mergeCells(`E${sigRowIndex + 1}:G${sigRowIndex + 1}`);
        worksheet.getCell(`E${sigRowIndex + 1}`).value = 'Kepala Desa';
        worksheet.getCell(`E${sigRowIndex + 1}`).alignment = { horizontal: 'center' };

        worksheet.mergeCells(`E${sigRowIndex + 5}:G${sigRowIndex + 5}`);
        const kadesCell = worksheet.getCell(`E${sigRowIndex + 5}`);
        kadesCell.value = kades?.nama.toUpperCase() || '(....................................)';
        kadesCell.font = { name: 'Arial', size: 10, bold: true, underline: true };
        kadesCell.alignment = { horizontal: 'center' };
    }


    // --- SIMPAN FILE ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Laporan_Realisasi_APBDes_${desa}_${tahun}.xlsx`);
};
