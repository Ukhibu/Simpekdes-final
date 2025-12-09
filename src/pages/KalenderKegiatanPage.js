import React, { useState, useMemo, useEffect } from 'react';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { FiPlus, FiChevronLeft, FiChevronRight, FiFilter, FiEdit, FiTrash2, FiEye, FiCalendar, FiClock, FiMapPin, FiAlignLeft } from 'react-icons/fi';
import { DESA_LIST } from '../utils/constants';
// Kami menghapus import '../styles/Calendar.css'; karena styling sudah digantikan oleh Tailwind CSS sepenuhnya

// Komponen baru untuk menampilkan detail kegiatan (mode lihat)
const EventDetailsView = ({ event }) => {
    if (!event) return null;

    const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                <div className="flex items-start gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-xl text-blue-600 dark:text-blue-300">
                        <FiCalendar size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-1">Nama Kegiatan</p>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{event.title}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                        <FiClock /> <span className="text-xs font-bold uppercase">Waktu Pelaksanaan</span>
                    </div>
                    <div className="pl-6 border-l-2 border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-900 dark:text-gray-200 font-semibold">Mulai: <span className="font-normal">{formatDate(event.start)}</span></p>
                        <p className="text-sm text-gray-900 dark:text-gray-200 font-semibold">Selesai: <span className="font-normal">{formatDate(event.end)}</span></p>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                        <FiMapPin /> <span className="text-xs font-bold uppercase">Lokasi</span>
                    </div>
                    <p className="text-lg font-bold text-gray-800 dark:text-white">{event.desa}</p>
                </div>
            </div>

            {event.description && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                        <FiAlignLeft /> <span className="text-xs font-bold uppercase">Deskripsi</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {event.description}
                    </p>
                </div>
            )}
        </div>
    );
};

