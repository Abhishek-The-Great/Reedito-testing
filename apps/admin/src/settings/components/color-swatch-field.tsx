import { type ColorSwatchOption, ColorSwatchRow } from '@reedito/shade/patterns';
import { Stack, Text } from '@reedito/shade/primitives';
import type { ReactNode } from 'react';

export interface ColorSwatchFieldProps {
  title?: ReactNode;
  value?: string | null;
  swatches: ColorSwatchOption[];
  size?: 'md' | 'lg';
  onChange: (value: string | null) => void;
}

const ColorSwatchField = ({
  title,
  value,
  swatches,
  size = 'md',
  onChange,
}: ColorSwatchFieldProps) => (
  <Stack gap="sm">
    {title && <Text weight="semibold">{title}</Text>}
    <ColorSwatchRow size={size} swatches={swatches} value={value} onSelect={onChange} />
  </Stack>
);

export default ColorSwatchField;
