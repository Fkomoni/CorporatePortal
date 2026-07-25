// Derives a member's geopolitical zone (South West, South East, North
// West, etc) from their selected state, using Prognosis's own
// GetRegion + GetZones lists rather than a hardcoded Nigeria zone table —
// so it always matches whatever Prognosis's own state/zone master data says.
//
// The exact way Prognosis links a region to a zone hasn't been confirmed
// from a live response yet, so this tries several plausible shapes and logs
// the raw payloads (once, first call only) so the real shape can be read
// from the logs and this can be tightened up if the guess is wrong.
let cachedMap: Map<string, string> | null = null;
let cacheExpiry = 0;

function toArr(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const key of ['result', 'data', 'Data', 'Result', 'items', 'Items']) {
      if (Array.isArray(r[key])) return r[key] as Record<string, unknown>[];
    }
    for (const v of Object.values(r)) {
      if (Array.isArray(v) && v.length > 0) return v as Record<string, unknown>[];
    }
  }
  return [];
}

async function fetchJson(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

// regionId -> zone name
export async function getRegionZoneMap(base: string, token: string): Promise<Map<string, string>> {
  if (cachedMap && Date.now() < cacheExpiry) return cachedMap;

  const map = new Map<string, string>();
  try {
    const [regionRaw, zoneRaw] = await Promise.all([
      fetchJson(`${base}/api/CorporatePortal/GetRegion`, token),
      fetchJson(`${base}/api/ListValues/GetZones`, token),
    ]);
    console.log('[geo-zone] GetRegion raw:', JSON.stringify(regionRaw)?.slice(0, 3000));
    console.log('[geo-zone] GetZones raw:', JSON.stringify(zoneRaw)?.slice(0, 3000));

    const regionRows = toArr(regionRaw);
    const zoneRows = toArr(zoneRaw);

    // Shape A: each region row already carries its own zone id/name.
    for (const r of regionRows) {
      const regionId = String(r.RegionID ?? r.regionid ?? r.Region_ID ?? r.Id ?? r.id ?? '').trim();
      const zoneName = String(r.ZoneName ?? r.Zone_Name ?? r.GeoZone ?? r.GeopoliticalZone ?? r.Zone ?? '').trim();
      if (regionId && zoneName) map.set(regionId, zoneName);
    }
    if (map.size > 0) { cachedMap = map; cacheExpiry = Date.now() + 6 * 60 * 60 * 1000; return map; }

    // Shape B: a region row references a zone by ID; resolve via GetZones.
    const zoneIdToName = new Map<string, string>();
    for (const z of zoneRows) {
      const zoneId = String(z.ZoneID ?? z.zoneid ?? z.Zone_ID ?? z.Id ?? z.id ?? '').trim();
      const zoneName = String(z.ZoneName ?? z.zonename ?? z.Zone_Name ?? z.Name ?? z.name ?? '').trim();
      if (zoneId && zoneName) zoneIdToName.set(zoneId, zoneName);
    }
    if (zoneIdToName.size > 0) {
      for (const r of regionRows) {
        const regionId = String(r.RegionID ?? r.regionid ?? r.Region_ID ?? r.Id ?? r.id ?? '').trim();
        const zoneId = String(r.ZoneID ?? r.zoneid ?? r.Zone_ID ?? '').trim();
        if (regionId && zoneId && zoneIdToName.has(zoneId)) map.set(regionId, zoneIdToName.get(zoneId)!);
      }
    }
    if (map.size > 0) { cachedMap = map; cacheExpiry = Date.now() + 6 * 60 * 60 * 1000; return map; }

    // Shape C: each zone row lists the region IDs/names that belong to it.
    for (const z of zoneRows) {
      const zoneName = String(z.ZoneName ?? z.zonename ?? z.Zone_Name ?? z.Name ?? z.name ?? '').trim();
      if (!zoneName) continue;
      const regionList = z.Regions ?? z.RegionIDs ?? z.States ?? z.StateIDs ?? z.regions ?? null;
      if (Array.isArray(regionList)) {
        for (const entry of regionList) {
          const id = String(typeof entry === 'object' && entry ? (entry as Record<string, unknown>).RegionID ?? (entry as Record<string, unknown>).Id ?? '' : entry).trim();
          if (id) map.set(id, zoneName);
        }
      }
    }
  } catch (e) {
    console.warn('[geo-zone] Failed to build region->zone map:', e);
  }

  if (map.size > 0) { cachedMap = map; cacheExpiry = Date.now() + 6 * 60 * 60 * 1000; }
  return map;
}

export async function resolveZoneForRegion(base: string, token: string, regionId: string | number | null | undefined): Promise<string | null> {
  if (regionId == null || regionId === '') return null;
  const map = await getRegionZoneMap(base, token);
  return map.get(String(regionId)) ?? null;
}
