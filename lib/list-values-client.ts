'use client';

// Shared client-side accessor for /api/hr/list-values.
//
// Three separate components on the People page each need a slice of this
// payload (policy year start, gender/marital/state/region options,
// relationships). They used to fetch the same endpoint independently, so one
// page load made three identical round-trips. Memoising the promise means the
// first caller starts the request and the rest await it — one request per page
// load, whoever asks first.
//
// The server route is itself cached for 24 hours, so this is purely about
// removing duplicate browser round-trips.

import type {
  RelationshipOption, GenderOption, MaritalOption, StateOption, RegionOption,
} from '@/app/api/hr/list-values/route';

export interface ListValuesPayload {
  policyYearStart?: string;
  genders?: GenderOption[];
  maritalStatuses?: MaritalOption[];
  states?: StateOption[];
  regions?: RegionOption[];
  relationships?: RelationshipOption[];
}

let inFlight: Promise<ListValuesPayload> | null = null;

export function fetchListValues(): Promise<ListValuesPayload> {
  if (!inFlight) {
    inFlight = fetch('/api/hr/list-values')
      .then((r) => r.json())
      .then((d) => (d && typeof d === 'object' ? (d as ListValuesPayload) : {}))
      .catch(() => {
        // Let the next caller retry rather than caching a failure forever.
        inFlight = null;
        return {} as ListValuesPayload;
      });
  }
  return inFlight;
}
