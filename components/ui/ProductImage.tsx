
import React, { useState } from 'react';

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  preview?: boolean; // Если true, открывает оригинал по клику
}

export const ProductImage: React.FC<ProductImageProps> = ({ src, alt, className = "w-10 h-10", preview = false }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || error) {
    return (
      <div className={`bg-slate-100 flex items-center justify-center text-slate-300 rounded-lg border border-slate-200 ${className}`} title={alt}>
        <span className="material-icons-round text-sm">image</span>
      </div>
    );
  }

  const handlePreview = (e: React.MouseEvent) => {
    if (preview) {
        e.stopPropagation();
        window.open(src, '_blank');
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
        {!loaded && (
            <div className="absolute inset-0 bg-slate-50 animate-pulse"></div>
        )}
        <img 
            src={src} 
            alt={alt || 'Product'} 
            className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${preview ? 'cursor-zoom-in' : ''}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            onClick={handlePreview}
        />
    </div>
  );
};
