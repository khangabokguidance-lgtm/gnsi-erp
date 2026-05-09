import { useState, useEffect, useCallback } from 'react';
import { kitchenApi } from '../api/hostelApi';

export function useKitchen() {
  const [stockItems, setStockItems]   = useState([]);
  const [menuEntries, setMenuEntries] = useState([]);
  const [dailyStock, setDailyStock]   = useState([]);
  const [stockLog, setStockLog]       = useState([]);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, m, d, l] = await Promise.all([
      kitchenApi.getStockItems(), kitchenApi.getMenuEntries(),
      kitchenApi.getDailyStock(), kitchenApi.getStockLog(),
    ]);
    setStockItems(s); setMenuEntries(m); setDailyStock(d); setStockLog(l);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveStockItems  = async (items) => { await kitchenApi.saveStockItems(items);   setStockItems(items); };
  const saveMenuEntries = async (e)     => { await kitchenApi.saveMenuEntries(e);       setMenuEntries(e); };
  const saveDailyStock  = async (items) => { await kitchenApi.saveDailyStock(items);   setDailyStock(items); };
  const appendLog       = async (entry) => {
    await kitchenApi.appendStockLog(entry);
    const logs = await kitchenApi.getStockLog();
    setStockLog(logs);
  };

  return { stockItems, menuEntries, dailyStock, stockLog, loading, saveStockItems, saveMenuEntries, saveDailyStock, appendLog };
}
