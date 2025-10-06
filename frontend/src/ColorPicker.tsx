import React from 'react';

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorChange }) => {
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

  return (
    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
      {colors.map(color => (
        <div
          key={color}
          onClick={() => onColorChange(color)}
          style={{
            width: '30px',
            height: '30px',
            backgroundColor: color,
            border: selectedColor === color ? '2px solid #000' : '2px solid #fff',
            cursor: 'pointer'
          }}
        />
      ))}
    </div>
  );
};

export default ColorPicker;
