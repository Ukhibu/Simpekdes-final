import React from 'react';
import Spinner from './Spinner';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  isLoading = false,
  className = '',
}) => {
  const baseClasses = 'btn';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    success: 'btn-success',
    warning: 'btn-warning',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" color="white" />
          <span className="ml-2">Memproses...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;

