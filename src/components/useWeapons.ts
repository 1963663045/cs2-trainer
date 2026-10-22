import { useEffect, useState } from 'react';
import { loadWeapon, loadWeaponIndex, type WeaponData, type WeaponIndexEntry } from '../core/weapons';

export function useWeapons(initial = 'demo') {
  const [list, setList] = useState<WeaponIndexEntry[]>([]);
  const [selected, setSelected] = useState(initial);
  const [weapon, setWeapon] = useState<WeaponData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadWeaponIndex().then(setList).catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    const entry = list.find((w) => w.id === selected);
    if (!entry) return;
    loadWeapon(entry.file).then(setWeapon).catch((e) => setError(String(e)));
  }, [list, selected]);
  return { list, selected, setSelected, weapon, error };
}
