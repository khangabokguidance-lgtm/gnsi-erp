import { useState, useEffect, useCallback } from 'react';
import { nightDutyApi } from '../api/hostelApi';

export function useNightDuty() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setRecords(await nightDutyApi.getRecords());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save         = async (rows) => { await nightDutyApi.saveRecords(rows); setRecords(rows); };
  const addRecord    = async (rec)  => {
    const id = records.length ? Math.max(...records.map(r => r.id)) + 1 : 1;
    await save([...records, { id, ...rec }]);
  };
  const updateRecord = async (id, patch) => { await save(records.map(r => r.id === id ? { ...r, ...patch } : r)); };
  const deleteRecord = async (id)        => { await save(records.filter(r => r.id !== id)); };

  return { records, loading, addRecord, updateRecord, deleteRecord };
}
