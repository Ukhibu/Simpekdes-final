import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, writeBatch, getDocs, getDoc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useNotification } from '../context/NotificationContext';
// IMPORT SERVICE NOTIFIKASI
import { createNotificationForAdmins } from '../utils/notificationService';

// --- LEAFLET IMPORTS FOR ADVANCED MAP ---
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Polygon, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import ConfirmationModal from '../components/common/ConfirmationModal';
import MapPicker from '../components/aset/MapPicker'; 
import { 
    FiEdit, FiTrash2, FiSearch, FiFilter, FiPlus, FiDownload, FiEye, 
    FiMapPin, FiCheckSquare, FiX, FiMove, FiMap, FiLayers, 
    FiBox, FiDollarSign, FiActivity, FiAlertCircle 
} from 'react-icons/fi';
import { KATEGORI_ASET, KONDISI_ASET, DESA_LIST } from '../utils/constants';
import { generateAsetPDF } from '../utils/generateAsetPDF';

// --- FIX LEAFLET ICON ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// --- HELPER FORMATTING ---
const formatCurrency = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`;

const formatRupiahKompak = (value) => {
    const num = Number(value);
    if (isNaN(num)) return 'Rp 0';
    if (Math.abs(num) >= 1e9) return `Rp ${(num / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
    if (Math.abs(num) >= 1e6) return `Rp ${(num / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 0 })} Jt`;
    return `Rp ${num.toLocaleString('id-ID')}`;
};

// --- KOMPONEN STAT CARD MODERN ---
const StatCard = ({ title, value, icon, colorClass, subTitle }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4 transition-all hover:scale-[1.02] hover:shadow-md">
        <div className={`p-3 rounded-xl text-white shadow-lg shrink-0 ${colorClass}`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider truncate">{title}</p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</h3>
            {subTitle && <p className="text-xs text-gray-400 mt-1 truncate">{subTitle}</p>}
        </div>
    </div>
);

// --- KOMPONEN PETA INPUT CANGGIH ---
const AdvancedMapInput = ({ initialPosition, onLocationChange, mapConfig }) => {
    const [mapMode, setMapMode] = useState('street'); 
    
    const fallbackCenter = [-7.3948, 109.6432]; 
    const centerToUse = mapConfig?.center || fallbackCenter;
    const boundaryCoords = mapConfig?.boundary || [];
    
    const position = (initialPosition && initialPosition[0] && initialPosition[1]) ? initialPosition : null;

    const LocationSelector = () => {
        const map = useMap();
        useMapEvents({
            click(e) {
                onLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
                map.flyTo(e.latlng, map.getZoom());
            },
        });

        useEffect(() => {
            if (position) {
                map.setView(position, 16);
            } else {
                map.setView(centerToUse, 14);
            }
        }, []); 

        return position ? <Marker position={position} /> : null;
    };

    return (
        <div className="relative w-full h-80 rounded-xl overflow-hidden border border-gray-300 dark:border-gray-600 shadow-sm z-0 group">
             <MapContainer center={centerToUse} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                {mapMode === 'street' ? (
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                ) : (
                  <>
                    <TileLayer attribution='&copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
                  </>
                )}

                {boundaryCoords.length > 0 && (
                    <Polygon 
                        positions={boundaryCoords} 
                        pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: mapMode === 'satellite' ? 0.1 : 0.05, weight: 2, dashArray: '5, 5' }} 
                    >
                        <Tooltip sticky direction="center" className="font-bold text-emerald-700 bg-transparent border-none shadow-none">Wilayah Desa</Tooltip>
                    </Polygon>
                )}
                <LocationSelector />
             </MapContainer>

             <div className="absolute top-3 right-3 z-[400] bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-1 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 flex gap-1">
                 <button type="button" onClick={() => setMapMode('street')} className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded transition-all ${mapMode === 'street' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><FiMap /> Jalan</button>
                 <button type="button" onClick={() => setMapMode('satellite')} className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded transition-all ${mapMode === 'satellite' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><FiLayers /> Satelit</button>
             </div>
             
             {!position && (
                <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm z-[400] pointer-events-none border border-gray-200 dark:border-gray-600 flex items-center gap-1">
                    <FiMapPin className="text-red-500 animate-bounce" /> Klik peta untuk menandai lokasi
                </div>
             )}
        </div>
    );
};

const AsetDetailView = ({ aset }) => {
    if (!aset) return null;
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('id-ID', { dateStyle: 'long' });
    };
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{aset.namaAset}</h3>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {aset.kategori}
                    </span>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nilai Aset</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(aset.nilaiAset)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Kode Barang</p>
                    <p className="font-mono text-gray-800 dark:text-gray-200">{aset.kodeBarang || '-'}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Tanggal Perolehan</p>
                    <p className="text-gray-800 dark:text-gray-200">{formatDate(aset.tanggalPerolehan)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Kondisi</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${aset.kondisi === 'Baik' ? 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300' : 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {aset.kondisi}
                    </span>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Lokasi Fisik</p>
                    <p className="text-gray-800 dark:text-gray-200">{aset.lokasiFisik || '-'}</p>
                </div>
            </div>

            {aset.latitude && aset.longitude && (
                <div>
                    <h4 className="font-semibold mb-2 text-gray-800 dark:text-white flex items-center gap-2"><FiMapPin /> Lokasi di Peta</h4>
                    <div className="h-56 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 shadow-sm">
                        <MapPicker initialPosition={[aset.latitude, aset.longitude]} viewOnly={true} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 font-mono">Lat: {parseFloat(aset.latitude).toFixed(6)}, Lng: {parseFloat(aset.longitude).toFixed(6)}</p>
                </div>
            )}
            
            <div className="border-t dark:border-gray-700 pt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Keterangan Tambahan</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    {aset.keterangan || 'Tidak ada keterangan tambahan.'}
                </p>
            </div>
        </div>
    );
};

const AsetDesa = () => {
    const { currentUser } = useAuth();
    const { data: allAset, loading, addItem, updateItem, deleteItem } = useFirestoreCollection('aset');
    const { showNotification } = useNotification();
    
    // State UI
    const [modalMode, setModalMode] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAset, setSelectedAset] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    
    // Filters
    const [filters, setFilters] = useState({ searchTerm: '', kategori: 'all', desa: 'all' });
    const [searchParams, setSearchParams] = useSearchParams();

    // Data Pendukung
    const [exportConfig, setExportConfig] = useState(null);
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [mapConfig, setMapConfig] = useState({ center: [-7.3948, 109.6432], boundary: [] });

    // Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
    
    // Draggable Menu
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });

    // Gesture Refs
    const longPressTimer = useRef(null);
    const isScrolling = useRef(false);
    const touchStartCoords = useRef({ x: 0, y: 0 });

    // Initial Load
    useEffect(() => {
        const fetchBaseData = async () => {
            try {
                const [configSnap, perangkatSnap, mapConfigSnap] = await Promise.all([
                    getDoc(doc(db, 'settings', 'exportConfig')),
                    getDocs(collection(db, 'perangkat')),
                    getDoc(doc(db, 'settings', 'peta_wilayah_config'))
                ]);

                if (configSnap.exists()) setExportConfig(configSnap.data());
                setAllPerangkat(perangkatSnap.docs.map(d => d.data()));

                if (mapConfigSnap.exists()) {
                    const data = mapConfigSnap.data();
                    const newConfig = { ...mapConfig };
                    if (data.centerLat && data.centerLng) newConfig.center = [data.centerLat, data.centerLng];
                    if (data.boundaryCoords && Array.isArray(data.boundaryCoords)) {
                        newConfig.boundary = data.boundaryCoords.map(pt => [pt.lat || pt[0], pt.lng || pt[1]]);
                    }
                    setMapConfig(newConfig);
                }
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

    // Initial Menu Position
    useEffect(() => {
        if (isSelectionMode) {
             setMenuPos({ x: window.innerWidth / 2 - 110, y: window.innerHeight - 120 });
        }
    }, [isSelectionMode]);

    // Auto Open Modal
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

    // Stats Calculation
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

    const stats = useMemo(() => {
        const total = filteredAset.length;
        const nilai = filteredAset.reduce((acc, curr) => acc + (Number(curr.nilaiAset) || 0), 0);
        const baik = filteredAset.filter(a => a.kondisi === 'Baik').length;
        const rusak = filteredAset.filter(a => a.kondisi !== 'Baik').length;
        return { total, nilai, baik, rusak };
    }, [filteredAset]);

    // Handlers
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
    
    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleLocationChange = useCallback((location) => {
        setFormData(prev => ({ ...prev, latitude: location.lat, longitude: location.lng }));
    }, []);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const coordinates = (formData.latitude && formData.longitude) ? { lat: formData.latitude, lng: formData.longitude } : null;

            if (selectedAset) {
                await updateItem(selectedAset.id, formData);
                showNotification('Aset berhasil diperbarui', 'success');
                if (currentUser.role === 'admin_desa') {
                    const message = `Desa ${currentUser.desa} memperbarui data aset: ${formData.namaAset}.`;
                    const link = `/app/aset/manajemen?view=${selectedAset.id}`; 
                    await createNotificationForAdmins(message, link, currentUser, 'aset', { assetId: selectedAset.id, coordinates: coordinates });
                }
            } else {
                const newDocRef = await addItem(formData);
                showNotification('Aset berhasil ditambahkan', 'success');
                if (currentUser.role === 'admin_desa' && newDocRef?.id) {
                    const message = `Aset Baru dari Desa ${currentUser.desa}: ${formData.namaAset} (${formData.kategori}).`;
                    const link = `/app/aset/manajemen?view=${newDocRef.id}`;
                    await createNotificationForAdmins(message, link, currentUser, 'aset', { assetId: newDocRef.id, coordinates: coordinates });
                }
            }
            handleCloseModal();
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
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

    // Selection & Drag Logic (Simplified for brevity, but functional)
    const toggleSelection = (id) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
        setSelectedIds(newSelection);
    };
    const handleSelectAll = () => {
        if (selectedIds.size === filteredAset.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredAset.map(p => p.id)));
    };
    const activateSelectionMode = (id) => {
        if (!isSelectionMode) { setIsSelectionMode(true); setSelectedIds(new Set([id])); if (navigator.vibrate) navigator.vibrate(50); }
    };
    const cancelSelectionMode = () => { setIsSelectionMode(false); setSelectedIds(new Set()); };
    const executeBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => batch.delete(doc(db, 'aset', id)));
            await batch.commit();
            showNotification(`${selectedIds.size} aset berhasil dihapus.`, 'success');
            cancelSelectionMode();
        } catch (error) { showNotification(`Gagal menghapus: ${error.message}`, 'error'); } 
        finally { setIsSubmitting(false); setIsBulkDeleteConfirmOpen(false); }
    };

    const handleRowTouchStart = (id, e) => {
        isScrolling.current = false;
        touchStartCoords.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        longPressTimer.current = setTimeout(() => { if (!isScrolling.current) activateSelectionMode(id); }, 600);
    };
    const handleRowTouchMove = (e) => {
        const moveX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
        const moveY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);
        if (moveX > 10 || moveY > 10) { isScrolling.current = true; if (longPressTimer.current) clearTimeout(longPressTimer.current); }
    };
    const handleRowTouchEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

    // Drag Logic
    const startDrag = (e) => { setIsDragging(true); const c = e.touches ? e.touches[0] : e; dragStartPos.current = { x: c.clientX - menuPos.x, y: c.clientY - menuPos.y }; };
    const onDrag = (e) => { if (!isDragging) return; const c = e.touches ? e.touches[0] : e; setMenuPos({ x: c.clientX - dragStartPos.current.x, y: c.clientY - dragStartPos.current.y }); };
    const stopDrag = () => setIsDragging(false);
    useEffect(() => {
        if (isDragging) { window.addEventListener('mousemove', onDrag); window.addEventListener('mouseup', stopDrag); window.addEventListener('touchmove', onDrag, {passive: false}); window.addEventListener('touchend', stopDrag); } 
        else { window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', stopDrag); window.removeEventListener('touchmove', onDrag); window.removeEventListener('touchend', stopDrag); }
        return () => { window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', stopDrag); window.removeEventListener('touchmove', onDrag); window.removeEventListener('touchend', stopDrag); };
    }, [isDragging]);

    const handleExportPDF = () => {
        if (filteredAset.length === 0) { showNotification("Tidak ada data untuk diekspor.", "warning"); return; }
        generateAsetPDF(filteredAset, filters.desa, exportConfig, allPerangkat);
    };

    return (
        <div className="space-y-6 pb-24">
            
            {/* --- DASHBOARD STATS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard 
                    title="Total Unit Aset" 
                    value={stats.total} 
                    icon={<FiBox size={24} />} 
                    colorClass="bg-gradient-to-r from-blue-500 to-indigo-600" 
                    subTitle="Inventaris Desa"
                 />
                 <StatCard 
                    title="Total Nilai Kekayaan" 
                    value={formatRupiahKompak(stats.nilai)} 
                    icon={<FiDollarSign size={24} />} 
                    colorClass="bg-gradient-to-r from-emerald-500 to-green-600" 
                    isCurrency={false} 
                    subTitle="Estimasi Rupiah"
                 />
                 <StatCard 
                    title="Kondisi Baik" 
                    value={stats.baik} 
                    icon={<FiCheckSquare size={24} />} 
                    colorClass="bg-gradient-to-r from-cyan-500 to-blue-500" 
                    subTitle="Aset Layak Pakai"
                 />
                 <StatCard 
                    title="Perlu Perbaikan" 
                    value={stats.rusak} 
                    icon={<FiAlertCircle size={24} />} 
                    colorClass="bg-gradient-to-r from-orange-500 to-red-500" 
                    subTitle="Rusak Ringan/Berat"
                 />
            </div>

            {/* --- FILTER & HEADER --- */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center gap-4">
                <div>
                     <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FiBox className="text-blue-600"/> Manajemen Aset Desa
                        {isSelectionMode && <span className="text-sm font-normal px-3 py-1 bg-blue-100 text-blue-700 rounded-full">{selectedIds.size} dipilih</span>}
                    </h2>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto">
                    <div className="flex-1 min-w-[200px] relative">
                         <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                         <input 
                            type="text" 
                            placeholder="Cari aset..." 
                            value={filters.searchTerm} 
                            onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })} 
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border-none text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                         />
                    </div>
                    <div className="min-w-[150px]">
                         <select 
                             value={filters.kategori} 
                             onChange={(e) => setFilters({ ...filters, kategori: e.target.value })}
                             className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border-none text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                         >
                            <option value="all">Semua Kategori</option>
                            {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                         </select>
                    </div>
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="min-w-[150px]">
                            <select 
                                value={filters.desa} 
                                onChange={(e) => setFilters({ ...filters, desa: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border-none text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="all">Semua Desa</option>
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={handleExportPDF} className="p-2.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-200" title="Export PDF"><FiDownload /></button>
                        <button onClick={() => handleOpenModal(null, 'add')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"><FiPlus /> Tambah</button>
                    </div>
                </div>
            </div>
            
            {/* --- TABEL DATA --- */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>
                    ) : (
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                             <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300 border-b dark:border-gray-600">
                                <tr>
                                    <th className="px-6 py-4 w-10 text-center">
                                        {isSelectionMode ? (
                                            <button onClick={handleSelectAll} className="text-gray-500 hover:text-blue-600 transition-colors">
                                                {selectedIds.size === filteredAset.length ? <FiCheckSquare size={20} className="text-blue-600"/> : <div className="w-5 h-5 border-2 border-gray-400 rounded mx-auto"></div>}
                                            </button>
                                        ) : 'No'}
                                    </th>
                                    <th className="px-6 py-4">Nama Aset</th>
                                    <th className="px-6 py-4">Kategori</th>
                                    <th className="px-6 py-4">Nilai (Rp)</th>
                                    <th className="px-6 py-4 text-center">Kondisi</th>
                                    <th className="px-6 py-4 text-center">Lokasi</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredAset.length > 0 ? filteredAset.map((aset, index) => {
                                    const isSelected = selectedIds.has(aset.id);
                                    return (
                                        <tr 
                                            key={aset.id} 
                                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors select-none cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                            onDoubleClick={() => isSelectionMode ? null : setIsSelectionMode(true)}
                                            onTouchStart={(e) => handleRowTouchStart(aset.id, e)}
                                            onTouchMove={handleRowTouchMove}
                                            onTouchEnd={handleRowTouchEnd}
                                            onClick={(e) => isSelectionMode && !e.target.closest('button') && toggleSelection(aset.id)}
                                        >
                                            <td className="px-6 py-4 text-center">
                                                {isSelectionMode ? (
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                                                        {isSelected && <FiCheckSquare className="text-white w-3 h-3" />}
                                                    </div>
                                                ) : index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{aset.namaAset}</div>
                                                <div className="text-xs text-gray-500 font-mono">{aset.kodeBarang}</div>
                                            </td>
                                            <td className="px-6 py-4">{aset.kategori}</td>
                                            <td className="px-6 py-4 font-mono font-medium text-gray-800 dark:text-gray-200">
                                                {Number(aset.nilaiAset).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${aset.kondisi === 'Baik' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                                    {aset.kondisi}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {aset.latitude ? <FiMapPin className="text-green-500 mx-auto" /> : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(aset, 'view'); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 rounded-lg"><FiEye size={18}/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(aset, 'edit'); }} className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 rounded-lg"><FiEdit size={18}/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); setItemToDelete(aset); setIsDeleteConfirmOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 rounded-lg"><FiTrash2 size={18}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                }) : (
                                    <tr><td colSpan="7" className="text-center py-12 text-gray-500">Belum ada data aset.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* --- ACTION POPUP --- */}
            {isSelectionMode && (
                <div style={{ position: 'fixed', left: `${menuPos.x}px`, top: `${menuPos.y}px`, zIndex: 9999, touchAction: 'none' }} className="flex items-center gap-3 pl-2 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-2xl rounded-full animate-in fade-in zoom-in duration-200 backdrop-blur-md">
                    <div onMouseDown={startDrag} onTouchStart={startDrag} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-full cursor-move group"><FiMove className="text-gray-500"/> <span className="font-bold text-blue-600">{selectedIds.size}</span></div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <button onClick={() => setIsBulkDeleteConfirmOpen(true)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-full"><FiTrash2 size={20}/></button>
                    <button onClick={cancelSelectionMode} className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-full"><FiX size={20}/></button>
                </div>
            )}

            {/* --- MODAL FORM --- */}
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
                            <InputField label="Nilai Aset (Rp)" name="nilaiAset" type="number" value={formData.nilaiAset || ''} onChange={handleFormChange} prefix="Rp" />
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
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <FiMap className="text-blue-500" /> Lokasi Aset di Peta (Wajib)
                            </label>
                            {/* --- ADVANCED MAP INPUT --- */}
                            <AdvancedMapInput
                                key={selectedAset ? selectedAset.id : 'new'}
                                initialPosition={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : null}
                                onLocationChange={handleLocationChange}
                                mapConfig={mapConfig} // PASS CONFIG FOR CENTER & BOUNDARY
                            />
                        </div>

                        <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-3">
                            <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600">Batal</button>
                            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 flex items-center">
                                {isSubmitting && <Spinner size="sm" className="mr-2" />} Simpan
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={executeDelete} isLoading={isSubmitting} title="Konfirmasi Hapus" message={`Yakin ingin menghapus aset ${itemToDelete?.namaAset}?`} />
            <ConfirmationModal isOpen={isBulkDeleteConfirmOpen} onClose={() => setIsBulkDeleteConfirmOpen(false)} onConfirm={executeBulkDelete} isLoading={isSubmitting} title="Hapus Massal" message={`Yakin ingin menghapus ${selectedIds.size} aset terpilih?`} variant="danger" />
        </div>
    );
};

export default AsetDesa;