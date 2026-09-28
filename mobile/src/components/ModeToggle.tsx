import { Segmented } from '@/components/ui';
import type { ScanMode } from '@/types';

const OPTIONS: { value: ScanMode; label: string }[] = [
  { value: 'batch', label: 'Batch (10–30)' },
  { value: 'single', label: 'Single onion' },
];

/** Batch / single choice. `onHero` styles it for the hero card. */
export function ModeToggle({ value, onChange, onHero }: { value: ScanMode; onChange: (m: ScanMode) => void; onHero?: boolean }) {
  return <Segmented options={OPTIONS} value={value} onChange={onChange} variant={onHero ? 'hero' : 'plain'} />;
}
