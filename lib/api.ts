export async function fetchWithFallback(url: string, opts?: RequestInit) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Return null to indicate failure to caller; caller can decide fallback
    console.error(`fetchWithFallback failed for ${url}:`, err);
    return null;
  }
}

export function samplePeople() {
  return [
    { ID: 1, neName: 'Alice Smith', neRelation: 'Sister', neCount: 5, neDateLastModified: new Date().toISOString() },
    { ID: 2, neName: 'Bob Jones', neRelation: 'Cousin', neCount: 3, neDateLastModified: new Date().toISOString() },
    { ID: 3, neName: 'Carol Lee', neRelation: 'Aunt', neCount: 2, neDateLastModified: new Date().toISOString() },
  ];
}

export function sampleEvents() {
  return [
    { ID: 1, neName: 'Birthday 2020', neRelation: '', neCount: 12, neDateLastModified: new Date().toISOString() },
    { ID: 2, neName: 'Vacation 2019', neRelation: '', neCount: 8, neDateLastModified: new Date().toISOString() },
  ];
}
