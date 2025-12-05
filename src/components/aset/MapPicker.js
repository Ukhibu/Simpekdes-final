import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- FIX: Masalah Icon Default Leaflet di React ---
// Leaflet memiliki bug umum di mana icon default tidak terpanggil dengan benar saat di-bundle webpack/CRA.
// Kita harus mendefinisikan ulang path icon-nya ke CDN yang stabil.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// --- Komponen Helper: LocationMarker ---
// Bertugas menangani event klik pada peta dan memindahkan marker
const LocationMarker = ({ position, setPosition, onLocationChange, viewOnly }) => {
  const map = useMap();

  // Efek: Jika props 'position' berubah dari luar (misal saat edit data), geser peta ke sana
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom(), { animate: true, duration: 1 });
    }
  }, [position, map]);

  useMapEvents({
    click(e) {
      if (viewOnly) return; // Jangan lakukan apa-apa jika mode viewOnly
      
      const newPos = e.latlng;
      setPosition(newPos);
      
      // Kirim data balik ke parent component (misal: AsetDesa.js)
      if (onLocationChange) {
        onLocationChange({ lat: newPos.lat, lng: newPos.lng });
      }
      
      // Animasi geser peta ke titik yang diklik
      map.flyTo(newPos, map.getZoom());
    },
  });

  return position ? <Marker position={position} /> : null;
};

const MapPicker = ({ initialPosition, onLocationChange, viewOnly = false }) => {
  // Koordinat Default (Kantor Desa Punggelan / Pusat Kecamatan)
  // Ganti koordinat ini sesuai pusat desa Anda agar saat peta dimuat langsung fokus ke desa.
  const defaultCenter = [-7.3948, 109.6432]; 
  
  // State lokal untuk posisi marker
  const [position, setPosition] = useState(null);

  // Inisialisasi posisi awal jika ada props 'initialPosition' (Mode Edit)
  useEffect(() => {
    if (initialPosition) {
      // Cek apakah formatnya Array [lat, lng] atau Object {lat, lng}
      if (Array.isArray(initialPosition) && initialPosition.length === 2) {
         setPosition({ lat: initialPosition[0], lng: initialPosition[1] });
      } else if (typeof initialPosition === 'object' && initialPosition.lat && initialPosition.lng) {
         setPosition(initialPosition);
      }
    }
  }, [initialPosition]);

  return (
    <div className="w-full h-[300px] rounded-lg overflow-hidden border border-gray-300 relative shadow-sm z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <LocationMarker 
          position={position} 
          setPosition={setPosition} 
          onLocationChange={onLocationChange}
          viewOnly={viewOnly}
        />
      </MapContainer>
      
      {/* Overlay Petunjuk */}
      {!viewOnly && (
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 shadow-md z-[400] pointer-events-none border border-gray-200">
           📍 Klik pada peta untuk menandai lokasi aset
        </div>
      )}
    </div>
  );
};

export default MapPicker;