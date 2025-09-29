import React, { useEffect, useRef } from 'react';

const MapPicker = ({ initialPosition, onLocationChange, viewOnly = false }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null); // Ref untuk menyimpan instance peta
    const markerRef = useRef(null); // Ref untuk menyimpan instance marker
    const onLocationChangeRef = useRef(onLocationChange); // Ref untuk fungsi callback

    // Selalu update ref callback jika prop berubah
    useEffect(() => {
        onLocationChangeRef.current = onLocationChange;
    }, [onLocationChange]);

    // --- Efek untuk inisialisasi dan penghancuran peta (HANYA SEKALI) ---
    useEffect(() => {
        if (!window.L || !mapRef.current || mapInstanceRef.current) {
            return; // Jangan lakukan apa-apa jika Leaflet belum siap, ref null, atau peta sudah ada
        }
        
        const punggelanCenter = [-7.279, 109.489];
        const map = window.L.map(mapRef.current).setView(initialPosition || punggelanCenter, 14);
        mapInstanceRef.current = map;

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Handler klik pada peta (hanya jika tidak view-only)
        if (!viewOnly) {
            map.on('click', (e) => {
                const { lat, lng } = e.latlng;
                
                if (!markerRef.current) {
                     const defaultIcon = window.L.icon({
                        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                    });
                    markerRef.current = window.L.marker([lat, lng], { icon: defaultIcon }).addTo(map);
                } else {
                    markerRef.current.setLatLng([lat, lng]);
                }
                
                map.panTo([lat, lng]);
                
                // Panggil callback menggunakan ref
                if (onLocationChangeRef.current) {
                    onLocationChangeRef.current({ lat, lng });
                }
            });
        }
        
        // Cleanup function: akan dipanggil saat komponen dilepas (unmount)
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [viewOnly, initialPosition]); // Hanya bergantung pada viewOnly dan initialPosition saat pertama kali dibuat

    // --- Efek untuk MEMPERBARUI marker saat initialPosition berubah ---
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return; // Jangan lakukan apa-apa jika peta belum siap

        if (initialPosition) {
            const [lat, lng] = initialPosition;
            if (!markerRef.current) {
                 const defaultIcon = window.L.icon({
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                });
                markerRef.current = window.L.marker([lat, lng], { icon: defaultIcon }).addTo(map);
            } else {
                markerRef.current.setLatLng([lat, lng]);
            }
            map.setView([lat, lng], map.getZoom()); // Pusatkan peta ke marker
        } else {
            // Jika tidak ada initialPosition (misal saat reset form), hapus marker
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
        }
    }, [initialPosition]);


    return (
        <div>
            <div ref={mapRef} style={{ height: '300px', width: '100%', borderRadius: '8px', zIndex: 0 }}></div>
            {!viewOnly && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Klik pada peta untuk menandai atau mengubah lokasi aset.
                </p>
            )}
        </div>
    );
};

export default MapPicker;

