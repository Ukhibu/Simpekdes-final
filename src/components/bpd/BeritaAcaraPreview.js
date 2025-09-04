import React, { forwardRef } from 'react';

const EditableText = ({ name, value, onChange }) => {
    const style = {
        width: '100%',
        backgroundColor: 'transparent',
        border: '1px dashed rgba(0, 0, 0, 0.2)',
        padding: '4px',
        resize: 'vertical',
        minHeight: '40px',
        lineHeight: '1.5',
        fontFamily: "'Times New Roman', Times, serif",
        color: 'inherit',
    };
    const autoResize = (e) => {
        e.target.style.height = 'inherit';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };
    return (
        <textarea
            name={name}
            value={value}
            onChange={onChange}
            onInput={autoResize}
            style={style}
            rows={15}
        />
    );
};

const BeritaAcaraPreview = forwardRef(({ data, bpd, content, onContentChange, isPrinting = false }, ref) => {
    
    const documentStyle = {
        fontFamily: "'Times New Roman', Times, serif",
        color: 'black',
        lineHeight: '1.5',
    };

    const textCenter = { textAlign: 'center' };
    const textUnderline = { textDecoration: 'underline' };
    const textBold = { fontWeight: 'bold' };

    const renderMainContent = () => {
        if (isPrinting) {
            return <pre style={{ whiteSpace: 'pre-wrap', fontFamily: "'Times New Roman', Times, serif" }}>{content}</pre>;
        }
        return <EditableText name="mainContent" value={content} onChange={onContentChange} />;
    };

    return (
        <div ref={ref} className="bg-white p-8 md:p-12" style={documentStyle}>
            <div style={textCenter}>
                <p style={textBold}>BERITA ACARA</p>
                <p style={textBold}>PENGAMBILAN SUMPAH JABATAN ANGGOTA BADAN PERMUSYAWARATAN DESA AULA KANTOR KECAMATAN PUNGGELAN</p>
                <p>NOMOR : {data?.nomor || '[Nomor Surat]'}</p>
            </div>
            <hr className="border-t-2 border-b-2 border-black my-4" />

            {renderMainContent()}

            <div className="grid grid-cols-2 gap-8 mt-16" style={textCenter}>
                <div>
                    <p>Anggota Badan Permusyawaratan Desa</p><p>Yang mengangkat sumpah,</p>
                    <div className="h-24"></div>
                    <p style={{...textBold, ...textUnderline}}>{bpd?.nama || '[Nama Anggota BPD]'}</p>
                </div>
                <div>
                    <p>Pejabat</p><p>Yang mengambil sumpah</p><p>{data?.pejabatJabatan || '[Jabatan Pejabat]'}</p>
                    <div className="h-24"></div>
                    <p style={{...textBold, ...textUnderline}}>{data?.pejabatNama || '[Nama Pejabat]'}</p>
                </div>
            </div>

            <div style={textCenter} className="mt-12">
                <p style={textBold}>SAKSI - SAKSI</p>
                <div className="grid grid-cols-2 gap-8 mt-4">
                    <div>
                        <div className="h-24"></div>
                        <p style={{...textBold, ...textUnderline}}>{data?.saksi2Nama || '[Nama Saksi 2]'}</p>
                    </div>
                     <div>
                        <div className="h-24"></div>
                        <p style={{...textBold, ...textUnderline}}>{data?.saksi1Nama || '[Nama Saksi 1]'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default BeritaAcaraPreview;

