import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, writeBatch, getDocs, collection, query, where, deleteDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import SkeletonLoader from '../components/common/SkeletonLoader';
import { 
    FiEdit, FiSearch, FiUpload, FiDownload, FiPlus, FiEye, FiUserX, FiTrash2, 
    FiBriefcase, FiCheckSquare, FiX, FiArchive, FiAlertCircle, FiMove, FiMapPin, 
    FiPhone, FiCalendar, FiAward, FiChevronDown, FiFilter, FiMaximize2, FiImage,
    FiUser, FiFileText, FiCamera, FiCheckCircle, FiClock
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { generatePerangkatXLSX } from '../utils/generatePerangkatXLSX';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { uploadImageToCloudinary } from '../utils/imageUploader';
import { DESA_LIST } from '../utils/constants';
import Pagination from '../components/common/Pagination';
import { createNotificationForAdmins } from '../utils/notificationService';
import { checkAndProcessPurnaTugas } from '../utils/purnaTugasChecker';

const JABATAN_LIST = [ "Kepala Desa", "Pj. Kepala Desa", "Sekretaris Desa", "Kasi Pemerintahan", "Kasi Kesejahteraan", "Kasi Pelayanan", "Kaur TU dan Umum", "Kaur Keuangan", "Kaur Perencanaan", "Kadus I","Kadus II","Kadus III" ,"Kadus IV","Kadus V","Kadus VI","Staf Desa" ];
const PENDIDIKAN_LIST = ["SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"];

// --- Helper Functions ---
const formatDateToYYYYMMDD = (date) => {
    if (!date || isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseAndFormatDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return formatDateToYYYYMMDD(value);
    if (typeof value === 'number') {
        const utc_days = Math.floor(value - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        return formatDateToYYYYMMDD(date_info);
    }
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
        return formatDateToYYYYMMDD(date);
    }
    return null;
};

const calculateAutomaticRetirement = (tglLahir, tglSk) => {
    const birthStr = parseAndFormatDate(tglLahir);
    const skStr = parseAndFormatDate(tglSk);
    if (!birthStr || !skStr) return null;
    try {
        const birthDate = new Date(birthStr);
        const skDate = new Date(skStr);
        const skYear = skDate.getFullYear();
        let retirementAge = 60; 
        if (skYear < 2020) {
            retirementAge = 65;
        } 
        const retirementDate = new Date(birthDate);
        retirementDate.setFullYear(birthDate.getFullYear() + retirementAge);
        return formatDateToYYYYMMDD(retirementDate);
    } catch (error) {
        console.error("Error calculating retirement:", error);
        return null;
    }
};

// --- ULTRA MODERN GLOWING STATUS BADGE ---
const StatusBadge = ({ perangkat }) => {
    const isPurna = perangkat.akhir_jabatan && new Date(perangkat.akhir_jabatan) < new Date();
    const isKosong = !perangkat.nama && !perangkat.nik;
    
    const isDataLengkap = () => {
        if (!perangkat.nama && !perangkat.nik) return false;
        const requiredFields = [ 'nama', 'jabatan', 'nik', 'tempat_lahir', 'tgl_lahir', 'pendidikan', 'no_sk', 'tgl_sk', 'tgl_pelantikan', 'foto_url', 'ktp_url' ];
        return requiredFields.every(field => perangkat[field] && String(perangkat[field]).trim() !== '');
    };
    const isLengkap = isDataLengkap();

    // Base Style for Glassmorphism & Shape
    const baseStyle = "relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all duration-300 backdrop-blur-md shadow-lg group-hover:scale-105 select-none";

    // 1. PURNA TUGAS (Critical/Red)
    if (isPurna) {
        return (
            <div className={`${baseStyle} bg-rose-500/10 dark:bg-rose-900/30 border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-rose-500/20 hover:shadow-rose-500/40 hover:border-rose-500/60`}>
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                </span>
                <span className="drop-shadow-sm">Purna Tugas</span>
            </div>
        );
    }

    // 2. KOSONG (Void/Slate - Breathing Effect)
    if (isKosong) {
        return (
            <div className={`${baseStyle} bg-slate-200/50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 border-dashed text-slate-600 dark:text-slate-400 shadow-slate-500/10 hover:shadow-slate-500/30 animate-pulse-slow`}>
                 <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-50 delay-700"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                </span>
                <span className="drop-shadow-sm">Kosong</span>
            </div>
        );
    }

    // 3. LENGKAP (Success/Emerald - Steady Glow)
    if (isLengkap) {
        return (
            <div className={`${baseStyle} bg-emerald-500/10 dark:bg-emerald-900/30 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/20 hover:shadow-emerald-500/50 hover:border-emerald-500/60`}>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent -translate-x-full group-hover:animate-shimmer overflow-hidden"></div>
                <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.6)]" />
                <span className="drop-shadow-sm">Lengkap</span>
            </div>
        );
    }

    // 4. BELUM LENGKAP (Warning/Amber - Pulsing)
    return (
        <div className={`${baseStyle} bg-amber-500/10 dark:bg-amber-900/30 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-amber-500/20 hover:shadow-amber-500/40 hover:border-amber-500/60`}>
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 duration-1000"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
            </span>
            <span className="drop-shadow-sm">Belum Lengkap</span>
        </div>
    );
};

// --- Image Preview Modal Component ---
const ImagePreviewOverlay = ({ src, alt, onClose }) => {
    if (!src) return null;
    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <button onClick={onClose} className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-sm z-50">
                <FiX size={28} />
            </button>
            <img 
                src={src} 
                alt={alt} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-gray-700 animate-in zoom-in-95 duration-300 drop-shadow-[0_0_25px_rgba(255,255,255,0.1)]"
                onClick={(e) => e.stopPropagation()} 
            />
        </div>
    );
};

