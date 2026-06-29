import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { matchesWordPrefix } from '../../utils/search';
import './SearchableSelect.css';

const normalize = (value) => String(value || '').trim().toLowerCase();

const SearchableSelect = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Rechercher...',
  noOptionsText = 'Aucun resultat',
  allowCustomValue = false,
  disabled = false,
  className = '',
}) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value]
  );

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const term = normalize(query);
    if (!term) return options;

    const starts = [];
    const includes = [];

    options.forEach((opt) => {
      const label = String(opt.label || '');
      const normalizedLabel = normalize(label);
      if (matchesWordPrefix(label, term)) {
        starts.push(opt);
      } else if (normalizedLabel.includes(term)) {
        includes.push(opt);
      }
    });

    return [...starts, ...includes];
  }, [options, query]);

  const normalizedQuery = normalize(query);
  const hasExactMatch = useMemo(
    () => options.some((opt) => normalize(opt.label) === normalizedQuery),
    [options, normalizedQuery]
  );

  const canUseCustomValue = allowCustomValue && !!normalizedQuery && !hasExactMatch;

  const commitSelection = (option) => {
    if (!option) return;
    onChange?.(String(option.value), option);
    setIsOpen(false);
    setQuery('');
  };

  const onInputFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setHighlightIndex(0);
  };

  const onInputKeyDown = (event) => {
    if (!isOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((idx) => Math.min(idx + 1, filteredOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((idx) => Math.max(idx - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[highlightIndex];
      if (option) {
        commitSelection(option);
      } else if (canUseCustomValue) {
        const customValue = String(query).trim();
        commitSelection({ value: customValue, label: customValue, custom: true });
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  const inputValue = isOpen ? query : (selectedOption?.label || String(value || '') || query);

  return (
    <div ref={rootRef} className={`searchable-select ${className}`.trim()}>
      <div className={`searchable-select__control ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}>
        <Search size={14} className="searchable-select__icon" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onFocus={onInputFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightIndex(0);
            if (!e.target.value.trim()) {
              onChange?.('', null);
            }
          }}
          onKeyDown={onInputKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          className="searchable-select__toggle"
          onClick={() => {
            if (disabled) return;
            setIsOpen((v) => !v);
            inputRef.current?.focus();
          }}
          aria-label="Afficher les options"
          tabIndex={-1}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {isOpen && (
        <div className="searchable-select__menu">
          {filteredOptions.length === 0 ? (
            <div className="searchable-select__empty">{noOptionsText}</div>
          ) : (
            filteredOptions.map((opt, index) => (
              <button
                key={String(opt.value)}
                type="button"
                className={`searchable-select__option ${index === highlightIndex ? 'is-highlighted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitSelection(opt);
                }}
              >
                {opt.label}
              </button>
            ))
          )}

          {canUseCustomValue && (
            <button
              type="button"
              className="searchable-select__option searchable-select__option--create"
              onMouseDown={(e) => {
                e.preventDefault();
                const customValue = String(query).trim();
                commitSelection({ value: customValue, label: customValue, custom: true });
              }}
            >
              Utiliser "{String(query).trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
