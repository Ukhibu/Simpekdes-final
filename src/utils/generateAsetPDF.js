import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Helper Functions ---
const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
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

export const generateAsetPDF = (data, desa, exportConfig, allPerangkat) => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // --- 1. Header Dokumen ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN INVENTARIS ASET DESA', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const subTitle = desa === 'all' ? 'KECAMATAN PUNGGELAN' : `PEMERINTAH DESA ${desa.toUpperCase()}`;
    doc.text(subTitle, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Tanggal Cetak: ${formatDate(new Date())}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

    // --- 2. Persiapan Data Tabel ---
    const headers = [[
        'No', 
        'Nama Aset', 
        'Kategori', 
        'Kode Barang', 
        'Tgl Perolehan', 
        'Nilai Aset', 
        'Kondisi', 
        'Lokasi Fisik', 
        'Koordinat (Lat, Long)'
    ]];

    let body = [];

    if (desa === 'all') {
        // --- LOGIKA GROUPING PER DESA (ADMIN KECAMATAN - SEMUA DESA) ---
        
        // 1. Grouping
        const grouped = data.reduce((acc, item) => {
            const d = item.desa || 'Lainnya';
            if (!acc[d]) acc[d] = [];
            acc[d].push(item);
            return acc;
        }, {});

        // 2. Sorting Nama Desa
        const sortedDesaKeys = Object.keys(grouped).sort();

        // 3. Flattening untuk AutoTable
        sortedDesaKeys.forEach(desaKey => {
            // Baris Header Desa (Biru Muda)
            body.push([
                { 
                    content: `DESA ${desaKey.toUpperCase()}`, 
                    colSpan: 9, 
                    styles: { fillColor: [220, 230, 241], fontStyle: 'bold', halign: 'left' } 
                }
            ]);

            // Item Aset
            grouped[desaKey].forEach((item, index) => {
                const coords = item.latitude && item.longitude 
                    ? `${parseFloat(item.latitude).toFixed(5)}, ${parseFloat(item.longitude).toFixed(5)}` 
                    : '-';
                
                body.push([
                    index + 1,
                    item.namaAset || '-',
                    item.kategori || '-',
                    item.kodeBarang || '-',
                    safeFormatDate(item.tanggalPerolehan),
                    formatCurrency(Number(item.nilaiAset)),
                    item.kondisi || '-',
                    item.lokasiFisik || '-',
                    coords
                ]);
            });
        });

    } else {
        // --- LOGIKA SATU DESA (ADMIN DESA / FILTER) ---
        body = data.map((item, index) => {
            const coords = item.latitude && item.longitude 
                ? `${parseFloat(item.latitude).toFixed(5)}, ${parseFloat(item.longitude).toFixed(5)}` 
                : '-';

            return [
                index + 1,
                item.namaAset || '-',
                item.kategori || '-',
                item.kodeBarang || '-',
                safeFormatDate(item.tanggalPerolehan),
                formatCurrency(Number(item.nilaiAset)),
                item.kondisi || '-',
                item.lokasiFisik || '-',
                coords
            ];
        });
    }

    // --- 3. Render Tabel ---
    autoTable(doc, {
        head: headers,
        body: body,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 }, // No
            5: { halign: 'right' }, // Nilai
            8: { fontStyle: 'italic', fontSize: 7 } // Koordinat
        },
        didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.text(`Halaman ${data.pageNumber}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        }
    });

    // --- 4. Logika Penandatanganan ---
    const finalY = doc.lastAutoTable.finalY;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    let signer = {
        location: 'Punggelan',
        jabatan: '',
        nama: '',
        nip: ''
    };

    if (desa === 'all') {
        // Tanda Tangan CAMAT (ExportConfig)
        signer = {
            location: 'Punggelan',
            jabatan: exportConfig?.jabatanPenandaTangan || 'CAMAT PUNGGELAN',
            nama: exportConfig?.namaPenandaTangan || '(..................)',
            nip: exportConfig?.nipPenandaTangan ? `NIP. ${exportConfig.nipPenandaTangan}` : ''
        };
    } else {
        // Tanda Tangan KEPALA DESA (Cari di allPerangkat)
        const kades = allPerangkat.find(p => 
            p.desa.toLowerCase() === desa.toLowerCase() && 
            (p.jabatan.toLowerCase().includes('kepala desa') || p.jabatan.toLowerCase().includes('pj. kepala desa'))
        );

        signer = {
            location: desa, // Lokasi sesuai nama desa
            jabatan: `KEPALA DESA ${desa.toUpperCase()}`,
            nama: kades ? kades.nama.toUpperCase() : '(..................)',
            nip: kades && kades.nip ? `NIP. ${kades.nip}` : '' // Opsional jika Kades punya NIP
        };
    }

    // Cek sisa ruang halaman
    let startY_signature = finalY + 15;
    if (startY_signature + 40 > pageHeight) {
        doc.addPage();
        startY_signature = 40;
    }
    
    const signatureX = pageWidth - 70;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${signer.location}, ${formatDate(new Date())}`, signatureX, startY_signature, { align: 'center' });
    
    doc.text(signer.jabatan, signatureX, startY_signature + 5, { align: 'center' });
    
    // Space Tanda Tangan
    doc.setFont('helvetica', 'bold');
    doc.text(signer.nama, signatureX, startY_signature + 25, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    if (signer.nip) {
        doc.text(signer.nip, signatureX, startY_signature + 30, { align: 'center' });
    }

    // Save PDF
    const fileName = desa === 'all' ? 'Laporan_Aset_Kecamatan_Punggelan.pdf' : `Laporan_Aset_Desa_${desa}.pdf`;
    doc.save(fileName);
};