// --- Modern Detail View Component ---
const PerangkatDetailView = ({ perangkat, onPreviewImage }) => {
    if (!perangkat) return null;
    const statusPurna = perangkat.akhir_jabatan && new Date(perangkat.akhir_jabatan) < new Date();

    const DetailGroup = ({ title, children, icon: Icon }) => (
        <div className="bg-white/50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 backdrop-blur-sm hover:shadow-md transition-all duration-300 group">
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                {Icon && <Icon className="text-blue-500 group-hover:scale-110 transition-transform" />} {title}
            </h4>
            <div className="grid grid-cols-1 gap-y-4">
                {children}
            </div>
        </div>
    );

    const DetailItem = ({ label, value }) => (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline border-b border-dashed border-gray-200 dark:border-gray-700 last:border-0 pb-2 last:pb-0">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{label}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white mt-1 sm:mt-0 text-right">{value || '-'}</span>
        </div>
    );

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});
        } catch { return dateString; }
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Hero Section */}
            <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="h-40 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse-slow"></div>
                </div>
                
                <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row items-end sm:items-center gap-4 -mt-12 sm:-mt-16">
                    <div className="relative group cursor-pointer" onClick={() => onPreviewImage(perangkat.foto_url)}>
                        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-gray-800 shadow-xl overflow-hidden bg-gray-200 relative z-10">
                            <img
                                src={perangkat.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(perangkat.nama)}&background=random`}
                                alt={perangkat.nama}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                        </div>
                        <div className="absolute inset-0 z-20 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[2px]">
                            <FiMaximize2 size={24} />
                        </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left mt-2 sm:mt-16">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{perangkat.nama}</h2>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-sm font-semibold border border-blue-100 dark:border-blue-800">
                                {perangkat.jabatan}
                            </span>
                            <StatusBadge perangkat={perangkat} />
                        </div>
                    </div>
                    
                    <div className="absolute top-4 right-4 hidden sm:block">
                         <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 text-white text-xs font-medium shadow-sm">
                             <FiMapPin /> Desa {perangkat.desa}
                         </div>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DetailGroup title="Informasi Pribadi" icon={FiUser}>
                    <DetailItem label="NIK" value={perangkat.nik} />
                    <DetailItem label="NIP / NIPD" value={perangkat.nip} />
                    <DetailItem label="Jenis Kelamin" value={perangkat.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                    <DetailItem label="Tempat, Tgl Lahir" value={`${perangkat.tempat_lahir || ''}, ${formatDate(perangkat.tgl_lahir)}`} />
                    <DetailItem label="Pendidikan" value={perangkat.pendidikan} />
                    <DetailItem label="Kontak" value={perangkat.no_hp} />
                </DetailGroup>

                <DetailGroup title="Legalitas & Jabatan" icon={FiBriefcase}>
                    <DetailItem label="Nomor SK" value={perangkat.no_sk} />
                    <DetailItem label="Tanggal SK" value={formatDate(perangkat.tgl_sk)} />
                    <DetailItem label="Tgl Pelantikan" value={formatDate(perangkat.tgl_pelantikan)} />
                    <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">Akhir Masa Jabatan</span>
                            <span className="text-sm font-bold text-blue-800 dark:text-blue-200">{formatDate(perangkat.akhir_jabatan)}</span>
                        </div>
                    </div>
                </DetailGroup>
            </div>

            {/* KTP Section */}
            {perangkat.ktp_url && (
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-4">
                        <FiImage className="text-gray-500" /> Dokumen Identitas
                    </h4>
                    <div 
                        className="relative w-full h-48 sm:h-64 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-zoom-in group transition-all hover:border-blue-400"
                        onClick={() => onPreviewImage(perangkat.ktp_url)}
                    >
                        <img src={perangkat.ktp_url} alt="KTP" className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"/>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                            <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-800 px-4 py-2 rounded-full text-xs font-bold shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                Klik untuk memperbesar
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Modern Form Component ---
const ModernInput = ({ label, name, type = "text", value, onChange, placeholder, disabled, required, options, icon: Icon }) => {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                {Icon && <Icon className="text-blue-500" />} {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative group">
                {options ? (
                    <div className="relative">
                        <select 
                            name={name} 
                            value={value || ''} 
                            onChange={onChange} 
                            disabled={disabled}
                            className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-gray-700'}`}
                        >
                            {options.map((opt, idx) => (
                                <option key={idx} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                            <FiChevronDown />
                        </div>
                    </div>
                ) : (
                    <input 
                        type={type} 
                        name={name} 
                        value={value || ''} 
                        onChange={onChange} 
                        placeholder={placeholder}
                        disabled={disabled}
                        className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-100' : 'hover:bg-white dark:hover:bg-gray-700'}`}
                    />
                )}
            </div>
        </div>
    );
};

