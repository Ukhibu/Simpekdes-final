import React, { useState, useMemo } from 'react';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { FiPlus, FiCalendar, FiChevronLeft, FiChevronRight, FiEdit, FiTrash2 } from 'react-icons/fi';
import '../styles/Calendar.css';

const KalenderKegiatanPage = () => {
    const { currentUser } = useAuth();
    // Menggunakan hook untuk mengambil data, diurutkan berdasarkan tanggal mulai
    const { data: events, loading, addItem, updateItem, deleteItem } = useFirestoreCollection('kegiatan', 100, 'start', 'asc');

    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleOpenModal = (event = null, date = null) => {
        setSelectedEvent(event);
        if (event) {
            setFormData({ ...event });
        } else {
            const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : '';
            // Menggunakan tanggal yang diklik atau hari ini sebagai default
            const startDate = date ? new Date(date) : new Date();
            startDate.setHours(0, 0, 0, 0); // Reset waktu ke awal hari
            const formattedDate = startDate.toISOString().split('T')[0];
            setFormData({ title: '', start: formattedDate, end: formattedDate, description: '', desa: initialDesa });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setSelectedEvent(null);
        setFormData({});
    };
    
    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (selectedEvent) {
                await updateItem(selectedEvent.id, formData);
            } else {
                await addItem(formData);
            }
            handleCloseModal();
        } catch (error) {
            // Notifikasi error sudah ditangani oleh hook
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
        } catch (error) {
            // Notifikasi error ditangani hook
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
                    const dateString = date.toISOString().split('T')[0];
                    const dayEvents = events.filter(e => {
                        const eventStart = new Date(e.start);
                        const eventEnd = new Date(e.end);
                        return date >= eventStart && date <= eventEnd;
                    });
                    
                    week.push({
                        key: `day-${dayCounter}`,
                        day: dayCounter,
                        date: date,
                        events: dayEvents,
                    });
                    dayCounter++;
                }
            }
            grid.push(week);
            if (dayCounter > daysInMonth) break;
        }
        return grid;
    }, [currentDate, events]);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                    <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><FiChevronLeft size={24} /></button>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        {currentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                    </h1>
                    <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><FiChevronRight size={24} /></button>
                </div>
                <Button onClick={() => handleOpenModal()} variant="primary">
                    <FiPlus className="mr-2"/> Tambah Kegiatan
                </Button>
            </div>
            
            {loading ? <Spinner /> : (
                 <div className="calendar-grid">
                    <div className="calendar-header">Sun</div>
                    <div className="calendar-header">Mon</div>
                    <div className="calendar-header">Tue</div>
                    <div className="calendar-header">Wed</div>
                    <div className="calendar-header">Thu</div>
                    <div className="calendar-header">Fri</div>
                    <div className="calendar-header">Sat</div>
                    {calendarGrid.flat().map(cell => (
                        cell.empty ? <div key={cell.key} className="calendar-day empty"></div> : (
                            <div key={cell.key} className="calendar-day" onClick={() => handleOpenModal(null, cell.date)}>
                                <span className="day-number">{cell.day}</span>
                                <div className="events-container">
                                    {cell.events.map(event => (
                                        <div key={event.id} className="event-item" onClick={(e) => { e.stopPropagation(); handleOpenModal(event); }}>
                                            {event.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    ))}
                 </div>
            )}
            
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedEvent ? "Edit Kegiatan" : "Tambah Kegiatan"}>
                 <form onSubmit={handleFormSubmit} className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Kegiatan</label>
                        <input type="text" name="title" value={formData.title || ''} onChange={handleFormChange} className="form-input-modern" required />
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Mulai</label>
                            <input type="date" name="start" value={formData.start || ''} onChange={handleFormChange} className="form-input-modern" required />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Selesai</label>
                            <input type="date" name="end" value={formData.end || ''} onChange={handleFormChange} className="form-input-modern" required />
                         </div>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi (Opsional)</label>
                        <textarea name="description" value={formData.description || ''} onChange={handleFormChange} className="form-input-modern" rows="3"></textarea>
                     </div>
                     {currentUser?.role === 'admin_kecamatan' && (
                         <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Desa</label>
                             <select name="desa" value={formData.desa || ''} onChange={handleFormChange} className="form-input-modern" required>
                                <option value="">Pilih Desa</option>
                                {/* Anda mungkin perlu daftar desa statis di sini */}
                                <option value="Punggelan">Punggelan</option>
                                <option value="Karangsari">Karangsari</option>
                                {/* Tambahkan desa lainnya */}
                             </select>
                         </div>
                     )}
                     <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
                        <div>
                        {selectedEvent && (
                             <Button type="button" variant="danger" onClick={() => confirmDelete(selectedEvent)} disabled={isSubmitting}><FiTrash2 className="mr-2" /> Hapus</Button>
                        )}
                        </div>
                        <div className="flex gap-2">
                             <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                             <Button type="submit" variant="primary" isLoading={isSubmitting}>{selectedEvent ? "Simpan Perubahan" : "Simpan"}</Button>
                        </div>
                     </div>
                 </form>
            </Modal>

            {eventToDelete && (
                 <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Konfirmasi Hapus">
                    <p>Anda yakin ingin menghapus kegiatan "{eventToDelete.title}"?</p>
                    <div className="flex justify-end gap-4 mt-6">
                        <Button variant="secondary" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isSubmitting}>Batal</Button>
                        <Button variant="danger" onClick={executeDelete} isLoading={isSubmitting}>Hapus</Button>
                    </div>
                 </Modal>
            )}
        </div>
    );
};

export default KalenderKegiatanPage;

