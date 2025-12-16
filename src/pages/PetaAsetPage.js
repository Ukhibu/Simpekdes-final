import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// Hapus import hook yang bermasalah untuk halaman ini
// import { useFirestoreCollection } from '../hooks/useFirestoreCollection'; 
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext'; 
import Spinner from '../components/common/Spinner';
import { DESA_LIST, KATEGORI_ASET } from '../utils/constants';
import { useNavigate } from 'react-router-dom';
// Tambahkan collection, query, onSnapshot ke import firebase
import { doc, getDoc, setDoc, collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// --- ICONS REPLACEMENT (Agar tidak error jika react-icons belum install) ---
const FiMap = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>;
const FiList = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
const FiFilter = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>;
const FiLayers = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>;
const FiNavigation = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>;
const FiTarget = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>;
const FiEdit3 = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>;
const FiSave = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>;
const FiX = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const FiMove = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>;

// --- A. FIX LEAFLET ICON & CONFIG ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// --- B. CUSTOM ICONS (DINAMIS SESUAI KATEGORI) ---
const createCustomIcon = (kategori, type = 'asset') => {
  let colorClass = 'bg-blue-500';
  let iconHtml = '';

  // 1. Icon Khusus Editor
  if (type === 'center') {
    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `<div class="bg-red-600 w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  if (type === 'drag-handle') {
    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `<div class="bg-white w-8 h-8 rounded-full border-2 border-emerald-500 shadow-xl flex items-center justify-center cursor-move hover:scale-110 transition-transform">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M19 9l3 3-3 3M15 19l-3 3-3-3M2 12h20M12 2v20"/></svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  // 2. Icon Aset Berdasarkan Kategori
  const kat = (kategori || '').toLowerCase();

  if (kat.includes('tanah')) {
    colorClass = 'bg-emerald-500'; 
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M17 21v-8H7v8"/></svg>';
  } else if (kat.includes('kendaraan')) {
    colorClass = 'bg-amber-500';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
  } else if (kat.includes('bangunan') || kat.includes('gedung')) {
    colorClass = 'bg-indigo-500';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>';
  } else if (kat.includes('jalan')) {
    colorClass = 'bg-gray-600';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M2 12l5-5M22 12l-5 5"/></svg>'; 
  } else if (kat.includes('jembatan')) {
    colorClass = 'bg-orange-700';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4"/><path d="M20 10v4"/><path d="M4 10c0-3 3-5 8-5s8 2 8 5"/><path d="M4 14h16"/></svg>';
  } else if (kat.includes('irigasi') || kat.includes('air')) {
    colorClass = 'bg-cyan-500';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.74 5.74a8 8 0 1 1-11.31 0z"/></svg>';
  } else if (kat.includes('mesin') || kat.includes('peralatan')) {
    colorClass = 'bg-red-500';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  } else {
    // Default
    colorClass = 'bg-blue-500';
    iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
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

// Icon Vertex (Titik Hijau Kecil untuk Geser Batas)
const vertexIcon = L.divIcon({
    className: 'vertex-icon',
    html: `<div class="w-3 h-3 bg-white border-2 border-emerald-600 rounded-full shadow hover:bg-emerald-600 transition-colors cursor-crosshair"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
});

// --- C. UTILS & COMPONENTS ---

// Fungsi Helper: Membuat koordinat lingkaran/poligon (20 titik)
const generateCircleCoords = (centerLat, centerLng, radiusKM = 2, points = 20) => {
    const coords = [];
    const earthRadius = 6371;
    for (let i = 0; i < points; i++) {
        const angle = (i * 360 / points) * (Math.PI / 180);
        const dLat = (radiusKM / earthRadius) * (180 / Math.PI);
        const dLng = (radiusKM / earthRadius) * (180 / Math.PI) / Math.cos(centerLat * Math.PI / 180);
        const lat = centerLat + dLat * Math.cos(angle);
        const lng = centerLng + dLng * Math.sin(angle);
        coords.push([lat, lng]);
    }
    return coords;
};

// Fungsi Helper: Hitung Titik Tengah Polygon
const getPolygonCenter = (coords) => {
    if (!coords || coords.length === 0) return null;
    let latSum = 0, lngSum = 0;
    coords.forEach(pt => {
        latSum += pt[0];
        lngSum += pt[1];
    });
    return [latSum / coords.length, lngSum / coords.length];
};

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

// Komponen: Marker Vertex Individu (Titik Hijau)
const DraggableVertex = ({ position, index, onDrag }) => {
    const markerRef = useRef(null);
    const eventHandlers = useMemo(() => ({
        dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            onDrag(index, marker.getLatLng());
          }
        },
    }), [index, onDrag]);
  
    return (
      <Marker
        draggable={true}
        eventHandlers={eventHandlers}
        position={position}
        icon={vertexIcon}
        ref={markerRef}
        zIndexOffset={1000}
      >
         <Tooltip direction="top" offset={[0, -5]} opacity={0.7}>Geser Titik</Tooltip>
      </Marker>
    );
};

// Komponen: Handle Tengah untuk Geser SELURUH Wilayah
const DraggablePolygonHandle = ({ coords, onDragAll }) => {
    const center = getPolygonCenter(coords);
    const markerRef = useRef(null);

    const eventHandlers = useMemo(() => ({
        dragend() {
            const marker = markerRef.current;
            if (marker != null && center) {
                const newCenter = marker.getLatLng();
                const latDiff = newCenter.lat - center[0];
                const lngDiff = newCenter.lng - center[1];
                onDragAll(latDiff, lngDiff);
                // Reset marker position visual to new center is handled by parent re-render
            }
        },
    }), [center, onDragAll]);

    if (!center) return null;

    return (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={center}
            icon={createCustomIcon(null, 'drag-handle')}
            ref={markerRef}
            zIndexOffset={2000}
        >
            <Tooltip permanent direction="bottom" offset={[0, 15]} className="font-bold text-emerald-700">
                GESER SELURUH WILAYAH
            </Tooltip>
        </Marker>
    );
};

const PetaAsetPage = () => {
  const { currentUser } = useAuth();
  // GANTI PENGGUNAAN HOOK DENGAN STATE MANUAL & ON SNAPSHOT
  // const { data: allAset, loading } = useFirestoreCollection('aset_desa'); 
  const [allAset, setAllAset] = useState([]);
  const [loading, setLoading] = useState(true);

  const { showNotification } = useNotification();
  const navigate = useNavigate();

  // State Koordinat
  const [punggelanCenter, setPunggelanCenter] = useState([-7.3948, 109.6432]);
  const [batasWilayahCoords, setBatasWilayahCoords] = useState([]); // Array kosong dulu
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // State Editing
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isEditingBoundary, setIsEditingBoundary] = useState(false);
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

  // 1. DATA FETCHING AMAN (FIX FIRESTORE ERROR)
  useEffect(() => {
    // Gunakan onSnapshot langsung di sini agar cleanup terjamin
    const q = query(collection(db, 'aset_desa'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllAset(data);
        setLoading(false);
      }, 
      (error) => {
        console.error("Firestore Error:", error);
        setLoading(false); // Hindari stuck loading
      }
    );

    // Cleanup function: dipanggil saat komponen unmount atau re-render
    return () => unsubscribe();
  }, []);

  // 2. LOAD CONFIG
  useEffect(() => {
    const fetchMapConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'peta_wilayah_config');
        const docSnap = await getDoc(docRef);
        
        let loadedCenter = [-7.3948, 109.6432];
        let loadedBoundary = [];

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.centerLat && data.centerLng) {
            loadedCenter = [data.centerLat, data.centerLng];
          }
          if (data.boundaryCoords && Array.isArray(data.boundaryCoords) && data.boundaryCoords.length > 2) {
             loadedBoundary = data.boundaryCoords.map(pt => [pt.lat || pt[0], pt.lng || pt[1]]);
          }
        }

        // Jika boundary kosong, generate 20 titik otomatis
        if (loadedBoundary.length === 0) {
            loadedBoundary = generateCircleCoords(loadedCenter[0], loadedCenter[1], 2.5, 20);
        }

        setPunggelanCenter(loadedCenter);
        setBatasWilayahCoords(loadedBoundary);
        setMapView(prev => ({ ...prev, center: loadedCenter }));
        setIsConfigLoaded(true);

      } catch (err) {
        console.error("Gagal memuat konfigurasi peta:", err);
        setIsConfigLoaded(true);
        // Fallback generate
        const fallbackCenter = [-7.3948, 109.6432];
        setBatasWilayahCoords(generateCircleCoords(fallbackCenter[0], fallbackCenter[1], 2.5, 20));
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
      showNotification("Gagal menyimpan lokasi: " + error.message, "error");
    }
  };

  // --- LOGIKA EDIT BATAS (20 TITIK & DRAG ALL) ---
  const startEditingBoundary = () => {
      setTempBoundaryCoords([...batasWilayahCoords]); 
      setIsEditingBoundary(true);
      setIsEditingLocation(false);
      if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleVertexDrag = (index, latLng) => {
      const newCoords = [...tempBoundaryCoords];
      newCoords[index] = [latLng.lat, latLng.lng];
      setTempBoundaryCoords(newCoords);
  };

  // Fungsi Baru: Geser Semua Titik
  const handleDragAll = (latDiff, lngDiff) => {
      const newCoords = tempBoundaryCoords.map(pt => [pt[0] + latDiff, pt[1] + lngDiff]);
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
          if (window.innerWidth >= 768) setSidebarOpen(true);
      } catch (error) {
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
      if (window.innerWidth < 768) setSidebarOpen(false);
    } else {
      showNotification(`Belum ada data lokasi aset di desa ${namaDesa}.`, "info");
    }
  };

  const stats = {
    total: filteredAset.length,
    tanah: filteredAset.filter(a => a.kategori === 'Tanah').length,
    bangunan: filteredAset.filter(a => a.kategori === 'Bangunan').length,
  };

  // [PERBAIKAN] Menggunakan Spinner biasa agar loading di area konten saja
  if (loading || !isConfigLoaded) {
    return (
        <div className="flex h-[calc(100vh-64px)] w-full justify-center items-center bg-gray-100 dark:bg-gray-900">
            <Spinner size="lg" />
        </div>
    );
  }

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

        {/* --- LAYER PETA HYBRID --- */}
        {mapMode === 'street' ? (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <>
            {/* Layer Satelit Dasar */}
            <TileLayer
              attribution='&copy; Esri World Imagery'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            {/* Layer Label/Jalan Transparan (Hybrid) */}
            <TileLayer
               url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            />
          </>
        )}

        <Polygon 
          positions={displayBoundary} 
          pathOptions={{ 
            color: '#10B981', 
            fillColor: '#10B981', 
            fillOpacity: mapMode === 'satellite' ? 0.1 : 0.05, 
            weight: isEditingBoundary ? 2 : 2, 
            dashArray: isEditingBoundary ? '5, 5' : '5, 5' 
          }} 
        >
           {!isEditingBoundary && (
               <Tooltip sticky direction="center" className="font-bold text-emerald-700 bg-transparent border-none shadow-none text-lg">
                  Wilayah Punggelan
               </Tooltip>
           )}
        </Polygon>

        {/* --- EDITOR MODE: TITIK-TITIK & HANDLE --- */}
        {isEditingBoundary && (
            <>
                {/* Vertex Markers (20 Titik Hijau) */}
                {tempBoundaryCoords.map((pos, idx) => (
                    <DraggableVertex 
                        key={`v-${idx}`} 
                        position={pos} 
                        index={idx} 
                        onDrag={handleVertexDrag} 
                    />
                ))}
                {/* Handle Tengah (Drag All) */}
                <DraggablePolygonHandle 
                    coords={tempBoundaryCoords} 
                    onDragAll={handleDragAll} 
                />
            </>
        )}

        {isEditingLocation && tempCenterLocation && (
           <Marker position={tempCenterLocation} icon={createCustomIcon('Center', 'center')}>
              <Popup>Titik Pusat Baru</Popup>
           </Marker>
        )}

        {!isEditingLocation && !isEditingBoundary && filteredAset.map((aset) => (
          <Marker
            key={aset.id}
            position={[aset.latitude, aset.longitude]}
            icon={createCustomIcon(aset.kategori, 'asset')}
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
                   <p className="font-semibold text-blue-600">{aset.kategori}</p>
                   <p>{aset.desa}</p>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => handleDetailClick(aset.id)} className="flex-1 bg-blue-600 text-white text-xs py-1 px-2 rounded hover:bg-blue-700 transition">Detail</button>
                   <a href={`https://www.google.com/maps?q=${aset.latitude},${aset.longitude}`} target="_blank" rel="noreferrer" className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs py-1 px-2 rounded text-center hover:bg-gray-50 transition">GMaps</a>
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
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[500] bg-emerald-100 border border-emerald-400 text-emerald-800 px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-lg flex flex-col items-center gap-1 animate-bounce-in w-11/12 md:w-auto justify-center text-center">
           <div className="flex items-center gap-2">
               <FiMove className="animate-bounce shrink-0" />
               <span className="text-xs md:text-sm font-bold">Mode Edit Batas Wilayah</span>
           </div>
           <span className="text-[10px] md:text-xs">Geser titik hijau (satu per satu) atau Handle Tengah (semua)</span>
        </div>
      )}

      <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur-md p-1 rounded-lg shadow-xl border border-gray-200 flex gap-1">
        <button 
          onClick={() => setMapMode('street')}
          className={`flex items-center gap-1 px-2 md:px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${mapMode === 'street' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <FiMap /> <span className="hidden md:inline">Jalan</span>
        </button>
        <button 
          onClick={() => setMapMode('satellite')}
          className={`flex items-center gap-1 px-2 md:px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${mapMode === 'satellite' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <FiLayers /> <span className="hidden md:inline">Satelit</span>
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
            <FiMap className="text-blue-600" /> GIS Aset Desa
          </h2>
          <p className="text-xs text-gray-500 mt-1">Visualisasi data aset geospasial</p>
        </div>

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
                  <button onClick={() => handleNavigasiDesa('center')} className="w-full flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 text-[10px] py-1.5 px-2 rounded transition-colors"><FiTarget /> Reset View</button>
              </div>

              <div className="bg-white p-2 rounded border border-blue-100 shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-500">BATAS WILAYAH (20 TITIK)</span>
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
                  <select onChange={(e) => handleNavigasiDesa(e.target.value)} className="w-full text-xs p-1.5 rounded border border-gray-300 focus:ring-1 focus:ring-blue-500 outline-none bg-white" defaultValue="">
                    <option value="" disabled>-- Lompat ke Desa --</option>
                    {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
              </div>
           </div>
        )}

        <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-3">
           <div className="flex items-center gap-2 text-sm font-semibold text-gray-700"><FiFilter /> Filter Data</div>
           {currentUser?.role === 'admin_kecamatan' && (
             <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Filter Tampilan Desa</label>
                <select name="desa" value={filters.desa} onChange={handleFilterChange} className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="all">Semua Desa</option>
                  {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
             </div>
           )}
           <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Kategori Aset</label>
              <select name="kategori" value={filters.kategori} onChange={handleFilterChange} className="w-full text-xs p-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="all">Semua Kategori</option>
                {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
           {selectedAsset ? (
             <div className="animate-fadeIn">
                <button onClick={() => setSelectedAsset(null)} className="mb-4 text-xs text-gray-500 flex items-center gap-1 hover:text-blue-600">← Kembali ke daftar</button>
                <div className="aspect-video w-full rounded-xl bg-gray-200 overflow-hidden mb-4 relative shadow-inner">
                   {selectedAsset.foto ? (<img src={selectedAsset.foto} alt="Aset" className="w-full h-full object-cover" />) : (<div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>)}
                   <span className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] rounded backdrop-blur-sm">{selectedAsset.kategori}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedAsset.namaAset}</h3>
                <p className="text-xs text-gray-500 mb-4">{selectedAsset.desa}</p>
                <div className="space-y-2 mb-6">
                   <InfoRow label="Kode" value={selectedAsset.kodeAset || '-'} />
                   <InfoRow label="Nilai" value={selectedAsset.nilaiAset ? `Rp ${parseInt(selectedAsset.nilaiAset).toLocaleString('id-ID')}` : '-'} />
                   <InfoRow label="Kondisi" value={selectedAsset.kondisi || '-'} />
                </div>
                <button onClick={() => handleDetailClick(selectedAsset.id)} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">Lihat Detail Lengkap</button>
             </div>
           ) : (
             <div className="space-y-3">
               <div className="text-xs text-gray-500 mb-2 flex justify-between items-center"><span>Menampilkan {filteredAset.length} aset</span></div>
               {filteredAset.length === 0 ? (<div className="text-center py-10 text-gray-400 text-sm">Tidak ada data aset di lokasi ini.</div>) : (
                  filteredAset.map(aset => (
                    <div key={aset.id} onClick={() => setSelectedAsset(aset)} className="group flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:shadow-md hover:bg-blue-50/50 cursor-pointer transition-all bg-white">
                      <div className={`w-2 h-8 rounded-full ${aset.kategori === 'Tanah' ? 'bg-emerald-500' : aset.kategori === 'Bangunan' ? 'bg-indigo-500' : 'bg-blue-500'}`}></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 text-sm truncate">{aset.namaAset}</h4>
                        <p className="text-xs text-gray-500 truncate">{aset.desa}</p>
                      </div>
                    </div>
                  ))
               )}
             </div>
           )}
        </div>
      </div>

      {!sidebarOpen && (
         <button onClick={() => setSidebarOpen(true)} className="absolute top-20 left-4 z-[400] bg-white p-2 rounded-lg shadow-lg text-blue-600 hover:bg-blue-50"><FiList className="h-6 w-6" /></button>
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