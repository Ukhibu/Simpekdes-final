import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, writeBatch, getDocs, getDoc, query, where, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useNotification } from '../context/NotificationContext';

import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import ConfirmationModal from '../components/common/ConfirmationModal';
import MapPicker from '../components/aset/MapPicker';
import { FiEdit, FiTrash2, FiSearch, FiFilter, FiPlus, FiUpload, FiDownload, FiEye, FiMapPin, FiCheckSquare, FiX, FiMove } from 'react-icons/fi';
import { KATEGORI_ASET, KONDISI_ASET, DESA_LIST } from '../utils/constants';
// IMPORT GENERATOR BARU
import { generateAsetPDF } from '../utils/generateAsetPDF';

const AsetDetailView = ({ aset }) => {
    if (!aset) return null;
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('id-ID');
    };
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{aset.namaAset}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p><strong className="font-semibold">Kategori:</strong> {aset.kategori}</p>
                <p><strong className="font-semibold">Kode Barang:</strong> {aset.kodeBarang}</p>
                <p><strong className="font-semibold">Tanggal Perolehan:</strong> {formatDate(aset.tanggalPerolehan)}</p>
                <p><strong className="font-semibold">Nilai Aset (Rp):</strong> {Number(aset.nilaiAset).toLocaleString('id-ID')}</p>
                <p><strong className="font-semibold">Kondisi:</strong> {aset.kondisi}</p>
                <p><strong className="font-semibold">Lokasi Fisik:</strong> {aset.lokasiFisik}</p>
                {aset.latitude && aset.longitude && <p><strong className="font-semibold">Koordinat:</strong> {parseFloat(aset.latitude).toFixed(6)}, {parseFloat(aset.longitude).toFixed(6)}</p>}
            </div>
            {aset.latitude && aset.longitude && (
                <div>
                    <h4 className="font-semibold mb-2">Lokasi di Peta</h4>
                    <div className="h-48 rounded-lg overflow-hidden">
                       <MapPicker initialPosition={[aset.latitude, aset.longitude]} viewOnly={true} />
                    </div>
                </div>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 pt-2 border-t dark:border-gray-700">
                <strong className="font-semibold">Keterangan:</strong> {aset.keterangan || '-'}
            </p>
        </div>
    );
};