// --- Mobile Card Component ---
const PerangkatMobileCard = ({ perangkat, isSelected, toggleSelection, isSelectionMode, onOpenModal, onConfirmDelete, highlightClass, onPreviewImage }) => {
    return (
        <div 
            className={`
                relative bg-white dark:bg-gray-800 p-4 rounded-xl border transition-all duration-300 group
                ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700 shadow-sm'}
                ${highlightClass ? 'animate-highlight-pulse' : ''}
            `}
            onClick={() => isSelectionMode && toggleSelection(perangkat.id)}
        >
            {/* Selection Checkbox Overlay */}
            {isSelectionMode && (
                <div className="absolute top-4 right-4 z-10">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                        {isSelected && <FiCheckSquare className="text-white w-4 h-4" />}
                    </div>
                </div>
            )}

            <div className="flex gap-4">
                {/* Avatar with Click to Preview */}
                <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); if(perangkat.foto_url) onPreviewImage(perangkat.foto_url); }}>
                    {!perangkat.nama && !perangkat.nik ? (
                        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 border border-gray-200 dark:border-gray-600 border-dashed">
                            <FiBriefcase size={24} />
                        </div>
                    ) : (
                        <div className="relative group/avatar cursor-pointer">
                            <img 
                                src={perangkat.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(perangkat.nama)}`} 
                                alt={perangkat.nama} 
                                className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-sm transition-transform duration-300 group-hover/avatar:scale-105"
                            />
                             <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]">
                                <FiMaximize2 />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                        {perangkat.nama || <span className="italic text-gray-400 font-normal">Belum terisi</span>}
                    </h3>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{perangkat.jabatan}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        <FiMapPin size={10} /> Desa {perangkat.desa}
                    </p>
                    
                    <div className="mt-3">
                        <StatusBadge perangkat={perangkat} />
                    </div>
                </div>
            </div>

            {!isSelectionMode && (
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onOpenModal(perangkat, 'view'); }} className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors">
                        <FiEye /> Detail
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onOpenModal(perangkat, 'edit'); }} className="p-2 text-gray-500 hover:text-amber-600 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors">
                        <FiEdit /> Edit
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onConfirmDelete(perangkat); }} className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors">
                        <FiTrash2 /> Hapus
                    </button>
                </div>
            )}
        </div>
    );
};

// --- Main Component ---
const Perangkat = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const { data: allPerangkat, loading, addItem, updateItem } = useFirestoreCollection('perangkat', { orderByField: 'nama' });

    useEffect(() => {
        checkAndProcessPurnaTugas().then(({ processed, skipped }) => {
            if (!skipped && processed > 0) {
                showNotification(`${processed} perangkat telah dipindahkan ke riwayat purna tugas.`, 'info');
            }
        });
    }, []);
    
    // Global Image Preview State
    const [globalPreviewImage, setGlobalPreviewImage] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPerangkat, setSelectedPerangkat] = useState(null);
    const [formData, setFormData] = useState({});
    const [fotoProfilFile, setFotoProfilFile] = useState(null);
    const [fotoKtpFile, setFotoKtpFile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [modalMode, setModalMode] = useState('edit');
    const [exportConfig, setExportConfig] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    
    const longPressTimer = useRef(null);
    const isScrolling = useRef(false);
    const touchStartCoords = useRef({ x: 0, y: 0 });

    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
    const [bulkDeleteMode, setBulkDeleteMode] = useState(null); 
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    
    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [highlightedRow, setHighlightedRow] = useState(null);
    
    useEffect(() => {
        if ((modalMode === 'edit' || modalMode === 'add') && formData.jabatan) {
            const normalizedJabatan = formData.jabatan.toLowerCase();
            const isKades = normalizedJabatan.includes('kepala desa') || normalizedJabatan.includes('pj. kepala desa');

            if (!isKades && formData.tgl_lahir && formData.tgl_sk) {
                const calculatedDate = calculateAutomaticRetirement(formData.tgl_lahir, formData.tgl_sk);
                if (calculatedDate && calculatedDate !== formData.akhir_jabatan) {
                    setFormData(prev => ({ ...prev, akhir_jabatan: calculatedDate }));
                }
            }
        }
    }, [formData.tgl_lahir, formData.tgl_sk, formData.jabatan, modalMode]);

    useEffect(() => {
        const highlightId = searchParams.get('highlight');
        if (highlightId && allPerangkat.length > 0) {
            setHighlightedRow(highlightId);
            if (currentUser.role === 'admin_kecamatan') {
                const targetDesa = searchParams.get('desa');
                if (targetDesa) setCurrentDesa(targetDesa);
            }
            setTimeout(() => {
                const element = document.getElementById(`row-${highlightId}`);
                if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
            const timer = setTimeout(() => setHighlightedRow(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, currentUser.role, allPerangkat]);
    
    useEffect(() => {
        if (currentUser && currentUser.role === 'admin_desa') {
            setCurrentDesa(currentUser.desa);
        }
    }, [currentUser]);

    useEffect(() => {
        if (isSelectionMode) setMenuPos({ x: 0, y: 0 });
    }, [isSelectionMode]);

    useEffect(() => {
        const fetchExportConfig = async () => {
            try {
                const exportRef = doc(db, 'settings', 'exportConfig');
                const exportSnap = await getDoc(exportRef);
                if (exportSnap.exists()) setExportConfig(exportSnap.data());
            } catch (error) {
                console.error("Error fetching export config:", error);
            }
        };
        fetchExportConfig();
    }, []);

    useEffect(() => {
        const editId = searchParams.get('edit');
        if (editId && allPerangkat.length > 0) {
            const perangkatToEdit = allPerangkat.find(p => p.id === editId);
            if (perangkatToEdit) {
                handleOpenModal(perangkatToEdit, 'edit');
                navigate(location.pathname, { replace: true });
            }
        }
    }, [allPerangkat, searchParams, navigate, location.pathname]);
    
    const filteredPerangkat = useMemo(() => {
        if (!currentUser) return [];
        let data = allPerangkat;
        
        if (currentUser.role === 'admin_kecamatan') {
            data = data.filter(p => p.desa === currentDesa);
        } else if (currentUser.role === 'admin_desa') {
            data = data.filter(p => p.desa === currentUser.desa);
        }

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            data = data.filter(p => 
                (p.nama && p.nama.toLowerCase().includes(search)) || 
                (p.nip && String(p.nip).includes(search)) ||
                (p.nik && String(p.nik).includes(search))
            );
        }
        return data;
    }, [allPerangkat, searchTerm, currentUser, currentDesa]);

    // ... (Gesture logic remains same)
    const activateSelectionMode = (id) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds(new Set([id]));
            if (navigator.vibrate) navigator.vibrate(50);
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }
    };

    const handleDoubleClick = (id) => activateSelectionMode(id);

    const handleTouchStart = (id, e) => {
        isScrolling.current = false;
        touchStartCoords.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        longPressTimer.current = setTimeout(() => {
            if (!isScrolling.current) activateSelectionMode(id);
        }, 600);
    };

    const handleTouchMove = (e) => {
        const moveX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
        const moveY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);
        if (moveX > 10 || moveY > 10) {
            isScrolling.current = true;
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const toggleSelection = (id) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
        setSelectedIds(newSelection);
    };

    const isAllSelected = filteredPerangkat.length > 0 && filteredPerangkat.every(p => selectedIds.has(p.id));

    const handleSelectAll = () => {
        if (isAllSelected) {
            const newSelection = new Set(selectedIds);
            filteredPerangkat.forEach(p => newSelection.delete(p.id));
            setSelectedIds(newSelection);
        } else {
            const newSelection = new Set(selectedIds);
            filteredPerangkat.forEach(p => newSelection.add(p.id));
            setSelectedIds(newSelection);
        }
    };

    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
        setMenuPos({ x: 0, y: 0 });
    };

    const toggleSelectionMode = () => {
        if (isSelectionMode) cancelSelectionMode();
        else {
            setIsSelectionMode(true);
            setSelectedIds(new Set());
        }
    };

    // --- Draggable Logic ---
    const startDrag = (e) => {
        setIsDragging(true);
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragStartPos.current = { x: clientX - menuPos.x, y: clientY - menuPos.y };
    };

    const onDrag = useCallback((e) => {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setMenuPos({ x: clientX - dragStartPos.current.x, y: clientY - dragStartPos.current.y });
    }, [isDragging]);

    const stopDrag = () => setIsDragging(false);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', onDrag);
            window.addEventListener('mouseup', stopDrag);
            window.addEventListener('touchmove', onDrag, { passive: false });
            window.addEventListener('touchend', stopDrag);
        } else {
            window.removeEventListener('mousemove', onDrag);
            window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', onDrag);
            window.removeEventListener('touchend', stopDrag);
        }
        return () => {
            window.removeEventListener('mousemove', onDrag);
            window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', onDrag);
            window.removeEventListener('touchend', stopDrag);
        };
    }, [isDragging, onDrag]);

    const openBulkDeleteConfirm = (mode) => {
        if (selectedIds.size === 0) return;
        setBulkDeleteMode(mode);
        setIsBulkDeleteConfirmOpen(true);
    };

    const handleOpenModal = (perangkat = null, mode = 'edit') => {
        setModalMode(mode);
        setSelectedPerangkat(perangkat);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : (perangkat ? perangkat.desa : currentDesa);
        let initialFormData = perangkat ? { ...perangkat } : { desa: initialDesa, jabatan: '', pendidikan: '' };
        
        if (perangkat && perangkat.jabatan && !JABATAN_LIST.includes(perangkat.jabatan)) {
            initialFormData.jabatan_custom = perangkat.jabatan;
            initialFormData.jabatan = 'Lainnya';
        } else {
            initialFormData.jabatan_custom = '';
        }
        if (perangkat && perangkat.pendidikan && !PENDIDIKAN_LIST.includes(perangkat.pendidikan)) {
            initialFormData.pendidikan_custom = perangkat.pendidikan;
            initialFormData.pendidikan = 'Lainnya';
        } else {
            initialFormData.pendidikan_custom = '';
        }
        setFormData(initialFormData);
        setFotoProfilFile(null);
        setFotoKtpFile(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setSelectedPerangkat(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        let dataToSave = { ...formData };
        if (!dataToSave.desa) {
            showNotification("Desa wajib diisi!", 'error');
            setIsSubmitting(false);
            return;
        }

        if (dataToSave.jabatan === 'Lainnya') dataToSave.jabatan = dataToSave.jabatan_custom || '';
        delete dataToSave.jabatan_custom;
        if (dataToSave.pendidikan === 'Lainnya') dataToSave.pendidikan = dataToSave.pendidikan_custom || '';
        delete dataToSave.pendidikan_custom;
        
        dataToSave.tgl_lahir = parseAndFormatDate(dataToSave.tgl_lahir);
        dataToSave.tgl_sk = parseAndFormatDate(dataToSave.tgl_sk);
        dataToSave.tgl_pelantikan = parseAndFormatDate(dataToSave.tgl_pelantikan);
        
        const isKades = dataToSave.jabatan && (dataToSave.jabatan.toLowerCase().includes('kepala desa') || dataToSave.jabatan.toLowerCase().includes('pj. kepala desa'));
        if (!isKades && dataToSave.tgl_lahir && dataToSave.tgl_sk) {
             dataToSave.akhir_jabatan = calculateAutomaticRetirement(dataToSave.tgl_lahir, dataToSave.tgl_sk);
        } else {
             dataToSave.akhir_jabatan = parseAndFormatDate(dataToSave.akhir_jabatan);
        }

        try {
            const fotoProfilUrl = await uploadImageToCloudinary(fotoProfilFile, process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET, process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);
            const fotoKtpUrl = await uploadImageToCloudinary(fotoKtpFile, process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET, process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);

            if (fotoProfilUrl) dataToSave.foto_url = fotoProfilUrl;
            if (fotoKtpUrl) dataToSave.ktp_url = fotoKtpUrl;
            
            let docId = selectedPerangkat ? selectedPerangkat.id : null;
            
            if (selectedPerangkat) {
                await updateItem(selectedPerangkat.id, dataToSave);
            } else {
                const existingDoc = await findJabatanKosongAtauPurna(dataToSave.jabatan, dataToSave.desa);
                if (existingDoc) {
                    await updateItem(existingDoc.id, dataToSave);
                    docId = existingDoc.id;
                    showNotification(`Formasi jabatan ${dataToSave.jabatan} yang kosong/purna telah diisi.`, 'info');
                } else {
                    const newDoc = await addItem(dataToSave);
                    docId = newDoc.id;
                }
            }
            
          if (currentUser.role === 'admin_desa' && docId) {
                const action = selectedPerangkat ? 'memperbarui' : 'menambahkan';
                const message = `Admin Desa ${currentUser.desa} telah ${action} data perangkat: "${dataToSave.nama}".`;
                const link = `/app/perangkat?desa=${currentUser.desa}&highlight=${docId}`;
                await createNotificationForAdmins(message, link, currentUser);
            }

            handleCloseModal();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (mode) => {
        // ... (Existing delete logic)
        if (!selectedPerangkat) return;
        setShowDeleteConfirm(false);
        setIsDeleting(true);

        try {
            if (mode === 'kosongkan') {
                const { jabatan, desa } = selectedPerangkat;
                const dataToUpdate = {
                    nama: null, nik: null, jenis_kelamin: null, tempat_lahir: null, tgl_lahir: null,
                    pendidikan: null, no_sk: null, tgl_sk: null, tgl_pelantikan: null,
                    akhir_jabatan: null, no_hp: null, nip: null, foto_url: null, ktp_url: null,
                    jabatan, desa, status: 'Jabatan Kosong'
                };
                await updateItem(selectedPerangkat.id, dataToUpdate);
                showNotification('Data personel telah dikosongkan.', 'info');
            } else if (mode === 'permanen') {
                const docRef = doc(db, 'perangkat', selectedPerangkat.id);
                await deleteDoc(docRef);
                showNotification('Data berhasil dihapus permanen.', 'success');
            }
        } catch (error) {
            showNotification("Terjadi kesalahan saat memproses data.", 'error');
        } finally {
            setIsDeleting(false);
            setSelectedPerangkat(null);
        }
    };
    
    const executeBulkDelete = async () => {
         // ... (Existing bulk delete logic)
        if (selectedIds.size === 0 || !bulkDeleteMode) return;
        setIsDeleting(true);
        try {
            const batch = writeBatch(db);
            for (const id of selectedIds) {
                const docRef = doc(db, 'perangkat', id);
                if (bulkDeleteMode === 'kosongkan') {
                    const perangkat = allPerangkat.find(p => p.id === id);
                    if(perangkat){
                        const dataToUpdate = { nama: null, nik: null, jenis_kelamin: null, tempat_lahir: null, tgl_lahir: null, pendidikan: null, no_sk: null, tgl_sk: null, tgl_pelantikan: null, akhir_jabatan: null, no_hp: null, nip: null, foto_url: null, ktp_url: null, status: 'Jabatan Kosong' };
                        batch.update(docRef, dataToUpdate);
                    }
                } else {
                    batch.delete(docRef);
                }
            }
            await batch.commit();
            showNotification(`${selectedIds.size} data berhasil diproses.`, 'success');
        } catch (error) {
            showNotification("Terjadi kesalahan saat memproses data.", 'error');
        } finally {
            setIsDeleting(false);
            cancelSelectionMode();
            setIsBulkDeleteConfirmOpen(false);
        }
    };

    const handleExportClick = () => {
        if (currentUser.role === 'admin_kecamatan') {
            setIsExportModalOpen(true);
        } else {
            handleExportXLSX('current');
        }
    };

    const handleExportXLSX = (scope) => {
         // ... (Existing export logic)
        setIsExportModalOpen(false);
        let dataToExport;
        let groupedData;

        if (scope === 'all') {
            dataToExport = allPerangkat;
            if (dataToExport.length === 0) {
                showNotification("Tidak ada data untuk diekspor.", "warning");
                return;
            }
            const dataByDesa = dataToExport.reduce((acc, p) => {
                const desa = p.desa || 'Lainnya';
                if (!acc[desa]) acc[desa] = [];
                acc[desa].push(p);
                return acc;
            }, {});
            groupedData = DESA_LIST.map(desa => ({
                desa: desa,
                perangkat: dataByDesa[desa] || []
            }));

        } else { 
            dataToExport = filteredPerangkat;
            if (dataToExport.length === 0) {
                showNotification("Tidak ada data untuk diekspor di desa ini.", "warning");
                return;
            }
            const desaName = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
            groupedData = [{ desa: desaName, perangkat: dataToExport }];
        }

        generatePerangkatXLSX(groupedData, exportConfig);
    };

    const handleFileUpload = (e) => {
         // ... (Existing file upload logic)
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonDataObjects = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null });

                if (jsonDataObjects.length === 0) throw new Error("File Excel tidak valid atau kosong.");
                
                const batch = writeBatch(db);
                let updatedCount = 0;
                let createdCount = 0;
                let skippedCount = 0;
                let duplicates = [];

                const allExistingPerangkat = await getDocs(collection(db, 'perangkat')).then(snap =>
                    snap.docs.map(d => ({id: d.id, ...d.data()}))
                );

                for (const row of jsonDataObjects) {
                    const newDoc = {};
                    newDoc.desa = row['DESA'] ? String(row['DESA']).trim() : null;
                    newDoc.nama = row['N A M A'] ? String(row['N A M A']).trim() : null;
                    newDoc.jabatan = row['JABATAN'] ? String(row['JABATAN']).trim() : null;
                    newDoc.tempat_lahir = row['TEMPAT LAHIR'] || null;
                    newDoc.nik = row['N I K'] ? String(row['N I K']).replace(/\s/g, '') : null;
                    newDoc.nip = row['NIP/NIPD'] || null;
                    newDoc.no_sk = row['NO SK'] || null;
                    newDoc.no_hp = row['No. HP / WA'] || null;
                    newDoc.tgl_lahir = parseAndFormatDate(row['TANGGAL LAHIR']);
                    newDoc.tgl_sk = parseAndFormatDate(row['TANGGAL SK']);
                    newDoc.tgl_pelantikan = parseAndFormatDate(row['TANGGAL PELANTIKAN']);
                    newDoc.jenis_kelamin = row['L'] == 1 ? 'L' : (row['P'] == 1 ? 'P' : null);

                    const pendidikanMap = { 'SD': 'SD', 'SLTP': 'SLTP', 'SLTA': 'SLTA', 'D1': 'D1', 'D2': 'D2', 'D3': 'D3', 'S1': 'S1', 'S2': 'S2', 'S3': 'S3' };
                    newDoc.pendidikan = null;
                    for (const key in pendidikanMap) {
                      if (row[key] == 1) { newDoc.pendidikan = pendidikanMap[key]; break; }
                    }
                    if (!newDoc.nama || !newDoc.jabatan || !newDoc.desa) { skippedCount++; continue; }
                    if (currentUser.role === 'admin_desa' && newDoc.desa.toUpperCase() !== currentUser.desa.toUpperCase()) { skippedCount++; continue; }
                    
                    const isKades = newDoc.jabatan.toLowerCase().includes('kepala desa') || newDoc.jabatan.toLowerCase().includes('pj. kepala desa');
                    if (isKades && row['AKHIR MASA JABATAN']) {
                        newDoc.akhir_jabatan = parseAndFormatDate(row['AKHIR MASA JABATAN']);
                    } else if (newDoc.tgl_lahir && newDoc.tgl_sk) {
                        newDoc.akhir_jabatan = calculateAutomaticRetirement(newDoc.tgl_lahir, newDoc.tgl_sk);
                    } else {
                        newDoc.akhir_jabatan = null;
                    }
                    
                    const existingPerangkatByNik = newDoc.nik ? allExistingPerangkat.find(p => p.nik === newDoc.nik) : null;
                    const existingPerangkatByName = allExistingPerangkat.find(p => p.nama && p.desa && p.nama.toLowerCase() === newDoc.nama.toLowerCase() && p.desa.toLowerCase() === newDoc.desa.toLowerCase());

                    if (existingPerangkatByNik) {
                        const docRef = doc(db, 'perangkat', existingPerangkatByNik.id);
                        batch.update(docRef, newDoc);
                        updatedCount++;
                    } else if (existingPerangkatByName) {
                        duplicates.push(`${newDoc.nama} (Desa ${newDoc.desa})`);
                        skippedCount++;
                    } else {
                        const vacantDoc = await findJabatanKosongAtauPurna(newDoc.jabatan, newDoc.desa);
                        if (vacantDoc) {
                            const docRef = doc(db, 'perangkat', vacantDoc.id);
                            batch.update(docRef, newDoc);
                            updatedCount++;
                        } else {
                            const newDocRef = doc(collection(db, 'perangkat'));
                            batch.set(newDocRef, newDoc);
                            createdCount++;
                        }
                    }
                }
                await batch.commit();
                let alertMessage = `Impor selesai!\n- ${createdCount} data baru ditambahkan.\n- ${updatedCount} data diperbarui.\n- ${skippedCount} baris dilewati.`;
                if (duplicates.length > 0) {
                    alertMessage += `\n\nData duplikat yang dilewati:\n- ${duplicates.join('\n- ')}`;
                }
                showNotification(alertMessage, 'info', 10000);
            } catch (error) {
                console.error("Error processing file:", error);
                showNotification(`Gagal memproses file: ${error.message}`, 'error');
            } finally {
                setIsUploading(false);
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const findJabatanKosongAtauPurna = async (jabatan, desa) => {
         // ... (Existing find vacant logic)
        const q = query(collection(db, 'perangkat'), where("desa", "==", desa), where("jabatan", "==", jabatan));
        const querySnapshot = await getDocs(q);
        let docToUpdate = null;
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const isPurna = data.akhir_jabatan && new Date(data.akhir_jabatan) < new Date();
            const isKosong = !data.nama && !data.nik;
            if (isPurna || isKosong) {
                docToUpdate = { id: doc.id, data: data };
            }
        });
        return docToUpdate;
    };
    
    // Inject Custom Styles
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes highlight-pulse {
                0%, 100% { background-color: rgba(234, 179, 8, 0.1); box-shadow: inset 0 0 0 2px rgba(234, 179, 8, 0.3); }
                50% { background-color: rgba(234, 179, 8, 0.4); box-shadow: inset 0 0 10px 2px rgba(234, 179, 8, 0.6); }
            }
            .animate-highlight-pulse {
                animation: highlight-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            .animate-shimmer {
                animation: shimmer 2s infinite;
            }
            @keyframes pulse-slow {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            .animate-pulse-slow {
                animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    if (loading) return <SkeletonLoader columns={5} />;
    
    return (
        <div className="space-y-6 pb-24">
            {/* Global Image Preview */}
            <ImagePreviewOverlay 
                src={globalPreviewImage} 
                alt="Preview" 
                onClose={() => setGlobalPreviewImage(null)} 
            />

            {/* Header & Controls */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="w-full lg:w-1/3 relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-500">
                            <FiSearch className="text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        </div>
                        <input 
                            type="text" 
                            placeholder={`Cari di Desa ${currentDesa}...`} 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                    
                    <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end items-center">
                         <button 
                            onClick={() => navigate('/app/histori-perangkat')} 
                            className="flex items-center px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 active:scale-95"
                         >
                            <FiArchive className="mr-2" /> Riwayat
                        </button>
                        
                        {isSelectionMode ? (
                            <></> 
                        ) : (
                            <>
                                <button 
                                    onClick={toggleSelectionMode} 
                                    className="flex items-center px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 active:scale-95"
                                >
                                    <FiCheckSquare className="mr-2"/> Pilih
                                </button>
                                
                                <label className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white font-medium rounded-xl hover:from-amber-500 hover:to-amber-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/30 transition-all duration-200 cursor-pointer active:scale-95">
                                    <FiUpload className="mr-2"/> 
                                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" disabled={isUploading}/>
                                    {isUploading ? '...' : 'Impor'}
                                </label>
                                
                                <button 
                                    onClick={handleExportClick} 
                                    className="flex items-center px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-200 active:scale-95"
                                >
                                    <FiDownload className="mr-2"/> Ekspor
                                </button>
                                
                                <button 
                                    onClick={() => handleOpenModal(null, 'add')} 
                                    className="flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 active:scale-95"
                                >
                                    <FiPlus className="mr-2 stroke-[2.5px]"/> Tambah
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {/* MOBILE VIEW (Grid Cards) */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {filteredPerangkat.length > 0 ? filteredPerangkat.map((p) => (
                    <PerangkatMobileCard 
                        key={p.id}
                        perangkat={p}
                        isSelected={selectedIds.has(p.id)}
                        toggleSelection={toggleSelection}
                        isSelectionMode={isSelectionMode}
                        onOpenModal={handleOpenModal}
                        onConfirmDelete={(perangkat) => { setSelectedPerangkat(perangkat); setShowDeleteConfirm(true); }}
                        highlightClass={highlightedRow === p.id}
                        onPreviewImage={setGlobalPreviewImage} // Pass the global setter
                    />
                )) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4"><FiSearch size={32} className="opacity-50" /></div>
                        <p className="text-gray-500">Tidak ada data ditemukan.</p>
                    </div>
                )}
            </div>

            {/* DESKTOP VIEW (Table) */}
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-4 w-16 text-center">
                                    {isSelectionMode ? (
                                        <div onClick={handleSelectAll} className="cursor-pointer flex justify-center items-center hover:scale-110 transition-transform">
                                            {isAllSelected ? (
                                                <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center text-white shadow-md"><FiCheckSquare size={14} /></div>
                                            ) : (
                                                <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700"></div>
                                            )}
                                        </div>
                                    ) : <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">No</span>}
                                </th>
                                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Perangkat Desa</th>
                                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jabatan</th>
                                {currentUser.role === 'admin_kecamatan' && <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Desa</th>}
                                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {filteredPerangkat.length > 0 ? filteredPerangkat.map((p, index) => {
                                const isKosong = !p.nama && !p.nik;
                                const isSelected = selectedIds.has(p.id);
                                const isHighlighted = highlightedRow === p.id;
                                return (
                                    <tr 
                                        key={p.id} id={`row-${p.id}`}
                                        className={`group transition-all duration-300 ${isHighlighted ? 'animate-highlight-pulse z-10 relative' : ''} ${isSelected ? 'bg-blue-50/90 dark:bg-blue-900/40' : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/30'}`}
                                        style={{ animationDelay: `${index * 50}ms` }}
                                        onDoubleClick={() => handleDoubleClick(p.id)}
                                        onClick={(e) => { if (isSelectionMode && !e.target.closest('button')) toggleSelection(p.id); }}
                                    >
                                        <td className="p-4 text-center">
                                            {isSelectionMode ? (
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all mx-auto ${isSelected ? 'bg-blue-600 border-blue-600 scale-110' : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700'}`}>
                                                    {isSelected && <FiCheckSquare className="text-white w-3 h-3" />}
                                                </div>
                                            ) : <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{index + 1}</span>}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-4">
                                                {isKosong ? (
                                                    <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 ring-2 ring-gray-50 dark:ring-gray-800 border-dashed border border-gray-300 dark:border-gray-600"><FiBriefcase size={20} /></div>
                                                ) : (
                                                    <div 
                                                        className="relative group-hover:scale-110 transition-transform duration-300 cursor-zoom-in"
                                                        onClick={(e) => { e.stopPropagation(); if(p.foto_url) setGlobalPreviewImage(p.foto_url); }}
                                                    >
                                                        <img src={p.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nama || 'X')}`} alt={p.nama} className="w-11 h-11 rounded-full object-cover shadow-sm border-2 border-white dark:border-gray-600"/>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">{p.nama || <span className="text-gray-400 italic font-normal">Belum terisi</span>}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{p.nik ? `NIK: ${p.nik}` : '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4"><span className="text-sm text-gray-700 dark:text-gray-300 font-medium bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-full whitespace-nowrap">{p.jabatan}</span></td>
                                        {currentUser.role === 'admin_kecamatan' && <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{p.desa}</td>}
                                        <td className="p-4">
                                            <StatusBadge perangkat={p} />
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end items-center gap-1 sm:gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenModal(p, 'view'); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><FiEye size={18} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenModal(p, 'edit'); }} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><FiEdit size={18} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); setSelectedPerangkat(p); setShowDeleteConfirm(true); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan={currentUser.role === 'admin_kecamatan' ? 6 : 5} className="text-center py-20">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full mb-4"><FiSearch size={40} className="opacity-50" /></div>
                                            <p className="text-base font-medium">Tidak ada data ditemukan untuk Desa {currentDesa}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="text-center mt-4">
                 <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                    <FiAlertCircle size={12}/> 
                    <span>Tip: Klik Foto untuk zoom. Klik 2x baris untuk mode pilih.</span>
                </p>
            </div>

            {currentUser?.role === 'admin_kecamatan' && (
                <div className="mt-8">
                    <Pagination desaList={DESA_LIST} currentDesa={currentDesa} onPageChange={setCurrentDesa} />
                </div>
            )}

            {/* ACTION BAR BAWAH (Floating & Draggable) */}
            {isSelectionMode && (
                <div 
                    className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-bounce-in transition-transform cursor-move select-none backdrop-blur-md bg-white/90 dark:bg-gray-800/90"
                    style={{ left: '50%', bottom: '2rem', transform: `translate(calc(-50% + ${menuPos.x}px), ${menuPos.y}px)`, touchAction: 'none' }}
                    onMouseDown={startDrag} onTouchStart={startDrag}
                >
                    <div className="flex items-center gap-3 text-gray-400 cursor-move hover:text-gray-600 transition-colors"><FiMove /></div>
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg min-w-[1.5rem] text-center shadow-sm">{selectedIds.size}</span>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap hidden sm:inline">Terpilih</span>
                    </div>
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openBulkDeleteConfirm('kosongkan'); }} disabled={selectedIds.size === 0} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50 hover:scale-110 active:scale-95" title="Kosongkan Jabatan" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}><FiUserX size={20} /></button>
                        <button onClick={(e) => { e.stopPropagation(); openBulkDeleteConfirm('permanen'); }} disabled={selectedIds.size === 0} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 hover:scale-110 active:scale-95" title="Hapus Permanen" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}><FiTrash2 size={20} /></button>
                    </div>
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                    <button onClick={(e) => { e.stopPropagation(); cancelSelectionMode(); }} className="p-2 text-gray-400 hover:text-gray-600 transition-colors hover:rotate-90 duration-200" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}><FiX size={20} /></button>
                </div>
            )}

            {/* MODALS */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                title={modalMode === 'view' ? 'Profil Perangkat Desa' : (selectedPerangkat ? 'Edit Data Perangkat' : 'Tambah Data Perangkat')}
            >
                {modalMode === 'view' && selectedPerangkat ? (
                    <PerangkatDetailView perangkat={selectedPerangkat} onPreviewImage={setGlobalPreviewImage} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-6">
                        {/* 1. INFORMASI PRIBADI */}
                        <div className="bg-gray-50/50 dark:bg-gray-700/20 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                             <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Informasi Pribadi</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentUser.role !== 'admin_desa' && (
                                    <ModernInput 
                                        label="Desa" 
                                        name="desa" 
                                        value={formData.desa} 
                                        onChange={handleFormChange} 
                                        options={[{label: 'Pilih Desa', value: ''}, ...DESA_LIST.sort().map(d => ({label: d, value: d}))]}
                                        icon={FiMapPin} required
                                    />
                                )}
                                <ModernInput label="Nama Lengkap" name="nama" value={formData.nama} onChange={handleFormChange} placeholder="Contoh: Budi Santoso" icon={FiUser} required />
                                <ModernInput label="NIK" name="nik" value={formData.nik} onChange={handleFormChange} placeholder="16 digit NIK" icon={FiBriefcase} />
                                <ModernInput label="NIP / NIPD" name="nip" value={formData.nip} onChange={handleFormChange} placeholder="Jika ada" icon={FiBriefcase} />
                                <ModernInput label="Tempat Lahir" name="tempat_lahir" value={formData.tempat_lahir} onChange={handleFormChange} placeholder="Kota Kelahiran" icon={FiMapPin} />
                                <ModernInput label="Tanggal Lahir" name="tgl_lahir" type="date" value={formData.tgl_lahir} onChange={handleFormChange} icon={FiCalendar} />
                                <ModernInput label="Jenis Kelamin" name="jenis_kelamin" value={formData.jenis_kelamin} onChange={handleFormChange} options={[{label: 'Pilih', value: ''}, {label: 'Laki-laki', value: 'L'}, {label: 'Perempuan', value: 'P'}]} icon={FiUser} />
                                <ModernInput label="No. HP / WA" name="no_hp" value={formData.no_hp} onChange={handleFormChange} placeholder="08xxx" icon={FiPhone} />
                                <div className="md:col-span-2">
                                     <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5"><FiAward className="text-blue-500" /> Pendidikan Terakhir</label>
                                     <div className="grid grid-cols-2 gap-2">
                                         <select name="pendidikan" value={formData.pendidikan || ''} onChange={handleFormChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:border-blue-500">
                                            <option value="">Pilih</option>{PENDIDIKAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}<option value="Lainnya">Lainnya...</option>
                                         </select>
                                         {formData.pendidikan === 'Lainnya' && <input type="text" name="pendidikan_custom" value={formData.pendidikan_custom || ''} onChange={handleFormChange} placeholder="Ketik manual..." className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:border-blue-500" />}
                                     </div>
                                </div>
                             </div>
                        </div>

                        {/* 2. JABATAN & LEGALITAS */}
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                            <h4 className="text-xs font-bold text-blue-400 dark:text-blue-500 uppercase tracking-wider mb-4 border-b border-blue-200 dark:border-blue-800 pb-2">Jabatan & Legalitas</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                     <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5"><FiBriefcase className="text-blue-500" /> Jabatan</label>
                                     <div className="grid grid-cols-1 gap-2">
                                         <select name="jabatan" value={formData.jabatan || ''} onChange={handleFormChange} disabled={!!selectedPerangkat && !(!selectedPerangkat.nama && !selectedPerangkat.nik)} className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:border-blue-500">
                                            <option value="">Pilih Jabatan</option>{JABATAN_LIST.map(j => <option key={j} value={j}>{j}</option>)}<option value="Lainnya">Lainnya...</option>
                                         </select>
                                         {formData.jabatan === 'Lainnya' && <input type="text" name="jabatan_custom" value={formData.jabatan_custom || ''} onChange={handleFormChange} placeholder="Nama jabatan..." className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:border-blue-500" disabled={!!selectedPerangkat && !(!selectedPerangkat.nama && !selectedPerangkat.nik)} />}
                                     </div>
                                </div>
                                <ModernInput label="Nomor SK" name="no_sk" value={formData.no_sk} onChange={handleFormChange} placeholder="Nomor Surat Keputusan" icon={FiFileText} />
                                <ModernInput label="Tanggal SK" name="tgl_sk" type="date" value={formData.tgl_sk} onChange={handleFormChange} icon={FiCalendar} />
                                <ModernInput label="Tanggal Pelantikan" name="tgl_pelantikan" type="date" value={formData.tgl_pelantikan} onChange={handleFormChange} icon={FiCalendar} />
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5"><FiCalendar className="text-blue-500" /> Akhir Masa Jabatan</label>
                                    <input type="date" name="akhir_jabatan" value={formData.akhir_jabatan || ''} onChange={handleFormChange} className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400" disabled={!(formData.jabatan && (formData.jabatan.toLowerCase().includes('kepala desa') || formData.jabatan.toLowerCase().includes('pj. kepala desa')))} />
                                    {!(formData.jabatan && (formData.jabatan.toLowerCase().includes('kepala desa') || formData.jabatan.toLowerCase().includes('pj. kepala desa'))) && <span className="text-[10px] text-gray-400 mt-1 block">*Dihitung otomatis (Usia 60/65 Thn)</span>}
                                </div>
                            </div>
                        </div>

                        {/* 3. DOKUMEN FOTO */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="p-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-700/30">
                                 <label className="block text-xs font-bold text-gray-500 uppercase mb-3 text-center">Foto Profil</label>
                                 <div className="flex flex-col items-center gap-3">
                                     {formData.foto_url && <img src={formData.foto_url} alt="Profil" className="w-20 h-20 rounded-full object-cover shadow-md border-2 border-white"/>}
                                     <label className="cursor-pointer bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                                         <FiCamera /> Pilih Foto
                                         <input type="file" onChange={(e) => setFotoProfilFile(e.target.files[0])} accept="image/*" className="hidden"/>
                                     </label>
                                 </div>
                             </div>
                             <div className="p-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-700/30">
                                 <label className="block text-xs font-bold text-gray-500 uppercase mb-3 text-center">Foto KTP</label>
                                 <div className="flex flex-col items-center gap-3">
                                     {formData.ktp_url ? <img src={formData.ktp_url} alt="KTP" className="h-20 w-auto rounded object-cover shadow-sm"/> : <div className="h-20 w-32 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">Belum ada</div>}
                                     <label className="cursor-pointer bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                                         <FiUpload /> Upload KTP
                                         <input type="file" onChange={(e) => setFotoKtpFile(e.target.files[0])} accept="image/*" className="hidden"/>
                                     </label>
                                 </div>
                             </div>
                        </div>

                        <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-gray-700 gap-3">
                            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                            <Button type="submit" variant="primary" isLoading={isSubmitting}>{selectedPerangkat ? 'Simpan Perubahan' : 'Simpan Data'}</Button>
                        </div>
                    </form>
                )}
            </Modal>
            
            {/* ... (Confirmation Modal and Export Modal remain the same) ... */}
            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Konfirmasi Hapus">
                <div className="text-center p-4">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4 animate-bounce">
                        <FiTrash2 className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Hapus Data Perangkat?</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Anda akan menghapus data atas nama <strong className="text-red-600">{selectedPerangkat?.nama}</strong>.
                        <br/>Tindakan ini tidak dapat dibatalkan.
                    </p>
                </div>
                <div className="flex justify-center gap-3 mt-6">
                    <Button onClick={() => handleDelete('kosongkan')} variant="warning" isLoading={isDeleting} className="flex-1 justify-center py-3"><FiUserX className="mr-2"/> Kosongkan</Button>
                    <Button onClick={() => handleDelete('permanen')} variant="danger" isLoading={isDeleting} className="flex-1 justify-center py-3"><FiTrash2 className="mr-2"/> Permanen</Button>
                </div>
            </Modal>

            <ConfirmationModal isOpen={isBulkDeleteConfirmOpen} onClose={() => setIsBulkDeleteConfirmOpen(false)} onConfirm={executeBulkDelete} isLoading={isDeleting} title="Konfirmasi Aksi Massal" message={`Apakah Anda yakin ingin ${bulkDeleteMode === 'kosongkan' ? 'mengosongkan jabatan' : 'menghapus permanen'} untuk ${selectedIds.size} data yang dipilih?`} variant={bulkDeleteMode === 'kosongkan' ? 'warning' : 'danger'} />

            {currentUser.role === 'admin_kecamatan' && (
                 <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Ekspor Data Perangkat">
                    <div className="p-4">
                        <div className="mb-6 flex justify-center"><div className="bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-full ring-8 ring-emerald-50 dark:ring-emerald-900/20"><FiDownload className="text-emerald-600 dark:text-emerald-400 w-8 h-8"/></div></div>
                        <p className="text-center text-gray-600 dark:text-gray-300 mb-8 font-medium">Silakan pilih cakupan data yang ingin Anda unduh dalam format Excel (.xlsx).</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={() => handleExportXLSX('current')} className="p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group relative overflow-hidden">
                                <div className="relative z-10">
                                    <span className="block font-bold text-lg text-gray-800 dark:text-white group-hover:text-blue-600">Desa {currentDesa}</span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 block">Hanya data desa yang sedang aktif.</span>
                                </div>
                            </button>
                            <button onClick={() => handleExportXLSX('all')} className="p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group relative overflow-hidden">
                                <div className="relative z-10">
                                    <span className="block font-bold text-lg text-gray-800 dark:text-white group-hover:text-emerald-600">Semua Desa</span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 block">Rekapitulasi seluruh kecamatan.</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Perangkat;