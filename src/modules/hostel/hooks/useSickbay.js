import { useState, useEffect, useCallback } from 'react';
import { sickbayApi } from '../api/hostelApi';

export function useSickbay() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setRecords(await sickbayApi.getRecords());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save         = async (rows) => { await sickbayApi.saveRecords(rows); setRecords(rows); };
  const admit        = async (rec)  => {
    const id = records.length ? Math.max(...records.map(r => r.id)) + 1 : 1;
    await save([...records, { id, ...rec }]);
  };
  const discharge    = async (id, remarks) => {
    const d = new Date().toISOString().split('T')[0];
    await save(records.map(r => r.id === id ? { ...r, status: 'Discharged', dischargedOn: d, dischargeRemarks: remarks } : r));
  };
  const deleteRecord = async (id) => { await save(records.filter(r => r.id !== id)); };

  return { records, loading, admit, discharge, deleteRecord };
}
