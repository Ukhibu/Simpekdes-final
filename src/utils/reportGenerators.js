import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './dateFormatter';

// --- Fungsi Bantuan ---
const getAge = (dateString) => {
    if (!dateString) return null;
    const birthDate = new Date(dateString);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

const formatCurrency = (number) => {
    if (typeof number !== 'number') return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

// --- PERBAIKAN: Fungsi aman untuk memformat tanggal dari berbagai tipe ---
const safeFormatDate = (dateField) => {
    if (!dateField) return '-';
    // Cek apakah ini objek Timestamp Firestore
    if (typeof dateField.toDate === 'function') {
        return formatDate(dateField.toDate());
    }
    // Jika sudah berupa string atau objek Date, biarkan formatDate menanganinya
    return formatDate(dateField);
};

const drawSignatureBlock = (doc, finalY, exportConfig) => {
    if (exportConfig) {
        const sigX = doc.internal.pageSize.getWidth() - 100;
        doc.text(`Punggelan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, sigX, finalY + 20, { align: 'center' });
        doc.text(exportConfig.jabatanPenandaTangan || '', sigX, finalY + 27, { align: 'center' });
        doc.text(exportConfig.namaPenandaTangan || '', sigX, finalY + 48, { align: 'center', fontStyle: 'bold' });
        doc.text(exportConfig.pangkatPenandaTangan || '', sigX, finalY + 55, { align: 'center' });
        doc.text(`NIP. ${exportConfig.nipPenandaTangan || ''}`, sigX, finalY + 62, { align: 'center' });
    }
};

// --- Laporan Demografi Perangkat ---
export const generateDemografiPerangkatPDF = (data, desa, exportConfig) => {
    if (!data || data.length === 0) {
        alert("Tidak ada data untuk membuat laporan.");
        return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const title = `LAPORAN DEMOGRAFI PERANGKAT DESA ${desa === 'all' ? 'SE-KECAMATAN PUNGGELAN' : `DESA ${desa.toUpperCase()}`}`;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Per Tanggal: ${formatDate(new Date(), 'long-dayless')}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

    const head = [['No', 'Nama', 'Jabatan', 'Jenis Kelamin', 'Pendidikan', 'Usia']];
    if (desa === 'all') {
        head[0].splice(2, 0, 'Desa');
    }

    const body = data.map((p, index) => {
        const row = [
            index + 1, p.nama || '-', p.jabatan || '-',
            p.jenis_kelamin === 'L' ? 'Laki-laki' : (p.jenis_kelamin === 'P' ? 'Perempuan' : '-'),
            p.pendidikan || '-', getAge(p.tgl_lahir) || '-',
        ];
        if (desa === 'all') row.splice(2, 0, p.desa || '-');
        return row;
    });

    autoTable(doc, {
        head, body, startY: 30, theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
        styles: { halign: 'center' },
        columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' }, 3: { halign: 'left' } }
    });

    let finalY = doc.lastAutoTable.finalY;
    const totalPerangkat = data.length;
    const lakiLaki = data.filter(p => p.jenis_kelamin === 'L').length;
    const perempuan = totalPerangkat - lakiLaki;
    const validAges = data.map(p => getAge(p.tgl_lahir)).filter(age => age !== null);
    const avgAge = validAges.length > 0 ? Math.round(validAges.reduce((sum, age) => sum + age, 0) / validAges.length) : 0;
    const summary = [`Total Perangkat: ${totalPerangkat}`, `Laki-laki: ${lakiLaki}`, `Perempuan: ${perempuan}`, `Rata-rata Usia: ${avgAge} tahun`];

    doc.setFontSize(10);
    doc.text("Ringkasan:", 14, finalY + 10);
    summary.forEach((line, i) => doc.text(line, 14, finalY + 16 + (i * 5)));

    drawSignatureBlock(doc, finalY, exportConfig);
    doc.save(`laporan_demografi_perangkat_${desa}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- Laporan Rekapitulasi Keuangan ---
export const generateKeuanganPDF = (data, desa, exportConfig) => {
    if (!data || data.length === 0) {
        alert("Tidak ada data keuangan untuk membuat laporan.");
        return;
    }
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = `LAPORAN REKAPITULASI KEUANGAN ${desa === 'all' ? 'SE-KECAMATAN PUNGGELAN' : `DESA ${desa.toUpperCase()}`}`;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Periode Laporan: [Tanggal Awal] - [Tanggal Akhir]`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

    const head = [['No', 'Tanggal', 'Uraian', 'Pemasukan (Rp)', 'Pengeluaran (Rp)']];
    const body = data.map((item, index) => [
        index + 1,
        safeFormatDate(item.tanggal),
        item.uraian || '-',
        formatCurrency(item.pemasukan || 0),
        formatCurrency(item.pengeluaran || 0)
    ]);

    autoTable(doc, {
        head, body, startY: 30, theme: 'grid',
        headStyles: { fillColor: [22, 160, 133], textColor: 255, halign: 'center' },
        styles: { halign: 'center' },
        columnStyles: { 2: { halign: 'left' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });

    let finalY = doc.lastAutoTable.finalY;
    const totalPemasukan = data.reduce((sum, item) => sum + (item.pemasukan || 0), 0);
    const totalPengeluaran = data.reduce((sum, item) => sum + (item.pengeluaran || 0), 0);
    const saldoAkhir = totalPemasukan - totalPengeluaran;
    const summary = [
        `Total Pemasukan: ${formatCurrency(totalPemasukan)}`,
        `Total Pengeluaran: ${formatCurrency(totalPengeluaran)}`,
        `Saldo Akhir: ${formatCurrency(saldoAkhir)}`
    ];

    doc.setFontSize(10);
    doc.text("Ringkasan Keuangan:", 14, finalY + 10);
    summary.forEach((line, i) => doc.text(line, 14, finalY + 16 + (i * 5)));
    
    drawSignatureBlock(doc, finalY, exportConfig);
    doc.save(`laporan_keuangan_${desa}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- Laporan Inventaris Aset ---
export const generateAsetPDF = (data, desa, exportConfig) => {
    if (!data || data.length === 0) {
        alert("Tidak ada data aset untuk membuat laporan.");
        return;
    }
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = `LAPORAN INVENTARIS ASET DESA ${desa === 'all' ? 'SE-KECAMATAN PUNGGELAN' : `DESA ${desa.toUpperCase()}`}`;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Per Tanggal: ${formatDate(new Date(), 'long-dayless')}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

    const head = [['No', 'Nama Aset', 'Kode Barang', 'Tgl Perolehan', 'Jumlah', 'Kondisi', 'Nilai (Rp)']];
    const body = data.map((item, index) => [
        index + 1, item.namaAset || '-', item.kodeBarang || '-',
        safeFormatDate(item.tanggalPerolehan),
        item.jumlah || 0, item.kondisi || '-', formatCurrency(item.nilaiAset || 0)
    ]);

    autoTable(doc, {
        head, body, startY: 30, theme: 'grid',
        headStyles: { fillColor: [211, 84, 0], textColor: 255, halign: 'center' },
        styles: { halign: 'center' },
        columnStyles: { 1: { halign: 'left' }, 6: { halign: 'right' } }
    });
    
    let finalY = doc.lastAutoTable.finalY;
    const totalAset = data.reduce((sum, item) => sum + (item.jumlah || 0), 0);
    const totalNilai = data.reduce((sum, item) => sum + ((item.nilaiAset || 0) * (item.jumlah || 0)), 0);
    const kondisiBaik = data.filter(i => i.kondisi === 'Baik').length;
    const kondisiRusak = data.filter(i => i.kondisi !== 'Baik').length;
    
    const summary = [
        `Total Jumlah Aset: ${totalAset} unit`,
        `Total Nilai Aset: ${formatCurrency(totalNilai)}`,
        `Kondisi Baik: ${kondisiBaik} unit`,
        `Kondisi Rusak/Lainnya: ${kondisiRusak} unit`
    ];

    doc.setFontSize(10);
    doc.text("Ringkasan Aset:", 14, finalY + 10);
    summary.forEach((line, i) => doc.text(line, 14, finalY + 16 + (i * 5)));

    drawSignatureBlock(doc, finalY, exportConfig);
    doc.save(`laporan_aset_${desa}_${new Date().toISOString().split('T')[0]}.pdf`);
};

