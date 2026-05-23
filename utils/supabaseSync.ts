import { supabase } from '../supabase';

const mergeObjects = (obj1: any, obj2: any): any => {
  if (JSON.stringify(obj1) === JSON.stringify(obj2)) return obj1;

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    const map = new Map();
    obj1.forEach(item => {
      if (item && typeof item === 'object' && item.id) {
        map.set(item.id, item);
      } else {
        map.set(JSON.stringify(item), item);
      }
    });
    obj2.forEach(item => {
      if (item && typeof item === 'object' && item.id) {
        const existing = map.get(item.id);
        if (existing) {
          // Merge properties
          const merged = mergeObjects(existing, item);
          // CRITICAL: If either version is marked as deleted, the result MUST be marked as deleted
          if (item.isDeleted === true || existing.isDeleted === true) {
            merged.isDeleted = true;
          }
          map.set(item.id, merged);
        } else {
          map.set(item.id, item);
        }
      } else {
        map.set(JSON.stringify(item), item);
      }
    });
    return Array.from(map.values());
  }

  // If obj1 and obj2 are objects with an updatedAt or timestamp field, prefer the more recent one
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  if (typeof obj1 === 'object' && obj1 !== null && typeof obj2 === 'object' && obj2 !== null) {
    const d1 = obj1.updatedAt || obj1.updated_at || obj1.timestamp || obj1.date;
    const d2 = obj2.updatedAt || obj2.updated_at || obj2.timestamp || obj2.date;
    
    const date1 = (typeof d1 === 'string' && isoDateRegex.test(d1)) ? d1 : null;
    const date2 = (typeof d2 === 'string' && isoDateRegex.test(d2)) ? d2 : null;

    if (date1 && date2) {
      if (date1 > date2) return obj1;
      if (date2 > date1) return obj2;
    } else if (date1) {
      return obj1; // Favor the one with a date
    } else if (date2) {
      return obj2; // Favor the one with a date
    }
  }

  if (typeof obj1 === 'object' && obj1 !== null && typeof obj2 === 'object' && obj2 !== null) {
    const result = { ...obj1 };
    for (const key in obj2) {
      if (Object.prototype.hasOwnProperty.call(obj2, key)) {
        if (key in obj1) {
          result[key] = mergeObjects(obj1[key], obj2[key]);
        } else {
          result[key] = obj2[key];
        }
      }
    }
    return result;
  }

  // If obj1 and obj2 are ISO date strings, prefer the more recent one
  if (typeof obj1 === 'string' && typeof obj2 === 'string' && isoDateRegex.test(obj1) && isoDateRegex.test(obj2)) {
    return obj1 > obj2 ? obj1 : obj2;
  }

  // If obj1 is a status that is "more final" than obj2, prefer obj1
  const finalStatuses = ['En attente', 'Validé', 'Approuvé', 'Débloqué', 'Régularisé', 'Litige', 'Payé', 'Terminé', 'Annulé', 'Rejeté'];
  if (typeof obj1 === 'string' && typeof obj2 === 'string') {
    const idx1 = finalStatuses.indexOf(obj1);
    const idx2 = finalStatuses.indexOf(obj2);
    if (idx1 !== -1 || idx2 !== -1) {
      return idx1 >= idx2 ? obj1 : obj2;
    }
  }

  return obj2;
};

export const mergeJSON = (json1: string, json2: string): string => {
  try {
    const obj1 = JSON.parse(json1);
    const obj2 = JSON.parse(json2);
    return JSON.stringify(mergeObjects(obj1, obj2));
  } catch (e) {
    return json2;
  }
};