const KalenderKegiatanPage = () => {
    const { currentUser } = useAuth();
    const { data: allEvents, loading, addItem, updateItem, deleteItem } = useFirestoreCollection('kegiatan');
    
    const [currentDate, setCurrentDate] = useState(new Date());
    const [modalMode, setModalMode] = useState(null); // 'add', 'edit', 'view'
    const [dayEventsModalOpen, setDayEventsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [filterDesa, setFilterDesa] = useState('all');

    useEffect(() => {
        if (currentUser && currentUser.role === 'admin_desa') {
            setFilterDesa(currentUser.desa);
        }
    }, [currentUser]);

    const filteredEvents = useMemo(() => {
        if (filterDesa === 'all') return allEvents;
        return allEvents.filter(event => event.desa === filterDesa);
    }, [allEvents, filterDesa]);

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    
    const handleOpenModal = (mode, event = null, date = null) => {
        setModalMode(mode);
        setSelectedEvent(event);
        
        if (mode === 'add') {
            const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : '';
            const startDate = date ? new Date(date) : new Date();
            startDate.setHours(0, 0, 0, 0);
            const formattedDate = startDate.toISOString().split('T')[0];
            setFormData({ title: '', start: formattedDate, end: formattedDate, description: '', desa: initialDesa });
        } else if (event) {
            const start = event.start.toDate ? event.start.toDate() : new Date(event.start);
            const end = event.end.toDate ? event.end.toDate() : new Date(event.end);
            setFormData({ 
                ...event, 
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            });
        }
    };

    const handleClosePrimaryModal = () => {
        if (isSubmitting) return;

        const cameFromDayList = (modalMode === 'view' || modalMode === 'edit') && selectedDate;

        setModalMode(null);
        setSelectedEvent(null);
        
        if (cameFromDayList) {
            setDayEventsModalOpen(true);
        }
    };
    
    const handleOpenEventActionModal = (mode, event) => {
        setDayEventsModalOpen(false);
        handleOpenModal(mode, event);
    };

    const handleDayClick = (date, events) => {
        setSelectedDate({ date, events });
        if (events.length > 0) {
            setDayEventsModalOpen(true);
        } else {
            handleOpenModal('add', null, date);
        }
    };
    
    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSave = { ...formData, start: new Date(formData.start), end: new Date(formData.end) };
            if (selectedEvent) {
                await updateItem(selectedEvent.id, dataToSave);
            } else {
                await addItem(dataToSave);
            }
            handleClosePrimaryModal();
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = (event) => {
        setEventToDelete(event);
        setIsDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!eventToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteItem(eventToDelete.id);
            setDayEventsModalOpen(false); 
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setEventToDelete(null);
        }
    };

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const grid = [];
        let dayCounter = 1;
        
        for (let i = 0; i < 6; i++) {
            const week = [];
            for (let j = 0; j < 7; j++) {
                if ((i === 0 && j < firstDayOfMonth) || dayCounter > daysInMonth) {
                    week.push({ key: `empty-${i}-${j}`, empty: true });
                } else {
                    const date = new Date(year, month, dayCounter);
                    date.setHours(0,0,0,0);
                    const dayEvents = filteredEvents.filter(e => {
                        const eventStart = e.start.toDate ? e.start.toDate() : new Date(e.start);
                        const eventEnd = e.end.toDate ? e.end.toDate() : new Date(e.end);
                        eventStart.setHours(0,0,0,0);
                        eventEnd.setHours(0,0,0,0);
                        return date >= eventStart && date <= eventEnd;
                    });
                    
                    week.push({ key: `day-${dayCounter}`, day: dayCounter, date: date, events: dayEvents });
                    dayCounter++;
                }
            }
            grid.push(week);
            if (dayCounter > daysInMonth) break;
        }
        return grid;
    }, [currentDate, filteredEvents]);

    const today = new Date();
    today.setHours(0,0,0,0);

    const getModalTitle = () => {
        if (modalMode === 'view') return "Detail Kegiatan";
        if (modalMode === 'edit') return "Edit Kegiatan";
        if (modalMode === 'add') return "Tambah Kegiatan";
        return "";
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 transition-colors duration-300 pb-24 animate-fade-in-down">
            
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-6">
                <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-2xl border border-gray-200 dark:border-gray-600">
                    <button onClick={handlePrevMonth} className="p-3 rounded-xl hover:bg-white dark:hover:bg-gray-600 shadow-sm text-gray-600 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
                        <FiChevronLeft size={20} />
                    </button>
                    <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 w-40 text-center uppercase tracking-wide">
                        {currentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                    </h1>
                    <button onClick={handleNextMonth} className="p-3 rounded-xl hover:bg-white dark:hover:bg-gray-600 shadow-sm text-gray-600 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
                        <FiChevronRight size={20} />
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="w-full sm:w-48">
                            <InputField type="select" value={filterDesa} onChange={e => setFilterDesa(e.target.value)} icon={<FiFilter />}>
                                <option value="all">Semua Desa</option>
                                {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                            </InputField>
                        </div>
                    )}
                    <Button onClick={() => handleOpenModal('add', null, new Date())} variant="primary" className="shadow-lg shadow-blue-500/20">
                        <FiPlus className="mr-2"/> <span className="hidden sm:inline">Kegiatan Baru</span><span className="sm:hidden">Baru</span>
                    </Button>
                </div>
            </div>
            
            {loading ? <Spinner /> : (
                 <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                    {/* Calendar Header */}
                    <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day, idx) => (
                            <div key={day} className={`py-4 text-center text-xs font-bold uppercase tracking-wider ${idx === 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Body */}
                    <div className="grid grid-cols-7 auto-rows-fr bg-white dark:bg-gray-800">
                        {calendarGrid.flat().map((cell, idx) => {
                            const isToday = !cell.empty && cell.date.getTime() === today.getTime();
                            const isSunday = idx % 7 === 0;
                            
                            if (cell.empty) {
                                return <div key={cell.key} className="min-h-[80px] md:min-h-[120px] bg-gray-50/30 dark:bg-gray-800/30 border-b border-r border-gray-100 dark:border-gray-700/50 last:border-r-0"></div>;
                            }

                            return (
                                <div 
                                    key={cell.key} 
                                    className={`
                                        group relative min-h-[80px] md:min-h-[120px] p-2 border-b border-r border-gray-100 dark:border-gray-700 cursor-pointer transition-colors duration-200
                                        hover:bg-blue-50/50 dark:hover:bg-blue-900/10
                                        ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}
                                    `}
                                    onClick={() => handleDayClick(cell.date, cell.events)}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`
                                            flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold transition-transform
                                            ${isToday 
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-110' 
                                                : isSunday ? 'text-red-500 group-hover:scale-110' : 'text-gray-700 dark:text-gray-300 group-hover:scale-110'}
                                        `}>
                                            {cell.day}
                                        </span>
                                        {cell.events.length > 0 && (
                                            <span className="md:hidden flex h-2 w-2 bg-blue-500 rounded-full mt-1 mr-1"></span>
                                        )}
                                    </div>

                                    <div className="mt-1 space-y-1">
                                        {cell.events.slice(0, 3).map(event => (
                                            <div 
                                                key={event.id} 
                                                className="hidden md:block px-2 py-1 text-[10px] font-medium rounded-md truncate bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:brightness-95 transition-all"
                                                title={`${event.title} (${event.desa})`}
                                            >
                                                {event.title}
                                            </div>
                                        ))}
                                        {cell.events.length > 3 && (
                                            <div className="hidden md:block text-[10px] text-gray-400 dark:text-gray-500 font-medium pl-1">
                                                +{cell.events.length - 3} lainnya
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                 </div>
            )}

            {/* Modal untuk Add/Edit/View */}
            <Modal isOpen={!!modalMode} onClose={handleClosePrimaryModal} title={getModalTitle()}>
                {modalMode === 'view' ? (
                    <EventDetailsView event={selectedEvent} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-5">
                        <InputField label="Nama Kegiatan" name="title" value={formData.title || ''} onChange={handleFormChange} required placeholder="Contoh: Musyawarah Desa" />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tanggal Mulai</label>
                                <input type="date" name="start" value={formData.start || ''} onChange={handleFormChange} required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tanggal Selesai</label>
                                <input type="date" name="end" value={formData.end || ''} onChange={handleFormChange} required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"/>
                            </div>
                        </div>
                        
                        <InputField label="Deskripsi (Opsional)" name="description" type="textarea" value={formData.description || ''} onChange={handleFormChange} rows="4" placeholder="Tambahkan detail kegiatan..." />
                        
                        {currentUser?.role === 'admin_kecamatan' && (
                            <InputField label="Desa" name="desa" type="select" value={formData.desa || ''} onChange={handleFormChange} required>
                                <option value="">Pilih Desa</option>
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                            </InputField>
                        )}
                        
                        <div className="flex justify-end pt-6 border-t dark:border-gray-700 gap-3">
                            <Button type="button" variant="secondary" onClick={handleClosePrimaryModal} disabled={isSubmitting}>Batal</Button>
                            <Button type="submit" variant="primary" isLoading={isSubmitting} className="shadow-lg shadow-blue-500/20">{selectedEvent ? "Simpan Perubahan" : "Simpan"}</Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Modal untuk Daftar Kegiatan per Hari */}
            <Modal isOpen={dayEventsModalOpen} onClose={() => setDayEventsModalOpen(false)} title={`Kegiatan: ${selectedDate?.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}`}>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                    {selectedDate?.events.map(event => (
                        <div key={event.id} className="group p-4 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl shadow-sm hover:shadow-md transition-all flex justify-between items-center gap-4">
                            <div className="flex-1">
                                <p className="font-bold text-gray-800 dark:text-gray-100 text-lg">{event.title}</p>
                                {currentUser.role === 'admin_kecamatan' && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-semibold">
                                            {event.desa}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenEventActionModal('view', event)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors" title="Lihat Detail"><FiEye size={18}/></button>
                                <button onClick={() => handleOpenEventActionModal('edit', event)} className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors" title="Edit"><FiEdit size={18}/></button>
                                <button onClick={() => confirmDelete(event)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:bg-gray-600 rounded-lg transition-colors" title="Hapus"><FiTrash2 size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="mt-6 pt-4 border-t dark:border-gray-700">
                    <Button onClick={() => { setDayEventsModalOpen(false); handleOpenModal('add', null, selectedDate?.date); }} variant="primary" className="w-full shadow-md">
                        <FiPlus className="mr-2"/> Tambah Kegiatan Baru
                    </Button>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={executeDelete}
                isLoading={isSubmitting}
                title="Konfirmasi Hapus"
                message={`Anda yakin ingin menghapus kegiatan "${eventToDelete?.title}"?`}
                variant="danger"
            />
            
            {/* Styles for Scrollbar */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(156, 163, 175, 0.5);
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(107, 114, 128, 0.8);
                }
            `}</style>
        </div>
    );
};

export default KalenderKegiatanPage;