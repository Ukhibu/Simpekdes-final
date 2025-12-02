import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Fungsi Bantuan Internal ---
const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if(isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

const safeFormatDate = (dateField) => {
    if (!dateField) return '-';
    if (typeof dateField.toDate === 'function') {
        return formatDate(dateField.toDate());
    }
    return formatDate(dateField);
};

const formatCurrency = (number) => {
    if (typeof number !== 'number') return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);
};

const getAge = (item) => {
    const dateString = item.tgl_lahir;
    if (!dateString) return '-';
    const birthDate = typeof dateString.toDate === 'function' ? dateString.toDate() : new Date(dateString);
    if (isNaN(birthDate.getTime())) return '-';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
};

// --- Fungsi Generator PDF Inti ---
const generatePDF = (options) => {
    const { title, headers, body, desa, exportConfig, allPerangkat, orientation = 'landscape', finalY: customFinalY, startY = 30, addPageContent } = options;

    const doc = new jsPDF({ orientation });

    // Header Dokumen
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const subTitle = desa === 'all' ? 'KECAMATAN PUNGGELAN' : `DESA ${desa.toUpperCase()}`;
    doc.text(subTitle, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
    
    autoTable(doc, {
        head: headers,
        body: body,
        startY: startY,
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2 },
        didDrawPage: (data) => {
            if (addPageContent) addPageContent(doc, data);
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(10);
            doc.text(`Halaman ${data.pageNumber} dari ${pageCount}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        }
    });

    const finalY = customFinalY || doc.lastAutoTable.finalY;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logic Tanda Tangan
    // Jika desa === 'all', gunakan konfigurasi Camat dari exportConfig
    const signer = (desa === 'all' || !desa) ? {
        location: 'Punggelan',
        jabatan: exportConfig?.jabatanPenandaTangan || 'CAMAT PUNGGELAN',
        nama: exportConfig?.namaPenandaTangan || '(..................)',
        pangkat: exportConfig?.pangkatPenandaTangan || '', // Mengambil Pangkat dari Config
        nip: exportConfig?.nipPenandaTangan ? `NIP. ${exportConfig.nipPenandaTangan}` : ''
    } : {
        location: desa,
        jabatan: `KEPALA DESA ${desa.toUpperCase()}`,
        nama: allPerangkat?.find(p => p.desa === desa && p.jabatan?.toLowerCase().includes('kepala desa'))?.nama || '(..................)',
        pangkat: '',
        nip: ''
    };

    let startY_signature = finalY + 15;
    if (startY_signature > pageHeight - 60) {
        doc.addPage();
        startY_signature = 40;
    }
    
    const signatureX = pageWidth - 70;
    doc.setFontSize(12);
    doc.text(`${signer.location}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, signatureX, startY_signature, { align: 'center' });
    doc.text(signer.jabatan, signatureX, startY_signature + 7, { align: 'center' });
    
    // Nama (Bold)
    doc.setFont('helvetica', 'bold');
    doc.text(signer.nama, signatureX, startY_signature + 28, { align: 'center' });
    doc.setFont('helvetica', 'normal');

    // Pangkat & NIP
    // Jika ada pangkat, tampilkan di bawah nama, lalu NIP di bawahnya
    if (signer.pangkat) {
        doc.text(signer.pangkat, signatureX, startY_signature + 34, { align: 'center' });
        if (signer.nip) doc.text(signer.nip, signatureX, startY_signature + 40, { align: 'center' });
    } else {
        // Fallback jika tidak ada pangkat (posisi NIP seperti semula)
        if (signer.nip) doc.text(signer.nip, signatureX, startY_signature + 35, { align: 'center' });
    }

    doc.save(`${title.replace(/ /g, '_')}_${desa || 'Kecamatan'}.pdf`);
};

export const generateDemografiPDF = (data, desa, exportConfig, title, allPerangkat) => {
    const showDesa = desa === 'all';
    const headers = [['No', 'Nama', 'Jabatan', 'Pendidikan', 'Usia']];
    if (showDesa) headers[0].splice(2, 0, 'Desa');

    const body = data.map((item, index) => {
        const row = [index + 1, item.nama || '-', item.jabatan || '-', item.pendidikan || '-', getAge(item)];
        if (showDesa) row.splice(2, 0, item.desa || '-');
        return row;
    });

    generatePDF({ title, headers, body, desa, exportConfig, allPerangkat });
};

export const generateAsetPDF = (data, desa, exportConfig, allPerangkat) => {
    const showDesa = desa === 'all';
    const headers = [['No', 'Nama Aset', 'Kategori', 'Tgl Perolehan', 'Nilai (Rp)']];
    if (showDesa) headers[0].splice(1, 0, 'Desa');

    const body = data.map((item, index) => {
        const row = [index + 1, item.namaAset || '-', item.kategori || '-', safeFormatDate(item.tanggalPerolehan), formatCurrency(Number(item.nilaiAset))];
        if (showDesa) row.splice(1, 0, item.desa || '-');
        return row;
    });

    generatePDF({ title: 'Laporan Inventaris Aset Desa', headers, body, desa, exportConfig, allPerangkat });
};

export const generateRekapRtRwPDF = (data, exportConfig, allPerangkat) => {
    // Definisi Header sesuai dengan Preview LaporanPage.js
    const headers = [['NO', 'NAMA DESA', 'JML RW', 'JML RT', 'JML DUSUN', 'JML DUKUH']];

    // Variabel untuk menghitung Total
    let totalRw = 0;
    let totalRt = 0;
    let totalDusun = 0;
    let totalDukuh = 0;

    // Mapping Data Body
    // Kita asumsikan 'data' sudah dalam bentuk ter-agregasi (processed) dari LaporanPage.js
    // yaitu array object: { namaDesa, jumlahRw, jumlahRt, jumlahDusun, jumlahDukuh }
    const body = data.map((item, index) => {
        const rw = item.jumlahRw || 0;
        const rt = item.jumlahRt || 0;
        const dusun = item.jumlahDusun || 0;
        const dukuh = item.jumlahDukuh || 0;

        // Akumulasi Total
        totalRw += rw;
        totalRt += rt;
        totalDusun += dusun;
        totalDukuh += dukuh;

        return [
            index + 1,
            item.namaDesa || '-',
            rw,
            rt,
            dusun,
            dukuh
        ];
    });

    // Menambahkan Baris TOTAL KECAMATAN di bagian bawah
    // colSpan: 2 pada kolom pertama untuk menggabungkan "NO" dan "NAMA DESA" agar teks "TOTAL KECAMATAN" muat
    body.push([
        { content: 'TOTAL KECAMATAN', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fillColor: [230, 230, 230] } },
        { content: totalRw, styles: { fontStyle: 'bold', halign: 'center', fillColor: [230, 230, 230] } },
        { content: totalRt, styles: { fontStyle: 'bold', halign: 'center', fillColor: [230, 230, 230] } },
        { content: totalDusun, styles: { fontStyle: 'bold', halign: 'center', fillColor: [230, 230, 230] } },
        { content: totalDukuh, styles: { fontStyle: 'bold', halign: 'center', fillColor: [230, 230, 230] } }
    ]);

    // Generate PDF
    // desa: 'all' dikirim agar footer menggunakan tanda tangan Camat dari exportConfig
    generatePDF({ 
        title: 'REKAPITULASI DATA RT/RW KECAMATAN PUNGGELAN', 
        headers, 
        body, 
        desa: 'all', 
        exportConfig, 
        allPerangkat 
    });
};

export const generateRekapLembagaPDF = (data, exportConfig, allPerangkat) => {
    const headers = [['No', 'Nama Desa', 'Perangkat', 'BPD', 'LPM', 'PKK', 'Karang Taruna', 'RT/RW']];
    const body = data.map((item, index) => [
        index + 1,
        item.desa,
        item.perangkat,
        item.bpd,
        item.lpm,
        item.pkk,
        item.karang_taruna,
        item.rt_rw
    ]);

    generatePDF({ title: 'Laporan Rekapitulasi Jumlah Kelembagaan', headers, body, desa: 'all', exportConfig, allPerangkat });
};

// --- Fungsi Baru untuk Laporan Realisasi ---
export const generateRealisasiPDF = ({ laporanData, tahun, desa, exportConfig, allPerangkat }) => {
    if (!laporanData || laporanData.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }
    
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = 'LAPORAN REALISASI PELAKSANAAN APBDES';
    const subTitle = `PEMERINTAH DESA ${desa.toUpperCase()} TAHUN ANGGARAN ${tahun}`;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(subTitle, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

    const { pendapatan, belanja, totalAnggaranPendapatan, totalRealisasiPendapatan, totalAnggaranBelanja, totalRealisasiBelanja } = laporanData.reduce((acc, item) => {
        const isPendapatan = item.jenis === 'Pendapatan';
        (isPendapatan ? acc.pendapatan : acc.belanja).push(item);
        if (isPendapatan) {
            acc.totalAnggaranPendapatan += item.jumlah;
            acc.totalRealisasiPendapatan += item.totalRealisasi;
        } else {
            acc.totalAnggaranBelanja += item.jumlah;
            acc.totalRealisasiBelanja += item.totalRealisasi;
        }
        return acc;
    }, { pendapatan: [], belanja: [], totalAnggaranPendapatan: 0, totalRealisasiPendapatan: 0, totalAnggaranBelanja: 0, totalRealisasiBelanja: 0 });

    const tableBody = [];
    const addSection = (title, data) => {
        tableBody.push([{ content: title, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }]);
        data.forEach(item => {
            const sisa = item.jumlah - item.totalRealisasi;
            const persentase = item.jumlah > 0 ? `${(item.totalRealisasi / item.jumlah * 100).toFixed(2)}%` : '0.00%';
            tableBody.push([
                item.kode_rekening || '',
                item.uraian,
                formatCurrency(item.jumlah),
                formatCurrency(item.totalRealisasi),
                formatCurrency(sisa),
                { content: persentase, styles: { halign: 'center' } }
            ]);
        });
    };
    
    addSection('PENDAPATAN', pendapatan);
    addSection('BELANJA', belanja);

    const surplusAnggaran = totalAnggaranPendapatan - totalAnggaranBelanja;
    const surplusRealisasi = totalRealisasiPendapatan - totalRealisasiBelanja;

    tableBody.push([
        { content: 'SURPLUS / (DEFISIT)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [200, 200, 200] } },
        { content: formatCurrency(surplusAnggaran), styles: { fontStyle: 'bold', fillColor: [200, 200, 200] } },
        { content: formatCurrency(surplusRealisasi), styles: { fontStyle: 'bold', fillColor: [200, 200, 200] } },
        { content: formatCurrency(surplusRealisasi - surplusAnggaran), styles: { fontStyle: 'bold', fillColor: [200, 200, 200] } },
        ''
    ]);
    
    autoTable(doc, {
        head: [['Kode Rekening', 'Uraian', 'Anggaran (Rp)', 'Realisasi (Rp)', 'Sisa (Rp)', '%']],
        body: tableBody,
        startY: 30,
        theme: 'grid',
        headStyles: { halign: 'center', fontStyle: 'bold' },
        columnStyles: {
            2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'center' }
        }
    });
    
    // Tanda tangan
    const finalY = doc.lastAutoTable.finalY;
    const signer = {
        location: desa,
        jabatan: `KEPALA DESA ${desa.toUpperCase()}`,
        nama: allPerangkat?.find(p => p.desa === desa && p.jabatan?.toLowerCase().includes('kepala desa'))?.nama || '(..................)',
    };
    
    let startY_signature = finalY + 15;
    if (startY_signature > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        startY_signature = 30;
    }
    
    const signatureX = doc.internal.pageSize.getWidth() - 70;
    doc.setFontSize(10);
    doc.text(`${signer.location}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, signatureX, startY_signature, { align: 'center' });
    doc.text(signer.jabatan, signatureX, startY_signature + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(signer.nama.toUpperCase(), signatureX, startY_signature + 25, { align: 'center' });

    doc.save(`Laporan_Realisasi_${desa}_${tahun}.pdf`);
};

// Fungsi generateKeuanganPDF yang lama, tetap ada jika masih ada yang memanggilnya, namun tidak digunakan oleh LaporanPage lagi
export const generateKeuanganPDF = (data, desa, exportConfig, allPerangkat) => {
    const headers = ['No', 'Tanggal', 'Uraian', 'Jenis', 'Pemasukan (Rp)', 'Pengeluaran (Rp)'];
    if (desa === 'all') headers.splice(1, 0, 'Desa');

    let totalPemasukan = 0;
    let totalPengeluaran = 0;

    const body = data.map((t, index) => {
        const isPemasukan = (t.jenis || '').toLowerCase() === 'pendapatan';
        const nilai = Number(t.jumlah) || 0;
        const pemasukan = isPemasukan ? nilai : 0;
        const pengeluaran = !isPemasukan ? nilai : 0;
        totalPemasukan += pemasukan;
        totalPengeluaran += pengeluaran;
        const row = [index + 1, safeFormatDate(t.tanggal), t.uraian || '-', t.jenis || '-', formatCurrency(pemasukan), formatCurrency(pengeluaran)];
        if (desa === 'all') row.splice(1, 0, t.desa || '-');
        return row;
    });
    
    const totalRow = ['', 'TOTAL', '', '', formatCurrency(totalPemasukan), formatCurrency(totalPengeluaran)];
    if(desa === 'all') totalRow.splice(1, 0, '');
    body.push(totalRow.map(cell => ({ content: cell, styles: { fontStyle: 'bold' } })));

    generatePDF({ title: 'Laporan Rekapitulasi Keuangan', headers, body, desa, exportConfig, allPerangkat });
};