export const syncToSupabase = async (key: string, value: string): Promise<boolean> => {
  try {
    if (!supabase || !import.meta.env.VITE_SUPABASE_URL) return false;
    
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Fetch current remote value to merge and avoid overwriting other devices' data
      const { data: remoteItem, error: fetchError } = await supabase
        .from('storage')
        .select('value, updated_at')
        .eq('key', key)
        .maybeSingle();
        
      if (fetchError) {
        // If table doesn't exist (42P01), we should probably stop trying to sync
        if (fetchError.code === '42P01') {
          console.warn('Supabase storage table not found. Please run the SQL schema script.');
          return false;
        }
        console.error(`Error fetching remote value for key ${key}:`, fetchError);
      }
        
      if (remoteItem) {
        const finalValue = mergeJSON(remoteItem.value, value);
        
        // Optimistic locking: update ONLY if updated_at has not changed since fetch
        const { data, error } = await supabase
          .from('storage')
          .update({ 
            value: finalValue, 
            updated_at: new Date().toISOString() 
          })
          .eq('key', key)
          .eq('updated_at', remoteItem.updated_at)
          .select('key');
          
        if (!error && data && data.length > 0) {
          return true;
        }
        
        // Conflict detected or error occurred, wait and retry
        await new Promise(resolve => setTimeout(resolve, Math.random() * 80 * attempt));
      } else {
        // Try inserting if it doesn't exist
        const { data, error } = await supabase
          .from('storage')
          .insert({ 
            key: key, 
            value: value, 
            updated_at: new Date().toISOString() 
          })
          .select('key');
          
        if (!error && data && data.length > 0) {
          return true;
        }
        
        // Conflict on insert (another client inserted concurrently), wait and retry
        await new Promise(resolve => setTimeout(resolve, Math.random() * 80 * attempt));
      }
    }
    
    // Final fallback to standard upsert with latest merge to guarantee sync completion
    const { data: remoteItem } = await supabase
      .from('storage')
      .select('value')
      .eq('key', key)
      .maybeSingle();
      
    const finalValue = remoteItem?.value ? mergeJSON(remoteItem.value, value) : value;
    const { error: upsertError } = await supabase
      .from('storage')
      .upsert({ 
        key: key, 
        value: finalValue, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });
      
    if (upsertError) {
      console.error(`Error in fallback upsert for key ${key}:`, upsertError);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Supabase sync failed:', e);
    return false;
  }
};

export const pullFromSupabase = async (
  prefix: string, 
  originalSetItem: (key: string, value: string) => void,
  originalGetItem: (key: string) => string | null,
  isDirty?: (key: string) => boolean
) => {
  try {
    if (!supabase || !import.meta.env.VITE_SUPABASE_URL) return;
    
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    // Use incremental sync to protect the database Disk I/O budget
    const lastPullTime = localStorage.getItem(`microfox_last_pulled_${prefix}`);

    while (hasMore) {
      let query = supabase
        .from('storage')
        .select('key, value, updated_at')
        .like('key', `${prefix}%`)
        .order('key')
        .range(from, from + batchSize - 1);

      if (lastPullTime) {
        query = query.gt('updated_at', lastPullTime);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error pulling from Supabase:', error);
        return;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }
    
    const data = allData;
    
    if (data) {
      let changed = false;
      let maxUpdatedAt = lastPullTime || new Date(0).toISOString();

      data.forEach(item => {
        if (item.updated_at && item.updated_at > maxUpdatedAt) {
          maxUpdatedAt = item.updated_at;
        }

        if (item.key.includes('microfox_vault_balance') || item.key.includes('microfox_bank_balance') || item.key.includes('microfox_cash_balance_')) {
          return;
        }
        const localValue = originalGetItem(item.key);
        if (localValue !== item.value) {
          // If the key is dirty locally, we only skip if it's not mergeable JSON
          if (isDirty && isDirty(item.key)) {
            if (localValue && localValue !== '[]' && localValue !== '{}' && localValue !== 'null') {
              try {
                JSON.parse(localValue);
                JSON.parse(item.value);
              } catch (e) {
                return;
              }
            }
          }

          const finalValue = localValue ? mergeJSON(localValue, item.value) : item.value;
          if (finalValue !== localValue) {
            originalSetItem(item.key, finalValue);
            changed = true;
          }
        }
      });

      if (data.length > 0) {
        localStorage.setItem(`microfox_last_pulled_${prefix}`, maxUpdatedAt);
      } else if (!lastPullTime) {
        localStorage.setItem(`microfox_last_pulled_${prefix}`, new Date().toISOString());
      }

      return changed;
    }
    return false;
  } catch (e) {
    console.error('Supabase pull failed:', e);
  }
};
