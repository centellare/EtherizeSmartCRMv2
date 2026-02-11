
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  icon?: string;
  options: { value: string; label: string; title?: string }[];
  onChange?: (e: any) => void;
}

export const Select: React.FC<SelectProps> = ({ label, icon, options, className = '', value, onChange, disabled, placeholder, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Находим выбранный объект из options
  const selectedOption = useMemo(() => 
    options.find(o => String(o.value) === String(value)), 
  [options, value]);

  // Синхронизация: если меню закрыто, показываем label выбранного значения.
  // Если значение сбросили извне, обновляем текст.
  useEffect(() => {
    if (!isOpen) {
      setSearch(selectedOption ? selectedOption.label : '');
    }
  }, [isOpen, selectedOption]);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // При закрытии без выбора возвращаем текст выбранного значения
        setSearch(selectedOption ? selectedOption.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  // ЛОГИКА ФИЛЬТРАЦИИ
  const filteredOptions = useMemo(() => {
    // 1. Если поиск пуст - показываем все
    if (!search) return options;

    // 2. ВАЖНОЕ ИСПРАВЛЕНИЕ: Если текст в поиске полностью совпадает с выбранным значением,
    // значит пользователь просто открыл список, но еще не начал искать новое.
    // В этом случае показываем ВЕСЬ список.
    if (selectedOption && search === selectedOption.label) {
      return options;
    }

    // 3. Иначе фильтруем по вхождению
    return options.filter(opt => 
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search, selectedOption]);

  const handleSelect = (option: { value: string; label: string }) => {
    if (onChange) {
      const syntheticEvent = {
        target: { value: option.value, name: props.name },
        currentTarget: { value: option.value, name: props.name },
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      onChange(syntheticEvent);
    }
    setSearch(option.label);
    setIsOpen(false);
  };

  const handleFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    // При фокусе выделяем текст, чтобы можно было сразу начать печатать поверх
    if (selectedOption) {
        inputRef.current?.select();
    }
  };

  // Очистка поля для быстрого просмотра всего списка
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearch('');
    if (onChange) {
        // Опционально: можно сбрасывать значение при очистке, 
        // но безопаснее просто показать список, а сброс оставить на выбор "Не выбрано"
        inputRef.current?.focus();
    }
    setIsOpen(true);
  };

  return (
    <div className="w-full min-w-0 relative" ref={containerRef}>
      {label && <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 truncate">{label}</label>}
      <div className="relative group">
        {icon && (
          <span className={`absolute left-4 top-1/2 -translate-y-1/2 material-icons-round transition-colors pointer-events-none z-10 ${isOpen || value ? 'text-[#005ac1]' : 'text-[#444746]'}`}>
            {icon}
          </span>
        )}
        
        <input
          ref={inputRef}
          type="text"
          readOnly={false}
          disabled={disabled}
          value={search}
          onChange={(e) => {
              setSearch(e.target.value);
              if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          placeholder={placeholder || 'Выберите...'}
          className={`w-full bg-white border rounded-xl px-4 py-3 text-base text-[#1c1b1f] outline-none transition-all truncate pr-16 leading-normal
            ${icon ? 'pl-11' : ''} 
            ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'cursor-text bg-white'}
            ${isOpen ? 'border-[#005ac1] ring-4 ring-[#005ac1]/5' : 'border-slate-200 hover:border-slate-400'}
            ${className}
          `}
          autoComplete="off"
        />

        {/* Кнопки управления справа */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
            {/* Кнопка очистки появляется, если есть текст и поле активно/выбрано */}
            {!disabled && search && (
                <button 
                    type="button"
                    onClick={handleClear}
                    className="p-1 rounded-full text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-all"
                    tabIndex={-1}
                >
                    <span className="material-icons-round text-sm block">close</span>
                </button>
            )}
            <span className={`material-icons-round text-[#444746] pointer-events-none transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#005ac1]' : ''}`}>
                expand_more
            </span>
        </div>

        {/* Выпадающий список */}
        {isOpen && !disabled && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-[9999] animate-in fade-in zoom-in-95 duration-100 scrollbar-hide">
            {filteredOptions.length > 0 ? (
              <ul className="py-1">
                {filteredOptions.map((opt) => {
                    const isSelected = String(opt.value) === String(value);
                    return (
                        <li 
                            key={opt.value}
                            onClick={() => handleSelect(opt)}
                            className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between
                                ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}
                            `}
                            title={opt.title}
                        >
                            <span className="truncate">{opt.label}</span>
                            {isSelected && <span className="material-icons-round text-sm">check</span>}
                        </li>
                    );
                })}
              </ul>
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400 italic text-center">
                Ничего не найдено
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
