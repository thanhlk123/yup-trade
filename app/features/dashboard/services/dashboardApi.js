export async function fetchTrades(tab, fetchId) {
  const res = await fetch(`/api/trades?type=${tab}&_t=${fetchId}`);
  return res.json();
}

export async function fetchStats(tab, fetchId) {
  const res = await fetch(`/api/stats?type=${tab}&_t=${fetchId}`);
  return res.json();
}

export async function fetchAccountTabs() {
  const res = await fetch('/api/account-tabs');
  return res.json();
}
