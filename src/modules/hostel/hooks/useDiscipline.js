import { useState, useEffect, useCallback } from 'react';
import { disciplineApi } from '../api/hostelApi';

export function useDiscipline() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setRecords(await disciplineApi.getRecords());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save        = async (rows) => { await disciplineApi.saveRecords(rows); setRecords(rows); };
  const addRecord   = async (rec)  => {
    const id = records.length ? Math.max(...records.map(r => r.id)) + 1 : 1;
    await save([...records, { id, ...rec }]);
  };
  const deleteRecord = async (id) => { await save(records.filter(r => r.id !== id)); };

  return { records, loading, addRecord, deleteRecord };
}