const AsetDesa = () => {
    const { currentUser } = useAuth();
    const { data: allAset, loading, addItem, updateItem, deleteItem } = useFirestoreCollection('aset');
    const { showNotification } = useNotification();
    
    // State Data & Form
    const [modalMode, setModalMode] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAset, setSelectedAset] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State Hapus Single
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    
    // State Filter & Search
    const [filters, setFilters] = useState({ searchTerm: '', kategori: 'all', desa: 'all' });
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // State Ekspor & Config & Data Perangkat (Untuk Tanda Tangan)
    const [exportConfig, setExportConfig] = useState(null);
    const [allPerangkat, setAllPerangkat] = useState([]);

    // --- STATE CLICK BOOK & SELECTION ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    
    // --- REFS UNTUK GESTURE CONTROL (Scroll Detection) ---
    const longPressTimer = useRef(null);
    const isScrolling = useRef(false);
    const touchStartCoords = useRef({ x: 0, y: 0 });

    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
    
    // --- DRAGGABLE STATE (SMOOTH VERSION) ---
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });

    // Initial Load: Config & Perangkat (untuk tanda tangan ekspor)
    useEffect(() => {
        const fetchBaseData = async () => {
            try {
                // 1. Ambil Config Camat
                const configSnap = await getDoc(doc(db, 'settings', 'exportConfig'));
                if (configSnap.exists()) setExportConfig(configSnap.data());

                // 2. Ambil Semua Perangkat (Untuk cari Kades nanti saat ekspor per desa)
                const perangkatSnap = await getDocs(collection(db, 'perangkat'));
                setAllPerangkat(perangkatSnap.docs.map(d => d.data()));
            } catch (err) {
                console.error("Error fetching base data:", err);
            }
        };
        fetchBaseData();
    }, []);

    useEffect(() => {
        if (currentUser.role === 'admin_desa') {
            setFilters(prev => ({ ...prev, desa: currentUser.desa }));
        }
    }, [currentUser]);

    // Initial Menu Position (Bottom Center)
    useEffect(() => {
        if (isSelectionMode) {
             // Offset X dikurangi agar pas di tengah (asumsi lebar popup ~220px)
             setMenuPos({ 
                x: window.innerWidth / 2 - 110, 
                y: window.innerHeight - 120 
            });
        }
    }, [isSelectionMode]);

    // Auto Open Modal dari URL
    useEffect(() => {
        const viewId = searchParams.get('view');
        const editId = searchParams.get('edit');
        const assetId = viewId || editId;

        if (assetId && allAset.length > 0) {
            const asetToShow = allAset.find(a => a.id === assetId);
            if (asetToShow) {
                const mode = viewId ? 'view' : 'edit';
                handleOpenModal(asetToShow, mode);
                setSearchParams({}, { replace: true });
            }
        }
    }, [allAset, searchParams, setSearchParams]);

    // --- FORM HANDLERS ---
    const handleOpenModal = (aset = null, mode = 'add') => {
        setModalMode(mode);
        setSelectedAset(aset);
        setFormData(aset || { desa: currentUser.role === 'admin_desa' ? currentUser.desa : filters.desa !== 'all' ? filters.desa : '', kondisi: 'Baik' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if(isSubmitting) return;
        setIsModalOpen(false);
        setSelectedAset(null);
        setFormData({});
    };
    
    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLocationChange = useCallback((location) => {
        setFormData(prev => ({
            ...prev,
            latitude: location.lat,
            longitude: location.lng
        }));
    }, []);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (selectedAset) {
                await updateItem(selectedAset.id, formData);
                showNotification('Aset berhasil diperbarui', 'success');
            } else {
                await addItem(formData);
                showNotification('Aset berhasil ditambahkan', 'success');
            }
            handleCloseModal();
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- FILTER & DATA ---
    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const filteredAset = useMemo(() => {
        return allAset.filter(aset => {
            const searchTermMatch = aset.namaAset.toLowerCase().includes(filters.searchTerm.toLowerCase());
            const kategoriMatch = filters.kategori === 'all' || aset.kategori === filters.kategori;
            const desaMatch = currentUser.role === 'admin_kecamatan'
                ? (filters.desa === 'all' || aset.desa === filters.desa)
                : aset.desa === currentUser.desa;
            return searchTermMatch && kategoriMatch && desaMatch;
        });
    }, [allAset, filters, currentUser]);

    // --- LOGIKA SELEKSI (CLICK BOOK) & GESTURE ---
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
            if (!isScrolling.current) {
                activateSelectionMode(id);
            }
        }, 600);
    };

    const handleTouchMove = (e) => {
        const moveX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
        const moveY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);
        if (moveX > 10 || moveY > 10) {
            isScrolling.current = true;
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const toggleSelection = (id) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
        setSelectedIds(newSelection);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredAset.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAset.map(p => p.id)));
        }
    };

    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
        setMenuPos({ x: 0, y: 0 });
    };

    const toggleSelectionMode = () => {
        isSelectionMode ? cancelSelectionMode() : setIsSelectionMode(true);
    };

    // --- DRAGGABLE POPUP ---
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

    // --- DELETE LOGIC ---
    const confirmDelete = (item) => {
        setItemToDelete(item);
        setIsDeleteConfirmOpen(true);
    };
    
    const executeDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteItem(itemToDelete.id);
            showNotification('Aset berhasil dihapus', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    const executeBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, 'aset', id));
            });
            await batch.commit();
            showNotification(`${selectedIds.size} aset berhasil dihapus.`, 'success');
            cancelSelectionMode();
        } catch (error) {
            showNotification(`Gagal menghapus: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsBulkDeleteConfirmOpen(false);
        }
    };

    // --- EXPORT PDF LOGIC ---
    const handleExportPDF = () => {
        if (filteredAset.length === 0) {
            showNotification("Tidak ada data untuk diekspor.", "warning");
            return;
        }

        // Tentukan desa yang akan diekspor
        // Jika filterDesa == 'all', maka kirim 'all' ke generator untuk trigger grouping
        const exportDesa = filters.desa;

        generateAsetPDF(filteredAset, exportDesa, exportConfig, allPerangkat);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md pb-24">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <InputField name="searchTerm" placeholder="Cari nama aset..." value={filters.searchTerm} onChange={handleFilterChange} icon={<FiSearch />} />
                <InputField name="kategori" type="select" value={filters.kategori} onChange={handleFilterChange}>
                    <option value="all">Semua Kategori</option>
                    {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                </InputField>
                {currentUser.role === 'admin_kecamatan' && (
                    <InputField name="desa" type="select" value={filters.desa} onChange={handleFilterChange}>
                        <option value="all">Semua Desa</option>
                        {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                    </InputField>
                )}
                <div className="flex gap-2">
                    <button onClick={handleExportPDF} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                        <FiDownload /> PDF
                    </button>
                    <button onClick={() => handleOpenModal(null, 'add')} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                        <FiPlus /> Tambah
                    </button>
                </div>
            </div>
            
            <div className="overflow-x-auto min-h-[400px]">
                {loading ? <Spinner /> : (
                    <table className="w-full text-sm">
                         <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-4 w-12">
                                    {isSelectionMode ? (
                                        <div onClick={handleSelectAll} className="cursor-pointer flex justify-center">
                                            {filteredAset.length > 0 && filteredAset.every(p => selectedIds.has(p.id)) ? 
                                                <FiCheckSquare className="text-blue-600" size={18} /> : 
                                                <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                                            }
                                        </div>
                                    ) : 'No'}
                                </th>
                                <th className="px-6 py-3">Nama Aset</th>
                                <th className="px-6 py-3">Kategori</th>
                                {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                                <th className="px-6 py-3">Nilai (Rp)</th>
                                <th className="px-6 py-3">Kondisi</th>
                                <th className="px-6 py-3">Lokasi</th>
                                <th className="px-6 py-3">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAset.length > 0 ? filteredAset.map((aset, index) => {
                                const isSelected = selectedIds.has(aset.id);
                                return (
                                    <tr 
                                        key={aset.id} 
                                        className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer select-none ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                                        onDoubleClick={() => handleDoubleClick(aset.id)}
                                        onTouchStart={(e) => handleTouchStart(aset.id, e)}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                        onClick={(e) => isSelectionMode && !e.target.closest('button') && toggleSelection(aset.id)}
                                    >
                                        <td className="p-4 text-center">
                                            {isSelectionMode ? (
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white'}`}>
                                                    {isSelected && <FiCheckSquare className="text-white w-3 h-3" />}
                                                </div>
                                            ) : index + 1}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {aset.namaAset}
                                            <div className="text-xs text-gray-500">{aset.kodeBarang}</div>
                                        </td>
                                        <td className="px-6 py-4">{aset.kategori}</td>
                                        {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{aset.desa}</td>}
                                        <td className="px-6 py-4 text-right">{Number(aset.nilaiAset).toLocaleString('id-ID')}</td>
                                        <td className="px-6 py-4">{aset.kondisi}</td>
                                        <td className="px-6 py-4 text-center">
                                            {aset.latitude && <FiMapPin className="text-green-500 mx-auto" title={`Lat: ${aset.latitude}, Lng: ${aset.longitude}`} />}
                                        </td>
                                        <td className="px-6 py-4 flex space-x-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(aset, 'view'); }} className="text-gray-500 hover:text-gray-700"><FiEye size={18} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(aset, 'edit'); }} className="text-blue-600 hover:text-blue-800"><FiEdit size={18} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); confirmDelete(aset); }} className="text-red-600 hover:text-red-800"><FiTrash2 size={18} /></button>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr><td colSpan="8" className="text-center py-10 text-gray-500">Tidak ada data aset.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ACTION POPUP (Pill Shape & Draggable) */}
            {isSelectionMode && (
                <div 
                    className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 z-50 animate-bounce-in transition-transform cursor-move select-none"
                    style={{ 
                        left: `${menuPos.x}px`, 
                        top: `${menuPos.y}px`,
                        touchAction: 'none' 
                    }}
                >
                    {/* Drag Handle */}
                    <div 
                         onMouseDown={startDrag}
                         onTouchStart={startDrag}
                         className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full cursor-move transition-colors group"
                    >
                        <FiMove className="text-gray-500 dark:text-gray-400 group-hover:text-blue-500" />
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                    </div>

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

                    {/* Actions */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsBulkDeleteConfirmOpen(true); }} 
                        disabled={selectedIds.size === 0} 
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Hapus Terpilih"
                    >
                        <FiTrash2 size={20} />
                    </button>
                    
                    <button 
                        onClick={(e) => { e.stopPropagation(); cancelSelectionMode(); }} 
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all active:scale-95"
                        title="Batal"
                    >
                        <FiX size={20} />
                    </button>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'add' ? 'Tambah Aset' : (modalMode === 'edit' ? 'Edit Aset' : 'Detail Aset')}>
                {modalMode === 'view' ? <AsetDetailView aset={selectedAset} /> : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Nama Aset" name="namaAset" value={formData.namaAset || ''} onChange={handleFormChange} required />
                            <InputField label="Kategori" name="kategori" type="select" value={formData.kategori || ''} onChange={handleFormChange} required>
                                <option value="">Pilih Kategori</option>
                                {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                            </InputField>
                            <InputField label="Kode Barang" name="kodeBarang" value={formData.kodeBarang || ''} onChange={handleFormChange} />
                            <InputField label="Tanggal Perolehan" name="tanggalPerolehan" type="date" value={formData.tanggalPerolehan || ''} onChange={handleFormChange} />
                            <InputField label="Nilai Aset (Rp)" name="nilaiAset" type="number" value={formData.nilaiAset || ''} onChange={handleFormChange} />
                            <InputField label="Kondisi" name="kondisi" type="select" value={formData.kondisi || ''} onChange={handleFormChange}>
                                {KONDISI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                            </InputField>
                            {currentUser.role === 'admin_kecamatan' && (
                                <InputField label="Desa" name="desa" type="select" value={formData.desa || ''} onChange={handleFormChange} required>
                                    <option value="">Pilih Desa</option>
                                    {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                                </InputField>
                            )}
                             <InputField label="Lokasi Fisik (Gedung/Ruangan)" name="lokasiFisik" value={formData.lokasiFisik || ''} onChange={handleFormChange} />
                        </div>
                        <InputField label="Keterangan" name="keterangan" type="textarea" value={formData.keterangan || ''} onChange={handleFormChange} />
                        
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi Aset di Peta</label>
                            <MapPicker
                                key={selectedAset ? selectedAset.id : 'new'}
                                initialPosition={
                                    formData.latitude && formData.longitude
                                        ? [formData.latitude, formData.longitude]
                                        : null
                                }
                                onLocationChange={handleLocationChange}
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md mr-2">Batal</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center">
                                {isSubmitting && <Spinner size="sm" />}
                                Simpan
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={executeDelete} isLoading={isSubmitting} title="Konfirmasi Hapus" message={`Yakin ingin menghapus aset ${itemToDelete?.namaAset}?`} />
            
            <ConfirmationModal 
                isOpen={isBulkDeleteConfirmOpen} 
                onClose={() => setIsBulkDeleteConfirmOpen(false)} 
                onConfirm={executeBulkDelete} 
                isLoading={isSubmitting} 
                title="Hapus Massal" 
                message={`Yakin ingin menghapus ${selectedIds.size} aset terpilih?`} 
                variant="danger"
            />
        </div>
    );
};

export default AsetDesa;