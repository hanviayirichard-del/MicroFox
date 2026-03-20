export const getMFKey = (baseKey: string) => {
  const currentMF = localStorage.getItem('microfox_current_mf');
  if (!currentMF) return baseKey;
  const mfId = currentMF.toLowerCase().replace(/\s+/g, '_');
  return `${mfId}_${baseKey}`;
};
