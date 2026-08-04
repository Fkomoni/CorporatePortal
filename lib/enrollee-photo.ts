// Resolves a member's passport photo out of a GetEnrolleeBioDataByEnrolleeID
// response. Shared so the HR Member 360 card and the self-service e-ID card
// resolve photos identically.
//
// Two things make this fiddly, both learned from real responses:
//  - profilepic/picturetype are siblings of `result` on the top-level object,
//    NOT fields inside the row, so the top level has to be checked first.
//  - picturetype comes back as a bare "jpeg", but clients build
//    `data:${photoType};base64,...`, so it needs an image/ prefix.
function str(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

export interface ResolvedPhoto {
  photo: string | null;
  photoType: string;
  /** Which field it came from — useful in logs when a photo doesn't show up. */
  source: string;
}

export function resolveEnrolleePhoto(
  topLevel: Record<string, unknown>,
  row: Record<string, unknown>,
): ResolvedPhoto {
  let photo = str(topLevel, 'profilepic', 'ProfilePic', 'Profilepic')
    || str(row, 'profilepic', 'ProfilePic', 'Profilepic', 'EnrolleePicture', 'Enrolleepicture', 'Picture', 'MemberPicture', 'Photo', 'PassportPhoto', 'Base64Picture', 'ImageBase64', 'EnrolleeImage');
  let source = photo ? 'known-alias' : '';

  // Fallback: scan both objects for a value that looks like a base64 image and
  // sits under a picture-ish key. Prognosis has renamed this field before.
  if (!photo) {
    for (const [key, value] of [...Object.entries(topLevel ?? {}), ...Object.entries(row ?? {})]) {
      if (typeof value !== 'string' || value.length < 200) continue;
      if (!/pic|photo|image|img/i.test(key)) continue;
      const sample = value.replace(/\s+/g, '');
      if (!/^[A-Za-z0-9+/]+=*$/.test(sample.slice(0, 500))) continue;
      photo = sample;
      source = key;
      break;
    }
  }

  const rawType = str(topLevel, 'picturetype', 'PictureType')
    || str(row, 'EnrolleePictureType', 'EnrolleepictureType', 'PictureType', 'PhotoType', 'ImageType')
    || 'jpeg';

  return {
    photo: photo || null,
    photoType: rawType.includes('/') ? rawType : `image/${rawType}`,
    source: source || 'none',
  };
}
