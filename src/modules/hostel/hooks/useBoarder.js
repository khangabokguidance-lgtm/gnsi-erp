import { useState, useEffect, useCallback } from 'react';
import { boarderApi } from '../api/hostelApi';

export function useBoarder() {
  const [schedule, setSchedule] = useState([]);
  const [sundaySchedule, setSundaySchedule] = useState([]);
  const [staffArrange, setStaffArrange] = useState({ lunchdinner: [], bathing: [], playtime: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, ss, sa] = await Promise.all([
      boarderApi.getSchedule(),
      boarderApi.getSundaySchedule(),
      boarderApi.getStaffArrange(),
    ]);
    setSchedule(s);
    setSundaySchedule(ss);
    setStaffArrange(sa);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSchedule        = async (rows) => { await boarderApi.saveSchedule(rows);        setSchedule(rows); };
  const saveSundaySchedule  = async (rows) => { await boarderApi.saveSundaySchedule(rows);  setSundaySchedule(rows); };
  const saveStaffArrange    = async (data) => { await boarderApi.saveStaffArrange(data);     setStaffArrange(data); };

  return { schedule, sundaySchedule, staffArrange, loading, saveSchedule, saveSundaySchedule, saveStaffArrange };
}
