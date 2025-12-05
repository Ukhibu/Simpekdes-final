import React, { useRef, useEffect, memo } from 'react';

const BeritaAcaraPreview = memo(({ config, bpd, content, onContentChange }) => {
    const contentRef = useRef(null);

    // Sinkronisasi konten saat template/data berubah
    useEffect(() => {
        if (contentRef.current && content !== contentRef.current.innerText) {
            contentRef.current.innerText = content;
        }
    }, [content]);

    // Mencegah paste format HTML yang merusak layout
    const handlePaste = (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    // Helper untuk format nama
    const formatName = (nama, gelar) => {
        if (!nama) return '..........................';
        return `${nama}${gelar ? `, ${gelar}` : ''}`;
    };

    const namaBpd = formatName(bpd?.nama, bpd?.gelar);
    const namaPejabat = formatName(config?.pejabatNama, config?.pejabatGelar);
    const namaSaksi1 = formatName(config?.saksi1Nama, config?.saksi1Gelar);
    const namaSaksi2 = formatName(config?.saksi2Nama, config?.saksi2Gelar);

    return (
        // Wrapper ini adalah area aman di dalam bingkai
        <div className="ba-safe-area">
            
            {/* 1. KOP & JUDUL */}
            <div className="doc-header">
                <p className="font-bold text-lg">BERITA ACARA</p>
                <p className="font-bold text-md">PENGAMBILAN SUMPAH JABATAN ANGGOTA BPD</p>
                <p className="font-bold uppercase">DESA {bpd?.desa || '.......'}</p>
                <div className="header-line"></div>
                <p>NOMOR : {config?.nomor || '.......'}</p>
            </div>

            {/* 2. ISI KONTEN (Flexible Height) */}
            <div className="doc-body-wrapper">
                <div 
                    ref={contentRef}
                    className="doc-content"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={onContentChange} 
                    onPaste={handlePaste}
                />
            </div>

            {/* 3. AREA TANDA TANGAN (Fixed at Bottom of Safe Area) */}
            <div className="doc-footer">
                {/* Tanda Tangan Utama */}
                <table className="signature-table">
                    <tbody>
                        <tr>
                            <td className="signature-cell left">
                                <p>Yang Mengangkat Sumpah,</p>
                                <p className="mb-spacer">Anggota BPD</p>
                                <p className="font-bold underline">{namaBpd}</p>
                            </td>
                            <td className="signature-cell right">
                                <p>Yang Mengambil Sumpah,</p>
                                <p className="mb-spacer">{config?.pejabatJabatan || 'Camat'}</p>
                                <p className="font-bold underline">{namaPejabat}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
                
                {/* Saksi-Saksi */}
                <div className="witness-title">SAKSI - SAKSI</div>
                <table className="signature-table">
                    <tbody>
                        <tr>
                            <td className="signature-cell left">
                                
                                <div className="sign-gap"></div>
                                <p className="font-bold underline">{namaSaksi1}</p>
                            </td>
                            <td className="signature-cell right">
                                
                                <div className="sign-gap"></div>
                                <p className="font-bold underline">{namaSaksi2}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
});

export default BeritaAcaraPreview;