// Registry of Delphi transition-loader videos. Drop a new .mp4 in
// assets/loaders/ and add it to LOADERS to include it in the rotation.
export const LOADERS = [
  require('../assets/loaders/loader-01.mp4'),
  require('../assets/loaders/loader-02.mp4'),
];

let lastIndex = -1;

export function pickLoader() {
  if (LOADERS.length === 0) return null;
  if (LOADERS.length === 1) return LOADERS[0];

  let i = Math.floor(Math.random() * LOADERS.length);
  if (i === lastIndex) i = (i + 1) % LOADERS.length;
  lastIndex = i;
  return LOADERS[i];
}
