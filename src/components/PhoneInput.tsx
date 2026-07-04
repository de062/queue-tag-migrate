'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface CountryData {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  minLength: number;
  maxLength: number;
  placeholder: string;
}

export const COUNTRIES: CountryData[] = [
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳', minLength: 10, maxLength: 10, placeholder: '98765 43210' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸', minLength: 10, maxLength: 10, placeholder: '(555) 000-0000' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦', minLength: 10, maxLength: 10, placeholder: '(555) 000-0000' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧', minLength: 9, maxLength: 10, placeholder: '7000 000000' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺', minLength: 9, maxLength: 9, placeholder: '400 000 000' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪', minLength: 10, maxLength: 11, placeholder: '151 00000000' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷', minLength: 9, maxLength: 9, placeholder: '6 00 00 00 00' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬', minLength: 8, maxLength: 8, placeholder: '8000 0000' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪', minLength: 9, maxLength: 9, placeholder: '50 000 0000' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵', minLength: 10, maxLength: 10, placeholder: '90-0000-0000' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦', minLength: 9, maxLength: 9, placeholder: '82 000 0000' },
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷', minLength: 10, maxLength: 11, placeholder: '11 90000-0000' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function PhoneInput({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  style
}: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData>(COUNTRIES[0]);
  const [localNumber, setLocalNumber] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse initial value (E.164 formatted string like "+14155552671")
  useEffect(() => {
    if (!value) {
      setLocalNumber('');
      return;
    }
    
    // Sort COUNTRIES by dialCode length descending to match longest dialCodes first (e.g. +971 before +9)
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    const matched = sorted.find(c => value.startsWith(c.dialCode));
    
    if (matched) {
      setSelectedCountry(matched);
      const digits = value.slice(matched.dialCode.length).replace(/\D/g, '');
      setLocalNumber(digits);
    } else {
      // Fallback
      setLocalNumber(value.replace(/\D/g, ''));
    }
  }, [value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const validateAndTriggerChange = (num: string, country: CountryData) => {
    const digitsOnly = num.replace(/\D/g, '');
    const isValid = digitsOnly.length >= country.minLength && digitsOnly.length <= country.maxLength;
    const e164 = digitsOnly ? `${country.dialCode}${digitsOnly}` : '';
    onChange(e164, isValid);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    // Allow only digits
    const digits = inputVal.replace(/\D/g, '');
    
    // Truncate to maximum length of the country
    const truncated = digits.slice(0, selectedCountry.maxLength);
    setLocalNumber(truncated);
    validateAndTriggerChange(truncated, selectedCountry);
  };

  const handleCountrySelect = (country: CountryData) => {
    setSelectedCountry(country);
    setIsOpen(false);
    validateAndTriggerChange(localNumber, country);
  };

  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', ...style }}>
      {/* Country Selector Dropdown Trigger */}
      <div ref={dropdownRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 12px',
            border: '1px solid #cbd5e1',
            borderRight: 'none',
            borderTopLeftRadius: '8px',
            borderBottomLeftRadius: '8px',
            background: '#f8fafc',
            cursor: disabled ? 'not-allowed' : 'pointer',
            height: '38px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#0f172a',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        >
          <span style={{ fontSize: '16px' }}>{selectedCountry.flag}</span>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{selectedCountry.dialCode}</span>
          <ChevronDown style={{ width: '12px', height: '12px', color: '#64748b' }} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '40px',
            left: 0,
            width: '260px',
            maxHeight: '200px',
            overflowY: 'auto',
            background: 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            zIndex: 99999,
            padding: '4px 0'
          }}>
            {COUNTRIES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => handleCountrySelect(country)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: selectedCountry.code === country.code ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  color: '#0f172a',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={(e) => {
                  if (selectedCountry.code !== country.code) {
                    e.currentTarget.style.background = '#f1f5f9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCountry.code !== country.code) {
                    e.currentTarget.style.background = 'white';
                  }
                }}
              >
                <span style={{ fontSize: '16px' }}>{country.flag}</span>
                <span style={{ fontWeight: 500, flex: 1 }}>{country.name}</span>
                <span style={{ color: '#64748b' }}>{country.dialCode}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actual Phone Input field */}
      <input
        type="tel"
        disabled={disabled}
        required={required}
        placeholder={placeholder || selectedCountry.placeholder}
        value={localNumber}
        onChange={handleInputChange}
        style={{
          flex: 1,
          padding: '10px 14px',
          border: '1px solid #cbd5e1',
          borderTopRightRadius: '8px',
          borderBottomRightRadius: '8px',
          fontSize: '16px',
          color: '#0f172a',
          outline: 'none',
          boxSizing: 'border-box',
          height: '38px'
        }}
      />
    </div>
  );
}
