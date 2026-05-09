import { useState, useEffect, useCallback } from 'react';
import { houseApi } from '../api/hostelApi';

export function useHouse() {
  const [points, setPoints]           = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [behaviour, setBehaviour]     = useState([]);
  const [health, setHealth]           = useState([]);
  const [academic, setAcademic]       = useState([]);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, m, b, h, a] = await Promise.all([
      houseApi.getPoints(), houseApi.getMaintenance(),
      houseApi.getBehaviour(), houseApi.getHealth(), houseApi.getAcademic(),
    ]);
    setPoints(p); setMaintenance(m); setBehaviour(b); setHealth(h); setAcademic(a);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const savePoints      = async (r) => { await houseApi.savePoints(r);      setPoints(r); };
  const saveMaintenance = async (r) => { await houseApi.saveMaintenance(r); setMaintenance(r); };
  const saveBehaviour   = async (r) => { await houseApi.saveBehaviour(r);   setBehaviour(r); };
  const saveHealth      = async (r) => { await houseApi.saveHealth(r);      setHealth(r); };
  const saveAcademic    = async (r) => { await houseApi.saveAcademic(r);    setAcademic(r); };

  return { points, maintenance, behaviour, health, academic, loading,
    savePoints, saveMaintenance, saveBehaviour, saveHealth, saveAcademic };
}
