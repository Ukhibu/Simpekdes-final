import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext'; // IMPORT NOTIFICATION CONTEXT
import LoadingScreen from '../components/common/LoadingScreen';
import { DESA_LIST, KATEGORI_ASET } from '../utils/constants';
import { useNavigate } from 'react-router-dom';
import { FiMap, FiList, FiFilter, FiLayers, FiNavigation, FiTarget, FiEdit3, FiSave, FiX, FiMove } from 'react-icons/fi';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// --- A. FIX LEAFLET ICON & CONFIG ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// --- B. CUSTOM ICONS ---
const createCustomIcon = (kategori) => {
  let colorClass = 'bg-blue-500';
  let iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  
  if (kategori === 'Tanah') {
    colorClass = 'bg-emerald-500'; 
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M17 21v-8H7v8"/></svg>';
  } else if (kategori === 'Kendaraan') {
    colorClass = 'bg-amber-500';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
  } else if (kategori === 'Bangunan') {
    colorClass = 'bg-indigo-500';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>';
  } else if (kategori === 'Center') {
    colorClass = 'bg-red-600';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>';
  }

  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div class="${colorClass} w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center transform hover:scale-110 transition-transform duration-200">
      ${iconHtml}
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

// Icon khusus untuk Vertex (Titik Sudut Wilayah) yang bisa digeser
const vertexIcon = L.divIcon({
    className: 'vertex-icon',
    html: `<div class="w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-md hover:scale-125 transition-transform cursor-move"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

// --- C. MAP COMPONENTS ---

function MapController({ selectedLocation, zoomLevel = 18 }) {
  const map = useMap();
  useEffect(() => {
    if (selectedLocation) {
      map.flyTo(selectedLocation, zoomLevel, { animate: true, duration: 1.5 });
    }
  }, [selectedLocation, zoomLevel, map]);
  return null;
}

function MapClickCapture({ isEnabled, onLocationSelect }) {
  useMapEvents({
    click(e) {
      if (isEnabled) {
        onLocationSelect([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

// Komponen Marker yang bisa di-drag untuk Edit Batas
const DraggableVertex = ({ position, index, onDrag }) => {
    const markerRef = useRef(null);
    const eventHandlers = useMemo(
      () => ({
        dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            onDrag(index, marker.getLatLng());
          }
        },
      }),
      [index, onDrag],
    );
  
    return (
      <Marker
        draggable={true}
        eventHandlers={eventHandlers}
        position={position}
        icon={vertexIcon}
        ref={markerRef}
      >
         <Tooltip direction="top" offset={[0, -10]} opacity={0.8}>Geser saya</Tooltip>
      </Marker>
    );
};

const PetaAsetPage = () => {
  const { currentUser } = useAuth();
  const { data: allAset, loading } = useFirestoreCollection('aset');
  const { showNotification } = useNotification(); // GUNAKAN NOTIFIKASI CONTEXT
  const navigate = useNavigate();

  // State Koordinat Pusat & Batas Wilayah
  const [punggelanCenter, setPunggelanCenter] = useState([-7.3948, 109.6432]);
  
  // DEFAULT KOORDINAT (10 TITIK / DECAGON)
  const [batasWilayahCoords, setBatasWilayahCoords] = useState([
    [-7.3800, 109.6432], // Utara (Top)
    [-7.3820, 109.6500], // Timur Laut 1
    [-7.3880, 109.6550], // Timur Laut 2
    [-7.3950, 109.6580], // Timur (Right)
    [-7.4020, 109.6550], // Tenggara
    [-7.4100, 109.6432], // Selatan (Bottom)
    [-7.4020, 109.6314], // Barat Daya
    [-7.3950, 109.6284], // Barat (Left)
    [-7.3880, 109.6314], // Barat Laut 1
    [-7.3820, 109.6364], // Barat Laut 2
  ]);
  
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // State Editing
  const [isEditingLocation, setIsEditingLocation] = useState(false); // Edit Pusat
  const [isEditingBoundary, setIsEditingBoundary] = useState(false); // Edit Batas
  const [tempCenterLocation, setTempCenterLocation] = useState(null);
  const [tempBoundaryCoords, setTempBoundaryCoords] = useState(null);

  const [filters, setFilters] = useState({
    desa: currentUser?.role === 'admin_desa' ? currentUser.desa : 'all',
    kategori: 'all',
  });

  const [mapMode, setMapMode] = useState('street'); 
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [mapView, setMapView] = useState({ center: punggelanCenter, zoom: 13 });

  // --- 1. LOAD CONFIG FROM FIRESTORE ---
  useEffect(() => {
    const fetchMapConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'peta_wilayah_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.centerLat && data.centerLng) {
            const newCenter = [data.centerLat, data.centerLng];
            setPunggelanCenter(newCenter);
            setMapView(prev => ({ ...prev, center: newCenter }));
          }
          if (data.boundaryCoords && Array.isArray(data.boundaryCoords) && data.boundaryCoords.length > 2) {
             const loadedBoundary = data.boundaryCoords.map(pt => [pt.lat || pt[0], pt.lng || pt[1]]);
             setBatasWilayahCoords(loadedBoundary);
          }
        }
        setIsConfigLoaded(true);
      } catch (err) {
        console.error("Gagal memuat konfigurasi peta:", err);
        setIsConfigLoaded(true);
      }
    };
    fetchMapConfig();
  }, []);

  const filteredAset = useMemo(() => {
    return allAset.filter(aset => {
      const hasLocation = aset.latitude && aset.longitude;
      const desaMatch = filters.desa === 'all' || aset.desa === filters.desa;
      const kategoriMatch = filters.kategori === 'all' || aset.kategori === filters.kategori;
      return hasLocation && desaMatch && kategoriMatch;
    });
  }, [allAset, filters]);

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSelectedAsset(null);
  };

  const handleDetailClick = (id) => {
    navigate(`/app/aset/manajemen?view=${id}`);
  };

  // --- 2. FITUR SIMPAN PUSAT WILAYAH ---
  const handleSaveCenterLocation = async () => {
    if (!tempCenterLocation) return;
    try {
      await setDoc(doc(db, 'settings', 'peta_wilayah_config'), {
        centerLat: tempCenterLocation[0],
        centerLng: tempCenterLocation[1],
        boundaryCoords: batasWilayahCoords.map(pt => ({ lat: pt[0], lng: pt[1] })),
        updatedBy: currentUser.email,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setPunggelanCenter(tempCenterLocation);
      setMapView({ center: tempCenterLocation, zoom: 13 });
      setIsEditingLocation(false);
      setTempCenterLocation(null);
      showNotification("Lokasi pusat wilayah berhasil diperbarui.", "success");
    } catch (error) {
      console.error("Error saving location:", error);
      showNotification("Gagal menyimpan lokasi: " + error.message, "error");
    }
  };

  // --- 3. FITUR SIMPAN BATAS WILAYAH ---
  const startEditingBoundary = () => {
      setTempBoundaryCoords([...batasWilayahCoords]); 
      setIsEditingBoundary(true);
      setIsEditingLocation(false);
      // Di Mobile, tutup sidebar otomatis saat mulai edit agar area peta luas
      if (window.innerWidth < 768) {
          setSidebarOpen(false);
      }
  };

  const handleVertexDrag = (index, latLng) => {
      const newCoords = [...tempBoundaryCoords];
      newCoords[index] = [latLng.lat, latLng.lng];
      setTempBoundaryCoords(newCoords);
  };

  const handleSaveBoundary = async () => {
      if (!tempBoundaryCoords) return;
      try {
          const boundaryToSave = tempBoundaryCoords.map(pt => ({ lat: pt[0], lng: pt[1] }));
          
          await setDoc(doc(db, 'settings', 'peta_wilayah_config'), {
              boundaryCoords: boundaryToSave,
              centerLat: punggelanCenter[0],
              centerLng: punggelanCenter[1],
              updatedBy: currentUser.email,
              updatedAt: new Date().toISOString()
          }, { merge: true });

          setBatasWilayahCoords(tempBoundaryCoords);
          setIsEditingBoundary(false);
          setTempBoundaryCoords(null);
          showNotification("Batas wilayah berhasil diperbarui.", "success");
          
          // Buka sidebar kembali jika di desktop
          if (window.innerWidth >= 768) {
              setSidebarOpen(true);
          }
      } catch (error) {
          console.error("Error saving boundary:", error);
          showNotification("Gagal menyimpan batas wilayah: " + error.message, "error");
      }
  };

  const handleNavigasiDesa = (namaDesa) => {
    if (namaDesa === 'center') {
      setMapView({ center: punggelanCenter, zoom: 13 });
      return;
    }
    const asetDiDesa = allAset.filter(a => a.desa === namaDesa && a.latitude && a.longitude);
    if (asetDiDesa.length > 0) {
      const totalLat = asetDiDesa.reduce((sum, a) => sum + parseFloat(a.latitude), 0);
      const totalLng = asetDiDesa.reduce((sum, a) => sum + parseFloat(a.longitude), 0);
      const centerLat = totalLat / asetDiDesa.length;
      const centerLng = totalLng / asetDiDesa.length;
      setMapView({ center: [centerLat, centerLng], zoom: 15 });
      
      // Di mobile, tutup sidebar setelah navigasi
      if (window.innerWidth < 768) {
          setSidebarOpen(false);
      }
    } else {
      showNotification(`Belum ada data lokasi aset di desa ${namaDesa}.`, "info");
    }
  };

  const stats = {
    total: filteredAset.length,
    tanah: filteredAset.filter(a => a.kategori === 'Tanah').length,
    bangunan: filteredAset.filter(a => a.kategori === 'Bangunan').length,
  };

  if (loading || !isConfigLoaded) return <LoadingScreen />;

  const displayBoundary = isEditingBoundary ? tempBoundaryCoords : batasWilayahCoords;

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-gray-100 font-sans z-0">
      
      <MapContainer 
        center={punggelanCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <MapController 
            selectedLocation={selectedAsset ? [selectedAsset.latitude, selectedAsset.longitude] : mapView.center} 
            zoomLevel={selectedAsset ? 18 : mapView.zoom}
        />

        <MapClickCapture 
            isEnabled={isEditingLocation} 
            onLocationSelect={setTempCenterLocation} 
        />

        {mapMode === 'street' ? (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='&copy; Esri World Imagery'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        <Polygon 
          positions={displayBoundary} 
          pathOptions={{ 
            color: '#10B981', 
            fillColor: '#10B981', 
            fillOpacity: mapMode === 'satellite' ? 0.1 : 0.05, 
            weight: isEditingBoundary ? 3 : 2, 
            dashArray: isEditingBoundary ? null : '5, 5' 
          }} 
        >
           {!isEditingBoundary && (
               <Tooltip sticky direction="center" className="font-bold text-emerald-700 bg-transparent border-none shadow-none text-lg">
                  Wilayah Punggelan
               </Tooltip>
           )}
        </Polygon>

        {isEditingBoundary && tempBoundaryCoords.map((pos, idx) => (
            <DraggableVertex 
                key={`v-${idx}`} 
                position={pos} 
                index={idx} 
                onDrag={handleVertexDrag} 
            />
        ))}

        {isEditingLocation && tempCenterLocation && (
           <Marker position={tempCenterLocation} icon={createCustomIcon('Center')}>
              <Popup>Titik Pusat Baru</Popup>
           </Marker>
        )}

        {!isEditingLocation && !isEditingBoundary && filteredAset.map((aset) => (
          <Marker
            key={aset.id}
            position={[aset.latitude, aset.longitude]}
            icon={createCustomIcon(aset.kategori)}
            eventHandlers={{
              click: () => {
                setSelectedAsset(aset);
                setSidebarOpen(true);
              },
            }}
          >
            <Popup className="custom-popup">
              <div className="p-1 min-w-[200px]">
                <h3 className="font-bold text-gray-800 mb-1">{aset.namaAset}</h3>
                <div className="text-xs text-gray-500 mb-2">
                   <p>Desa: {aset.desa}</p>
                   <p>Kategori: {aset.kategori}</p>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => handleDetailClick(aset.id)}
                     className="flex-1 bg-blue-600 text-white text-xs py-1 px-2 rounded hover:bg-blue-700 transition"
                   >
                     Detail
                   </button>
                   <a 
                     href={`https://www.google.com/maps?q=${aset.latitude},${aset.longitude}`} 
                     target="_blank" 
                     rel="noreferrer"
                     className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs py-1 px-2 rounded text-center hover:bg-gray-50 transition"
                   >
                     GMaps
                   </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* --- UI CONTROLS --- */}

      {isEditingLocation && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[500] bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce-in w-11/12 md:w-auto justify-center">
           <FiTarget className="animate-pulse shrink-0" />
           <span className="text-xs md:text-sm font-bold truncate">Klik peta untuk titik pusat baru</span>
        </div>
      )}

      {isEditingBoundary && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[500] bg-emerald-100 border border-emerald-400 text-emerald-800 px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce-in w-11/12 md:w-auto justify-center">
           <FiMove className="animate-bounce shrink-0" />
           <span className="text-xs md:text-sm font-bold truncate">Geser titik hijau untuk ubah batas</span>
        </div>
      )}

      <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur-md p-1 rounded-lg shadow-xl border border-gray-200 flex gap-1">
        <button 
          onClick={() => setMapMode('street')}
          className={`flex items-center gap-1 px-2 md:px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${mapMode === 'street' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <FiMap /> <span className="hidden md:inline">Peta</span> Jalan
        </button>
        <button 
          onClick={() => setMapMode('satellite')}
          className={`flex items-center gap-1 px-2 md:px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${mapMode === 'satellite' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <FiLayers /> <span className="hidden md:inline">Satelit</span> (3D)
        </button>
      </div>

      <div className="absolute bottom-6 left-6 z-[400] hidden md:flex gap-3 pointer-events-none">
         <div className="bg-white/90 backdrop-blur-md p-3 rounded-lg shadow-xl border-l-4 border-blue-500 w-32 pointer-events-auto">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Aset</p>
            <p className="text-xl font-bold text-gray-800">{stats.total}</p>
         </div>
         <div className="bg-white/90 backdrop-blur-md p-3 rounded-lg shadow-xl border-l-4 border-emerald-500 w-32 pointer-events-auto">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Tanah</p>
            <p className="text-xl font-bold text-gray-800">{stats.tanah}</p>
         </div>
      </div>

      {/* --- SIDEBAR RESPONSIVE --- */}
      <div 
        className={`absolute top-0 md:top-4 left-0 md:left-4 bottom-0 md:bottom-4 w-full md:w-80 bg-white/95 backdrop-blur-xl shadow-2xl md:rounded-2xl border-r md:border border-gray-100 z-[400] flex flex-col transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-[110%] md:-translate-x-[120%]'}`}
      >
        
        <button 
          onClick={() => setSidebarOpen(false)}
          className="absolute right-4 top-4 md:-right-3 md:top-6 bg-white rounded-full p-2 md:p-1 shadow-md border border-gray-200 hover:bg-gray-50 text-gray-600 z-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        </button>

        <div className="p-5 border-b border-gray-100 mt-8 md:mt-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FiMap className="text-blue-600" />
            GIS Aset Desa
          </h2>
          <p className="text-xs text-gray-500 mt-1">Visualisasi data aset geospasial</p>
        </div>

        {/* --- SECTION NAVIGASI & PENGATURAN (KHUSUS ADMIN KECAMATAN) --- */}
        {currentUser?.role === 'admin_kecamatan' && (
           <div className="px-4 py-3 bg-blue-50/50 border-b border-blue-100 space-y-3 overflow-y-auto max-h-[30vh]">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wide">
                  <FiNavigation /> Pengaturan Wilayah
              </div>
              
              <div className="bg-white p-2 rounded border border-blue-100 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-gray-500">TITIK PUSAT PETA</span>
                      {!isEditingLocation ? (
                        <button 
                          onClick={() => { setIsEditingLocation(true); setIsEditingBoundary(false); if(window.innerWidth < 768) setSidebarOpen(false); }}
                          className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded hover:bg-blue-100 transition text-[10px] flex items-center gap-1"
                          disabled={isEditingBoundary}
                        >
                           <FiEdit3 /> Ubah
                        </button>
                      ) : (
                        <div className="flex gap-1">
                           <button onClick={handleSaveCenterLocation} disabled={!tempCenterLocation} className={`p-1 rounded text-white text-[10px] flex items-center gap-1 ${tempCenterLocation ? 'bg-green-500' : 'bg-gray-300'}`}><FiSave /> Simpan</button>
                           <button onClick={() => { setIsEditingLocation(false); setTempCenterLocation(null); if(window.innerWidth < 768) setSidebarOpen(true); }} className="p-1 rounded bg-red-500 text-white text-[10px] flex items-center gap-1"><FiX /> Batal</button>
                        </div>
                      )}
                  </div>
                  <button 
                    onClick={() => handleNavigasiDesa('center')}
                    className="w-full flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 text-[10px] py-1.5 px-2 rounded transition-colors"
                  >
                     <FiTarget /> Reset View ke Pusat
                  </button>
              </div>

              <div className="bg-white p-2 rounded border border-blue-100 shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-500">BATAS WILAYAH</span>
                      {!isEditingBoundary ? (
                        <button 
                          onClick={startEditingBoundary}
                          className="text-emerald-600 hover:text-emerald-800 p-1 bg-emerald-50 rounded hover:bg-emerald-100 transition text-[10px] flex items-center gap-1"
                          disabled={isEditingLocation}
                        >
                           <FiEdit3 /> Edit Batas
                        </button>
                      ) : (
                        <div className="flex gap-1">
                           <button onClick={handleSaveBoundary} className="p-1 rounded bg-emerald-500 text-white text-[10px] flex items-center gap-1 hover:bg-emerald-600"><FiSave /> Simpan</button>
                           <button onClick={() => { setIsEditingBoundary(false); setTempBoundaryCoords(null); if(window.innerWidth < 768) setSidebarOpen(true); }} className="p-1 rounded bg-red-500 text-white text-[10px] flex items-center gap-1 hover:bg-red-600"><FiX /> Batal</button>
                        </div>
                      )}
                  </div>
              </div>

              <div className="border-t border-blue-100 pt-2">
                  <label className="text-[9px] text-gray-500 font-bold block mb-1">PILIH DESA</label>
                  <select 
                    onChange={(e) => handleNavigasiDesa(e.target.value)}
                    className="w-full text-xs p-1.5 rounded border border-gray-300 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Lompat ke Desa --</option>
                    {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
              </div>
           </div>
        )}

        <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-3">
           <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FiFilter /> Filter Data
           </div>
           
           {currentUser?.role === 'admin_kecamatan' && (
             <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Filter Tampilan Desa</label>
                <select 
                  name="desa" 
                  value={filters.desa} 
                  onChange={handleFilterChange}
                  className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">Semua Desa</option>
                  {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
             </div>
           )}

           <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Kategori Aset</label>
              <select 
                name="kategori" 
                value={filters.kategori} 
                onChange={handleFilterChange}
                className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">Semua Kategori</option>
                {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
           {selectedAsset ? (
             <div className="animate-fadeIn">
                <button 
                  onClick={() => setSelectedAsset(null)}
                  className="mb-4 text-xs text-gray-500 flex items-center gap-1 hover:text-blue-600"
                >
                  ← Kembali ke daftar
                </button>
                
                <div className="aspect-video w-full rounded-xl bg-gray-200 overflow-hidden mb-4 relative shadow-inner">
                   {selectedAsset.foto ? (
                      <img src={selectedAsset.foto} alt="Aset" className="w-full h-full object-cover" />
                   ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>
                   )}
                   <span className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] rounded backdrop-blur-sm">
                      {selectedAsset.kategori}
                   </span>
                </div>

                <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedAsset.namaAset}</h3>
                <p className="text-xs text-gray-500 mb-4">{selectedAsset.desa}</p>
                
                <div className="space-y-2 mb-6">
                   <InfoRow label="Kode" value={selectedAsset.kodeAset || '-'} />
                   <InfoRow label="Nilai" value={selectedAsset.nilaiAset ? `Rp ${parseInt(selectedAsset.nilaiAset).toLocaleString('id-ID')}` : '-'} />
                   <InfoRow label="Kondisi" value={selectedAsset.kondisi || '-'} />
                </div>

                <button 
                  onClick={() => handleDetailClick(selectedAsset.id)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                >
                  Lihat Detail Lengkap
                </button>
             </div>
           ) : (
             <div className="space-y-3">
               <div className="text-xs text-gray-500 mb-2 flex justify-between items-center">
                  <span>Menampilkan {filteredAset.length} aset</span>
               </div>
               {filteredAset.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">Tidak ada data aset di lokasi ini.</div>
               ) : (
                  filteredAset.map(aset => (
                    <div 
                      key={aset.id}
                      onClick={() => setSelectedAsset(aset)}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:shadow-md hover:bg-blue-50/50 cursor-pointer transition-all bg-white"
                    >
                      <div className={`w-2 h-8 rounded-full ${
                        aset.kategori === 'Tanah' ? 'bg-emerald-500' : 
                        aset.kategori === 'Bangunan' ? 'bg-indigo-500' : 'bg-amber-500'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 text-sm truncate">{aset.namaAset}</h4>
                        <p className="text-xs text-gray-500 truncate">{aset.desa}</p>
                      </div>
                      <div className="text-gray-300 group-hover:text-blue-500">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  ))
               )}
             </div>
           )}
        </div>
      </div>

      {!sidebarOpen && (
         <button 
           onClick={() => setSidebarOpen(true)}
           className="absolute top-20 left-4 z-[400] bg-white p-2 rounded-lg shadow-lg text-blue-600 hover:bg-blue-50"
         >
            <FiList className="h-6 w-6" />
         </button>
      )}

    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-start border-b border-gray-100 pb-1 last:border-0">
    <span className="text-xs text-gray-500 w-1/3">{label}</span>
    <span className="text-sm text-gray-800 font-medium w-2/3 text-right">{value}</span>
  </div>
);

export default PetaAsetPage;