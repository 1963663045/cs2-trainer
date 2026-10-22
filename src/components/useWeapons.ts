import { useEffect, useState } from 'react';
import { loadWeapon, loadWeaponIndex, type WeaponData, type WeaponIndexEntry } from '../core/weapons';

export function useWeapons(initial = 'demo') {
  const [list, setList] = useState<WeaponIndexEntry[]>([]);
  const [selected, setSelected] = useState(initial);
  const [weapon, setWeapon] = useState<WeaponData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadWeaponIndex()
      .then((l) => alive && setList(l))
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const entry = list.find((w) => w.id === selected);
    if (!entry) return;
    let alive = true;
    loadWeapon(entry.file)
      .then((w) => {
        if (!alive) return;
        setWeapon(w);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [list, selected]);
  const loading = !error && (!weapon || weapon.id !== selected);
  return { list, selected, setSelected, weapon, error, loading };
}
