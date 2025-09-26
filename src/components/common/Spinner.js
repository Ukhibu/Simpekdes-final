import React from 'react';
import './Spinner.css'; // Impor file CSS baru

const Spinner = ({ size = 'md' }) => {
    // Menentukan kelas ukuran berdasarkan prop
    const sizeClasses = {
        sm: 'text-base', // 1rem
        md: 'text-2xl', // 1.5rem
        lg: 'text-4xl', // 2.25rem
    };

    return (
        <div className={`spinner-wrapper ${sizeClasses[size]}`}>
            <svg className="sp" viewBox="0 0 128 128" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#000" />
                        <stop offset="40%" stopColor="#fff" />
                        <stop offset="100%" stopColor="#fff" />
                    </linearGradient>
                    <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#000" />
                        <stop offset="60%" stopColor="#000" />
                        <stop offset="100%" stopColor="#fff" />
                    </linearGradient>
                    <mask id="mask1">
                        <rect x="0" y="0" width="128" height="128" fill="url(#grad1)" />
                    </mask>
                    <mask id="mask2">
                        <rect x="0" y="0" width="128" height="128" fill="url(#grad2)" />
                    </mask>
                </defs>
                <g fill="none" strokeLinecap="round" strokeWidth="16">
                    <circle className="sp__ring" r="56" cx="64" cy="64" />
                    {/* PERBAIKAN: Menghapus atribut 'stroke' dan menggunakan kelas CSS untuk warna dinamis */}
                    <g>
                        <path className="sp__worm1 sp-worm-color-1" d="M120,64c0,30.928-25.072,56-56,56S8,94.928,8,64" strokeDasharray="43.98 307.87" />
                        <g transform="translate(42,42)">
                            <g className="sp__worm2" transform="translate(-42,0)">
                                <path className="sp__worm2-1 sp-worm-color-2" d="M8,22c0-7.732,6.268-14,14-14s14,6.268,14,14" strokeDasharray="43.98 175.92" />
                            </g>
                        </g>
                    </g>
                    <g mask="url(#mask1)">
                        <path className="sp__worm1 sp-worm-color-3" d="M120,64c0,30.928-25.072,56-56,56S8,94.928,8,64" strokeDasharray="43.98 307.87" />
                        <g transform="translate(42,42)">
                            <g className="sp__worm2" transform="translate(-42,0)">
                                <path className="sp__worm2-1 sp-worm-color-2" d="M8,22c0-7.732,6.268-14,14-14s14,6.268,14,14" strokeDasharray="43.98 175.92" />
                            </g>
                        </g>
                    </g>
                    <g mask="url(#mask2)">
                        <path className="sp__worm1 sp-worm-color-1" d="M120,64c0,30.928-25.072,56-56,56S8,94.928,8,64" strokeDasharray="43.98 307.87" />
                        <g transform="translate(42,42)">
                            <g className="sp__worm2" transform="translate(-42,0)">
                                <path className="sp__worm2-1 sp-worm-color-2" d="M8,22c0-7.732,6.268-14,14-14s14,6.268,14,14" strokeDasharray="43.98 175.92" />
                            </g>
                        </g>
                    </g>
                </g>
            </svg>
        </div>
    );
};

export default Spinner;
