import React from 'react';

const InputField = ({ label, name, value, onChange, type = 'text', required = false, placeholder = '', disabled = false, children, ...props }) => {
    // --- FIX: Menyempurnakan styling untuk visibilitas yang lebih baik di mode terang dan gelap ---
    const commonClasses = "mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 p-2 placeholder-gray-400 dark:placeholder-gray-500 disabled:bg-gray-200 dark:disabled:bg-gray-800";

    const renderInput = () => {
        if (type === 'select') {
            return (
                <select 
                    name={name} 
                    value={value || ''} 
                    onChange={onChange} 
                    className={commonClasses} 
                    required={required}
                    disabled={disabled}
                    {...props}
                >
                    {children}
                </select>
            );
        }
        if (type === 'textarea') {
            return (
                 <textarea
                    name={name}
                    value={value || ''}
                    onChange={onChange}
                    className={commonClasses}
                    required={required}
                    placeholder={placeholder}
                    disabled={disabled}
                    {...props}
                 />
            )
        }
        return (
            <input 
                type={type} 
                name={name} 
                value={value || ''} 
                onChange={onChange} 
                className={commonClasses} 
                required={required}
                placeholder={placeholder}
                disabled={disabled}
                {...props}
            />
        );
    };

    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </label>
            {renderInput()}
        </div>
    );
};

export default InputField;

