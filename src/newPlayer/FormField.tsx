import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoButton } from '@/components/InfoButton';

interface BaseFieldProps {
  label: string;
  error?: string;
  required?: boolean;
}

interface TextFieldProps extends BaseFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'date';
  maxLength?: number;
  infoTitle?: string;
  infoContent?: React.ReactNode;
}

interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: string[];
}

export const TextField: React.FC<TextFieldProps> = ({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = 'text',
  maxLength,
  required = false,
  infoTitle,
  infoContent
}) => {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {infoTitle && infoContent && (
          <InfoButton title={infoTitle}>
            {infoContent}
          </InfoButton>
        )}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  onValueChange,
  error,
  placeholder,
  options,
  required = false
}) => {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};