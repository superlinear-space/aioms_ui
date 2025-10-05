import React from 'react';
import { Input, InputNumber, Switch } from 'antd';

// Constants for styling
const STYLES = {
  input: {
    height: '40px',
    borderRadius: '8px',
    border: '2px solid #d1d5db'
  },
  inputSmall: {
    height: '36px',
    borderRadius: '6px',
    border: '1px solid #d1d5db'
  }
} as const;

interface StyledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'small';
  type?: 'text' | 'number' | 'boolean';
  value?: any;
  onChange?: (value: any) => void;
}

export const StyledInput: React.FC<StyledInputProps> = ({ 
  variant = 'default', 
  type = 'text',
  style, 
  value,
  onChange,
  ...props 
}) => {
  const inputStyle = variant === 'default' ? STYLES.input : STYLES.inputSmall;

  if (type === 'boolean') {
    return (
      <Switch
        checked={value}
        onChange={onChange}
        style={style}
      />
    );
  }

  if (type === 'number') {
    return (
      <InputNumber
        value={value}
        onChange={onChange}
        style={{
          ...inputStyle,
          width: '100%',
          ...style
        }}
        {...props}
      />
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        ...inputStyle,
        ...style
      }}
      {...props}
    />
  );
};

export default StyledInput;
