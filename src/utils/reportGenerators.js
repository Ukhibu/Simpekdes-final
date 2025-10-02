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
    // Handle Firestore Timestamp or ISO string
    const birthDate = typeof dateString.toDate === 'function' ? dateString.toDate() : new Date(dateString);
    if (isNaN(birthDate.getTime())) return '-';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
};

// --- Fungsi Generator PDF Inti yang Cerdas ---
const generatePDF = (options) => {
    const { title, headers, body, desa, exportConfig, allPerangkat, orientation = 'landscape' } = options;

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
        head: [headers],
        body: body,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8 },
        didDrawPage: (data) => {
             // Footer Halaman
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(10);
            doc.text(`Halaman ${data.pageNumber} dari ${pageCount}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        }
    });

    const finalY = (doc).lastAutoTable.finalY;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    const signer = (desa === 'all' || !desa) ? {
        location: 'Punggelan',
        jabatan: exportConfig?.jabatanPenandaTangan || 'CAMAT PUNGGELAN',
        nama: exportConfig?.namaPenandaTangan || '(..................)',
        nip: exportConfig?.nipPenandaTangan ? `NIP. ${exportConfig.nipPenandaTangan}` : ''
    } : {
        location: desa,
        jabatan: `KEPALA DESA ${desa.toUpperCase()}`,
        nama: allPerangkat?.find(p => p.desa === desa && p.jabatan?.toLowerCase().includes('kepala desa'))?.nama || '(..................)',
        nip: ''
    };

    const signatureBlockHeight = 40; 
    const minBottomPadding = 20;

    let startY = finalY + 15;
    if (startY + signatureBlockHeight > pageHeight - minBottomPadding) {
        doc.addPage();
        startY = 40;
    }

    const signatureX = orientation === 'landscape' ? pageWidth - 70 : pageWidth - 60;
    const lineHeight = 7;
    doc.setFontSize(12);
    
    const lines = [
        `${signer.location}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        signer.jabatan,
        '', '', '', // Spasi untuk tanda tangan
        signer.nama,
        signer.nip
    ].filter(Boolean); // Filter baris kosong

    lines.forEach((line, index) => {
        if (index === lines.length - 2) { // Baris nama
            doc.setFont('helvetica', 'bold');
            doc.text(line, signatureX, startY + (index * lineHeight), { align: 'center' });
            doc.setLineWidth(0.5);
            doc.line(signatureX - (doc.getTextWidth(line) / 2), startY + (index * lineHeight) + 1, signatureX + (doc.getTextWidth(line) / 2), startY + (index * lineHeight) + 1);
            doc.setFont('helvetica', 'normal');
        } else {
            doc.text(line, signatureX, startY + (index * lineHeight), { align: 'center' });
        }
    });

    doc.save(`${title.replace(/ /g, '_')}_${desa || 'Kecamatan'}.pdf`);
};

// --- Fungsi Ekspor Spesifik (sekarang hanya menyiapkan data) ---

export const generateDemografiPDF = (data, desa, exportConfig, title, allPerangkat) => {
    const headers = ['No', 'Nama', 'Jabatan', 'Pendidikan', 'Usia'];
    if (desa === 'all') headers.splice(2, 0, 'Desa');

    const body = data.map((p, index) => {
        const row = [
            index + 1,
            p.nama || '-',
            p.jabatan || '-',
            p.pendidikan || '-',
            getAge(p),
        ];
        if (desa === 'all') row.splice(2, 0, p.desa || '-');
        return row;
    });

    generatePDF({ title, headers, body, desa, exportConfig, allPerangkat });
};

