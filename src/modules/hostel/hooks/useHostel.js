import { useState, useEffect, useCallback } from 'react';
import { hostelApi } from '../api/hostelApi';

export function useHostel() {
  const [leave, setLeave]           = useState([]);
  const [outpass, setOutpass]       = useState([]);
  const [outing, setOuting]         = useState([]);
  const [rollCall, setRollCall]     = useState([]);
  const [activities, setActivities] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [lv, op, ot, rc, ac, co] = await Promise.all([
      hostelApi.getLeave(), hostelApi.getOutpass(), hostelApi.getOuting(),
      hostelApi.getRollCall(), hostelApi.getActivities(), hostelApi.getComplaints(),
    ]);
    setLeave(lv); setOutpass(op); setOuting(ot); setRollCall(rc); setActivities(ac); setComplaints(co);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveLeave       = async (r) => { await hostelApi.saveLeave(r);       setLeave(r); };
  const saveOutpass     = async (r) => { await hostelApi.saveOutpass(r);     setOutpass(r); };
  const saveOuting      = async (r) => { await hostelApi.saveOuting(r);      setOuting(r); };
  const saveRollCall    = async (r) => { await hostelApi.saveRollCall(r);    setRollCall(r); };
  const saveActivities  = async (r) => { await hostelApi.saveActivities(r);  setActivities(r); };
  const saveComplaints  = async (r) => { await hostelApi.saveComplaints(r);  setComplaints(r); };

  return { leave, outpass, outing, rollCall, activities, complaints, loading,
    saveLeave, saveOutpass, saveOuting, saveRollCall, saveActivities, saveComplaints };
}
