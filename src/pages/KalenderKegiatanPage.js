import React, { useState, useMemo, useEffect } from 'react';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { FiPlus, FiChevronLeft, FiChevronRight, FiFilter, FiEdit, FiTrash2, FiEye, FiCalendar } from 'react-icons/fi';
import { DESA_LIST } from '../utils/constants';
import '../styles/Calendar.css';

// Komponen baru untuk menampilkan detail kegiatan (mode lihat)
const EventDetailsView = ({ event }) => {
    if (!event) return null;

    const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div className="space-y-4 text-sm">
            <div className="pb-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Nama Kegiatan</p>
                <p className="font-semibold text-lg text-gray-800 dark:text-gray-200">{event.title}</p>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 dark:border-gray-700">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal Mulai</p>
                    <p className="text-gray-700 dark:text-gray-300">{formatDate(event.start)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal Selesai</p>
                    <p className="text-gray-700 dark:text-gray-300">{formatDate(event.end)}</p>
                </div>
            </div>
             <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Desa</p>
                <p className="text-gray-700 dark:text-gray-300">{event.desa}</p>
            </div>
            {event.description && (
                 <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Deskripsi</p>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p>
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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div className="flex items-center space-x-2">
                    <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><FiChevronLeft size={24} /></button>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 w-48 text-center">
                        {currentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                    </h1>
                    <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><FiChevronRight size={24} /></button>
                </div>
                <div className="flex items-center gap-4">
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField type="select" value={filterDesa} onChange={e => setFilterDesa(e.target.value)} icon={<FiFilter />}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                    <Button onClick={() => handleOpenModal('add', null, new Date())} variant="primary">
                        <FiPlus className="mr-2"/> Tambah Kegiatan
                    </Button>
                </div>
            </div>
            
            {loading ? <Spinner /> : (
                 <div className="calendar-grid">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => <div key={day} className="calendar-header">{day}</div>)}
                    {calendarGrid.flat().map(cell => {
                        const isToday = !cell.empty && cell.date.getTime() === today.getTime();
                        return cell.empty ? <div key={cell.key} className="calendar-day empty"></div> : (
                            <div key={cell.key} className={`calendar-day ${isToday ? 'today' : ''}`} onClick={() => handleDayClick(cell.date, cell.events)}>
                                <span className="day-number">{cell.day}</span>
                                <div className="events-container">
                                    {cell.events.slice(0, 3).map(event => (
                                        <div key={event.id} className="event-item">
                                            {event.title}
                                            {currentUser.role === 'admin_kecamatan' && <span className="event-desa"> - {event.desa}</span>}
                                        </div>
                                    ))}
                                    {cell.events.length > 3 && <div className="event-more">+{cell.events.length - 3} lainnya</div>}
                                </div>
                            </div>
                        )
                    })}
                 </div>
            )}

            {/* Modal untuk Add/Edit/View */}
            <Modal isOpen={!!modalMode} onClose={handleClosePrimaryModal} title={getModalTitle()}>
                {modalMode === 'view' ? (
                    <EventDetailsView event={selectedEvent} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <InputField label="Nama Kegiatan" name="title" value={formData.title || ''} onChange={handleFormChange} required />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Tanggal Mulai" name="start" type="date" value={formData.start || ''} onChange={handleFormChange} required />
                            <InputField label="Tanggal Selesai" name="end" type="date" value={formData.end || ''} onChange={handleFormChange} required />
                        </div>
                        <InputField label="Deskripsi (Opsional)" name="description" type="textarea" value={formData.description || ''} onChange={handleFormChange} rows="3" />
                        {currentUser?.role === 'admin_kecamatan' && (
                            <InputField label="Desa" name="desa" type="select" value={formData.desa || ''} onChange={handleFormChange} required>
                                <option value="">Pilih Desa</option>
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                            </InputField>
                        )}
                        <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
                            <Button type="button" variant="secondary" onClick={handleClosePrimaryModal} disabled={isSubmitting}>Batal</Button>
                            <Button type="submit" variant="primary" isLoading={isSubmitting}>{selectedEvent ? "Simpan Perubahan" : "Simpan"}</Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Modal untuk Daftar Kegiatan per Hari */}
            <Modal isOpen={dayEventsModalOpen} onClose={() => setDayEventsModalOpen(false)} title={`Kegiatan pada ${selectedDate?.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}`}>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {selectedDate?.events.map(event => (
                        <div key={event.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">{event.title}</p>
                                {currentUser.role === 'admin_kecamatan' && <p className="text-xs text-gray-500 dark:text-gray-400">{event.desa}</p>}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => handleOpenEventActionModal('view', event)}><FiEye/></Button>
                                <Button variant="primary" onClick={() => handleOpenEventActionModal('edit', event)}><FiEdit/></Button>
                                <Button variant="danger" onClick={() => confirmDelete(event)}><FiTrash2/></Button>
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="mt-4 pt-4 border-t dark:border-gray-700">
                    <Button onClick={() => { setDayEventsModalOpen(false); handleOpenModal('add', null, selectedDate?.date); }} variant="primary" className="w-full">
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
            />
        </div>
    );
};

export default KalenderKegiatanPage;