export const generateKeuanganPDF = (data, desa, exportConfig, allPerangkat) => {
    const headers = ['No', 'Tanggal', 'Uraian', 'Jenis', 'Pemasukan (Rp)', 'Pengeluaran (Rp)'];
    if (desa === 'all') headers.splice(1, 0, 'Desa');

    let totalPemasukan = 0;
    let totalPengeluaran = 0;

    const body = data.map((t, index) => {
        const jenisRaw = (t.jenis || '').toString().toLowerCase();
        const nilai = Number(t.jumlah) || 0;
        
        // [PERBAIKAN] Menggunakan "pendapatan" dan "belanja"
        const isPemasukan = jenisRaw === 'pendapatan';
        const isPengeluaran = jenisRaw === 'belanja';

        const pemasukan = isPemasukan ? nilai : 0;
        const pengeluaran = isPengeluaran ? nilai : 0;

        totalPemasukan += pemasukan;
        totalPengeluaran += pengeluaran;

        const row = [
            index + 1,
            safeFormatDate(t.tanggal),
            t.uraian || '-',
            t.jenis || '-',
            formatCurrency(pemasukan),
            formatCurrency(pengeluaran),
        ];
        if (desa === 'all') row.splice(1, 0, t.desa || '-');
        return row;
    });
    
    const totalRow = ['', 'TOTAL', '', '', formatCurrency(totalPemasukan), formatCurrency(totalPengeluaran)];
    if(desa === 'all') totalRow.splice(1, 0, '');
    body.push(totalRow.map(cell => ({ content: cell, styles: { fontStyle: 'bold' } })));

    generatePDF({ title: 'Laporan Rekapitulasi Keuangan', headers, body, desa, exportConfig, allPerangkat });
};

export const generateAsetPDF = (data, desa, exportConfig, allPerangkat) => {
    const headers = ['No', 'Nama Aset', 'Kategori', 'Tgl Perolehan', 'Kondisi', 'Nilai Aset (Rp)'];
    if (desa === 'all') headers.splice(1, 0, 'Desa');

    let totalNilai = 0;

    const body = data.map((a, index) => {
        totalNilai += Number(a.nilaiAset) || 0;
        const row = [
            index + 1,
            a.namaAset,
            a.kategori || '-',
            safeFormatDate(a.tanggalPerolehan),
            a.kondisi || '-',
            formatCurrency(a.nilaiAset),
        ];
        if (desa === 'all') row.splice(1, 0, a.desa || '-');
        return row;
    });
    
    const totalRow = ['', 'TOTAL NILAI ASET', '', '', '', formatCurrency(totalNilai)];
    if(desa === 'all') totalRow.splice(1, 0, '');
    body.push(totalRow.map(cell => ({ content: cell, styles: { fontStyle: 'bold' } })));

    generatePDF({ title: 'Laporan Inventaris Aset Desa', headers, body, desa, exportConfig, allPerangkat });
};

export const generateRekapRtRwPDF = (data, exportConfig, allPerangkat) => {
    const headers = ['No', 'Desa', 'Jabatan', 'Nomor', 'Nama Ketua', 'Dusun/Dukuh'];
    
    const body = data.map((item, index) => [
        index + 1,
        item.desa || '-',
        item.jabatan || '-',
        item.nomor || '-',
        item.nama || '-',
        item.dusun || '-',
    ]);

    generatePDF({ title: 'Laporan Data RT/RW', headers, body, desa: 'all', exportConfig, allPerangkat, orientation: 'portrait' });
};

export const generateRekapLembagaPDF = (data, exportConfig, allPerangkat) => {
    const headers = ['No', 'Nama Desa', 'Perangkat', 'BPD', 'LPM', 'PKK', 'Karang Taruna', 'RT/RW'];

    const body = data.map((item, index) => [
        index + 1,
        item.desa,
        item.perangkat || 0,
        item.bpd || 0,
        item.lpm || 0,
        item.pkk || 0,
        item.karang_taruna || 0,
        item.rt_rw || 0,
    ]);
    
    generatePDF({ title: 'Laporan Rekapitulasi Jumlah Kelembagaan', headers, body, desa: 'all', exportConfig, allPerangkat });
};

