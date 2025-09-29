import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { DESA_LIST, KATEGORI_ASET } from '../utils/constants';
import { FiMap } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import '../styles/PetaAset.css';

const PetaAsetPage = () => {
    const { currentUser } = useAuth();
    const { data: allAset, loading } = useFirestoreCollection('aset');
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);

    const [filters, setFilters] = useState({
        desa: currentUser?.role === 'admin_desa' ? currentUser.desa : 'all',
        kategori: 'all',
    });
    const navigate = useNavigate();

    const punggelanCenter = [-7.279, 109.489];

    useEffect(() => {
        if (!window.L || !mapRef.current) return;
        
        if (!mapInstanceRef.current) {
            const map = window.L.map(mapRef.current).setView(punggelanCenter, 13);
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            mapInstanceRef.current = map;
        }
        
        // --- PERBAIKAN: Fungsi Cleanup yang Lebih Kuat ---
        return () => {
            if (mapInstanceRef.current) {
                // Hapus semua event listener dari peta untuk mencegah memory leak
                mapInstanceRef.current.off();
                // Hapus peta dari DOM
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []); // Dependency array kosong, hanya berjalan sekali.

    const filteredAset = useMemo(() => {
        return allAset.filter(aset => {
            const hasLocation = aset.latitude && aset.longitude;
            const desaMatch = filters.desa === 'all' || aset.desa === filters.desa;
            const kategoriMatch = filters.kategori === 'all' || aset.kategori === filters.kategori;
            return hasLocation && desaMatch && kategoriMatch;
        });
    }, [allAset, filters]);

    useEffect(() => {
        if (!mapInstanceRef.current) return;
        
        const map = mapInstanceRef.current;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        
        const defaultIcon = window.L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        filteredAset.forEach(aset => {
            const googleMapsUrl = `https://www.google.com/maps?q=${aset.latitude},${aset.longitude}`;
            
            const marker = window.L.marker([aset.latitude, aset.longitude], { icon: defaultIcon })
                .addTo(map)
                .bindPopup(`
                    <div class="map-popup">
                        <div class="popup-title">${aset.namaAset}</div>
                        <div class="popup-content">
                            <b>Kategori:</b> ${aset.kategori}<br/>
                            <b>Desa:</b> ${aset.desa}
                        </div>
                        <div class="popup-actions">
                          <a href="#" class="popup-link internal-link" data-aset-id="${aset.id}">Lihat Detail Data</a>
                          <a href="${googleMapsUrl}" class="popup-link external-link" target="_blank" rel="noopener noreferrer">Buka di Peta</a>
                        </div>
                    </div>
                `);
            markersRef.current.push(marker);
        });
        
        map.off('popupopen');
        map.on('popupopen', (e) => {
            const internalLink = e.popup.getElement().querySelector('.internal-link');
            if (internalLink) {
                internalLink.onclick = (event) => {
                    event.preventDefault();
                    const asetId = internalLink.getAttribute('data-aset-id');
                    if (asetId) {
                        navigate(`/app/aset/data?edit=${asetId}`);
                    }
                };
            }
        });

    }, [filteredAset, navigate]);

    const handleFilterChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md h-full flex flex-col">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                <FiMap className="mr-3 text-blue-500" /> Peta Aset Desa
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 items-end">
                {currentUser?.role === 'admin_kecamatan' && (
                    <InputField label="Filter Desa" name="desa" type="select" value={filters.desa} onChange={handleFilterChange}>
                        <option value="all">Semua Desa</option>
                        {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                    </InputField>
                )}
                 <InputField label="Filter Kategori" name="kategori" type="select" value={filters.kategori} onChange={handleFilterChange}>
                    <option value="all">Semua Kategori Aset</option>
                    {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                </InputField>
                 <div className="text-sm text-gray-600 dark:text-gray-400 lg:col-span-2">
                    Menampilkan <strong>{filteredAset.length}</strong> dari <strong>{allAset.filter(a => a.latitude).length}</strong> total aset yang memiliki data lokasi.
                </div>
            </div>
            
            <div className="flex-grow rounded-lg overflow-hidden relative">
                {loading && <div className="absolute inset-0 bg-gray-400 bg-opacity-50 flex justify-center items-center z-10"><Spinner size="lg" /></div>}
                <div ref={mapRef} className="w-full h-full" style={{minHeight: '500px'}}></div>
            </div>
        </div>
    );
};

export default PetaAsetPage;

