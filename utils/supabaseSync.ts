import { supabase } from '../supabase';

const mergeObjects = (obj1: any, obj2: any): any => {
  if (obj1 === undefined || obj1 === null) return obj2;
  if (obj2 === undefined || obj2 === null) return obj1;
  if (obj1 === obj2) return obj1;

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
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
  if (typeof obj1 === 'object' && obj1 !== null && typeof obj2 === 'object' && obj2 !== null) {
    const d1 = obj1.updatedAt || obj1.updated_at || obj1.timestamp || obj1.date;
    const d2 = obj2.updatedAt || obj2.updated_at || obj2.timestamp || obj2.date;
    
    const time1 = (typeof d1 === 'string' && isoDateRegex.test(d1)) ? Date.parse(d1) : null;
    const time2 = (typeof d2 === 'string' && isoDateRegex.test(d2)) ? Date.parse(d2) : null;

    const isValidTime1 = time1 !== null && !isNaN(time1);
    const isValidTime2 = time2 !== null && !isNaN(time2);

    if (isValidTime1 && isValidTime2) {
      if (time1 > time2) return obj1;
      if (time2 > time1) return obj2;
    } else if (isValidTime1) {
      return obj1; // Favor the one with a date
    } else if (isValidTime2) {
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
    const t1 = Date.parse(obj1);
    const t2 = Date.parse(obj2);
    if (!isNaN(t1) && !isNaN(t2)) {
      return t1 > t2 ? obj1 : obj2;
    }
  }

  // If obj1 and obj2 are numbers, prefer the larger one to prevent calculated balances (or accrued transactions values) from being overwritten by 0
  if (typeof obj1 === 'number' && typeof obj2 === 'number') {
    return Math.max(obj1, obj2);
  }

  // If obj1 is a status that is "more final" than obj2, prefer obj1
  const finalStatuses = ['En attente', 'Validé', 'Approuvé', 'Débloqué', 'Régularisé', 'Litige', 'Payé', 'Terminé', 'Annulé', 'Rejeté'];
  if (typeof obj1 === 'string' && typeof obj2 === 'string') {
    const idx1 = finalStatuses.indexOf(obj1);
    const idx2 = finalStatuses.indexOf(obj2);
    if (idx1 !== -1 && idx2 !== -1) {
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

const safeNativeSetItem = (key: string, value: string) => {
  let finalValue = value;
  
  if (key.endsWith('microfox_members_data')) {
    try {
      const members = JSON.parse(value);
      if (Array.isArray(members)) {
        finalValue = JSON.stringify(members.map((m: any) => {
          const { history, ...rest } = m;
          return rest;
        }));
      }
    } catch (e) {}
  }
  
  if (key.endsWith('microfox_audit_logs')) {
    try {
      const logs = JSON.parse(value);
      if (Array.isArray(logs)) {
        finalValue = JSON.stringify(logs.slice(0, 100));
      }
    } catch (e) {}
  }

  try {
    Storage.prototype.setItem.call(localStorage, key, finalValue);
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
      console.warn(`LocalStorage quota exceeded in Supabase sync for key: ${key}. Attempting emergency cleanup.`);
      try {
        const currentMf = Storage.prototype.getItem.call(localStorage, 'microfox_current_mf');
        const activePrefix = currentMf ? `mf_${currentMf.toLowerCase().replace(/\s+/g, '_')}_` : '';
        
        const keysToRemove: string[] = [];
        const historyKeys: string[] = [];
        const logsKeys: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          
          // Keep essential global keys
          const isGlobalEssential = [
            'microfox_current_user',
            'microfox_current_mf',
            'microfox_session_active',
            'microfox_offline_mode',
            'microfox_users',
            'microfox_permissions'
          ].includes(k);
          
          if (isGlobalEssential) continue;
          
          // Clear any key belonging to an inactive microfinance code
          if (k.startsWith('mf_') && activePrefix && !k.startsWith(activePrefix)) {
            keysToRemove.push(k);
            continue;
          }
          
          // Mark audit logs and user journeys for clean up
          if (k.includes('user_journeys') || k.includes('audit_logs')) {
            logsKeys.push(k);
          }
          
          // Mark history keys for clean up (as they are fully re-fetched or merged from server/cache)
          if (k.includes('microfox_history_')) {
            historyKeys.push(k);
          }
        }
        
        // Execute the cleanups
        keysToRemove.forEach(k => {
          try { Storage.prototype.removeItem.call(localStorage, k); } catch (err) {}
        });
        
        logsKeys.forEach(k => {
          try { Storage.prototype.removeItem.call(localStorage, k); } catch (err) {}
        });
        
        historyKeys.forEach(k => {
          try { Storage.prototype.removeItem.call(localStorage, k); } catch (err) {}
        });
        
        // Retry
        Storage.prototype.setItem.call(localStorage, key, finalValue);
      } catch (retryError) {
        console.error('Failed to resolve QuotaExceededError even after emergency cleanup:', retryError);
        try {
          window.dispatchEvent(new CustomEvent('microfox_quota_exceeded'));
        } catch (evtErr) {}
      }
    } else {
      throw e;
    }
  }
};

let activeSyncCount = 0;
interface SyncQueueItem {
  key: string;
  value: string;
  resolve: (val: boolean) => void;
  reject: (err: any) => void;
}
const syncQueue: SyncQueueItem[] = [];
const MAX_CONCURRENT_SYNCS = 2;

const processSyncQueue = async () => {
  if (activeSyncCount >= MAX_CONCURRENT_SYNCS || syncQueue.length === 0) return;
  
  const item = syncQueue.shift();
  if (!item) return;
  
  activeSyncCount++;
  try {
    const success = await executeSyncToSupabase(item.key, item.value);
    item.resolve(success);
  } catch (err) {
    console.error(`Queue execute error for ${item.key}:`, err);
    item.resolve(false);
  } finally {
    activeSyncCount--;
    setTimeout(processSyncQueue, 40);
  }
};

const executeSyncToSupabase = async (key: string, value: string): Promise<boolean> => {
  try {
    if (!supabase || !import.meta.env.VITE_SUPABASE_URL) return false;
    
    const maxRetries = 3;
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
        
        const fetchErrorAny = fetchError as any;
        const isNetworkErr = !fetchErrorAny.status || 
                             fetchErrorAny.status === 0 || 
                             (fetchError.message && /fetch|network|timeout|connect|unreachable/i.test(fetchError.message));
        if (isNetworkErr) {
          return false;
        }
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
          
        if (error) {
          const errorAny = error as any;
          const isNetworkErr = !errorAny.status || 
                               errorAny.status === 0 || 
                               (error.message && /fetch|network|timeout|connect|unreachable/i.test(error.message));
          if (isNetworkErr) {
            return false;
          }
        }

        if (!error && data && data.length > 0) {
          // Write merged value back to local storage natively to prevent data loss on subsequent local edits
          const localVal = Storage.prototype.getItem.call(localStorage, key);
          if (finalValue !== localVal) {
            safeNativeSetItem(key, finalValue);
            try {
              window.dispatchEvent(new CustomEvent('microfox_storage', { detail: { key, timestamp: Date.now() } }));
            } catch (e) {}
          }
          return true;
        }
        
        // Conflict detected or error occurred, wait and retry with jittered backoff
        const delay = Math.floor(Math.random() * 100) + (attempt * 40);
        await new Promise(resolve => setTimeout(resolve, delay));
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
          
        if (error) {
          const errorAny = error as any;
          const isNetworkErr = !errorAny.status || 
                               errorAny.status === 0 || 
                               (error.message && /fetch|network|timeout|connect|unreachable/i.test(error.message));
          if (isNetworkErr) {
            return false;
          }
        }

        if (!error && data && data.length > 0) {
          return true;
        }
        
        // Conflict on insert (another client inserted concurrently), wait and retry with jittered backoff
        const delay = Math.floor(Math.random() * 100) + (attempt * 40);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Final fallback to standard upsert with latest merge to guarantee sync completion
    const { data: remoteItem, error: fallbackFetchError } = await supabase
      .from('storage')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (fallbackFetchError) {
      const fallbackFetchErrorAny = fallbackFetchError as any;
      const isNetworkErr = !fallbackFetchErrorAny.status || 
                           fallbackFetchErrorAny.status === 0 || 
                           (fallbackFetchError.message && /fetch|network|timeout|connect|unreachable/i.test(fallbackFetchError.message));
      if (isNetworkErr) {
        return false;
      }
    }
      
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
    
    // Write merged value back to local storage natively to prevent data loss on subsequent local edits
    const localVal = Storage.prototype.getItem.call(localStorage, key);
    if (finalValue !== localVal) {
      safeNativeSetItem(key, finalValue);
      try {
        window.dispatchEvent(new CustomEvent('microfox_storage', { detail: { key, timestamp: Date.now() } }));
      } catch (e) {}
    }
    return true;
  } catch (e) {
    console.error('Supabase sync failed:', e);
    return false;
  }
};

export const syncToSupabase = async (key: string, value: string): Promise<boolean> => {
  if (
    key === 'microfox_current_user' || 
    key === 'microfox_current_mf' || 
    key === 'microfox_session_active' || 
    key === 'microfox_offline_mode'
  ) {
    return true;
  }
  if (typeof window !== 'undefined' && window.navigator && !window.navigator.onLine) {
    return false;
  }

  return new Promise((resolve, reject) => {
    // Check if there is already an item in the queue for the exact same key.
    // If so, we replace its value with the newer value rather than queuing multiple database queries!
    const existingIndex = syncQueue.findIndex(item => item.key === key);
    if (existingIndex !== -1) {
      syncQueue[existingIndex].resolve(true); // resolve the old one with success
      syncQueue[existingIndex].value = value;
      syncQueue[existingIndex].resolve = resolve;
      syncQueue[existingIndex].reject = reject;
    } else {
      syncQueue.push({ key, value, resolve, reject });
    }
    processSyncQueue();
  });
};

export const pullFromSupabase = async (
  prefix: string, 
  originalSetItem: (key: string, value: string) => void,
  originalGetItem: (key: string) => string | null,
  isDirty?: (key: string) => boolean,
  forceFull: boolean = false
) => {
  if (typeof window !== 'undefined' && window.navigator && !window.navigator.onLine) {
    return false;
  }
  try {
    if (!supabase || !import.meta.env.VITE_SUPABASE_URL) return;
    
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    let safetyIterations = 0;

    const currentPullTime = new Date().toISOString();

    // Use incremental sync to protect the database Disk I/O budget
    const lastPullTime = forceFull ? null : localStorage.getItem(`microfox_last_pulled_${prefix}`);

    if (prefix.startsWith('mf_')) {
      const bIsFirstPullSession = sessionStorage.getItem('microfox_session_prioritized_pull_done') !== 'true';
      if (!lastPullTime || bIsFirstPullSession) {
        // Prioritize members_data and history keys on startup to show clients and cotisations immediately
        try {
          const targetMembersKey = prefix + 'microfox_members_data';
          
          const membersRes = await supabase
            .from('storage')
            .select('key, value, updated_at')
            .eq('key', targetMembersKey)
            .maybeSingle();

          if (membersRes.error) {
            console.error('Error fetching members data in pull:', membersRes.error);
            const membersResErrorAny = membersRes.error as any;
            const isNetworkErr = !membersResErrorAny.status || 
                                 membersResErrorAny.status === 0 || 
                                 (membersRes.error.message && /fetch|network|timeout|connect|unreachable/i.test(membersRes.error.message));
            if (isNetworkErr) {
              return false;
            }
          }

          let prioritizedChanged = false;
          const prioritizedKeys = new Set<string>();
          let membersDataForHistory: any[] = [];

          if (membersRes.data) {
            const item = membersRes.data;
            const localValue = originalGetItem(item.key);
            const finalValue = localValue ? mergeJSON(localValue, item.value) : item.value;
            if (finalValue !== localValue) {
              originalSetItem(item.key, finalValue);
              prioritizedChanged = true;
              prioritizedKeys.add(item.key);
            }
            try {
              const parsed = JSON.parse(finalValue);
              membersDataForHistory = Array.isArray(parsed) ? parsed : [];
            } catch (e) {}
          } else {
            try {
              const localMem = originalGetItem(targetMembersKey);
              if (localMem) {
                const parsed = JSON.parse(localMem);
                membersDataForHistory = Array.isArray(parsed) ? parsed : [];
              }
            } catch (e) {}
          }

          const historyKeys: string[] = [];
          if (Array.isArray(membersDataForHistory)) {
            membersDataForHistory.forEach((m: any) => {
              if (m) {
                if (m.id) historyKeys.push(`${prefix}microfox_history_${m.id}`);
                if (m.code && m.code !== m.id) historyKeys.push(`${prefix}microfox_history_${m.code}`);
              }
            });
          }

          let historyResData: any[] = [];
          if (historyKeys.length > 0) {
            const chunkSize = 150;
            for (let i = 0; i < historyKeys.length; i += chunkSize) {
              const chunk = historyKeys.slice(i, i + chunkSize);
              const { data: chunkData, error: chunkError } = await supabase
                .from('storage')
                .select('key, value, updated_at')
                .in('key', chunk);
                
              if (chunkError) {
                console.error('Error fetching history chunk in pull:', chunkError);
                const chunkErrorAny = chunkError as any;
                const isNetworkErr = !chunkErrorAny.status || 
                                     chunkErrorAny.status === 0 || 
                                     (chunkError.message && /fetch|network|timeout|connect|unreachable/i.test(chunkError.message));
                if (isNetworkErr) {
                  return false;
                }
              }
              if (chunkData && chunkData.length > 0) {
                historyResData = [...historyResData, ...chunkData];
              }
            }
          } else {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('storage')
              .select('key, value, updated_at')
              .like('key', `${prefix}microfox_history_%`);
              
            if (fallbackError) {
              console.error('Error inside history fallback query:', fallbackError);
              const fallbackErrorAny = fallbackError as any;
              const isNetworkErr = !fallbackErrorAny.status || 
                                   fallbackErrorAny.status === 0 || 
                                   (fallbackError.message && /fetch|network|timeout|connect|unreachable/i.test(fallbackError.message));
              if (isNetworkErr) {
                return false;
              }
            }
            if (fallbackData) {
              historyResData = fallbackData;
            }
          }

          if (historyResData && historyResData.length > 0) {
            historyResData.forEach((item: any) => {
              const localValue = originalGetItem(item.key);
              const finalValue = localValue ? mergeJSON(localValue, item.value) : item.value;
              if (finalValue !== localValue) {
                originalSetItem(item.key, finalValue);
                prioritizedChanged = true;
                prioritizedKeys.add('microfox_history_');
              }
            });
          }

          if (prioritizedChanged) {
            prioritizedKeys.forEach(k => {
              try {
                window.dispatchEvent(new CustomEvent('microfox_storage', { detail: { key: k, timestamp: Date.now() } }));
              } catch (e) {}
            });
          }
          sessionStorage.setItem('microfox_session_prioritized_pull_done', 'true');
        } catch (err) {
          console.error('Error with prioritized fetch of members and history data:', err);
        }
      }
    }

    while (hasMore && safetyIterations++ < 100) {
      let query = supabase
        .from('storage')
        .select('key, value, updated_at')
        .like('key', `${prefix}%`)
        .order('key')
        .range(from, from + batchSize - 1);

      if (lastPullTime) {
        // Subtract 24 hours of clock skew buffer to handle minor clock desynchronization
        const lastPullDate = new Date(lastPullTime);
        const safePullTime = new Date(lastPullDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
        query = query.gt('updated_at', safePullTime);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error pulling from Supabase:', error);
        const errorAny = error as any;
        const isNetworkErr = !errorAny.status || 
                             errorAny.status === 0 || 
                             (error.message && /fetch|network|timeout|connect|unreachable/i.test(error.message));
        if (isNetworkErr) {
          return false;
        }
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
      const keysToDispatch = new Set<string>();

      data.forEach(item => {
        if (
          item.key.includes('microfox_vault_balance') || 
          item.key.includes('microfox_bank_balance') || 
          item.key.includes('microfox_cash_balance_') ||
          item.key === 'microfox_current_user' ||
          item.key === 'microfox_current_mf' ||
          item.key === 'microfox_session_active' ||
          item.key === 'microfox_offline_mode'
        ) {
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
            
            // Standardize key to avoid flooding dispatch listeners
            let dKey = item.key;
            if (item.key.includes('microfox_history_')) {
              dKey = 'microfox_history_';
            }
            keysToDispatch.add(dKey);
          }
        }
      });

      // Dispatch aggregated change events in next tick to prevent blocking the main synchronous loop
      if (keysToDispatch.size > 0) {
        setTimeout(() => {
          keysToDispatch.forEach(k => {
            try {
              window.dispatchEvent(new CustomEvent('microfox_storage', { detail: { key: k, timestamp: Date.now() } }));
            } catch (e) {}
          });
        }, 0);
      }

      localStorage.setItem(`microfox_last_pulled_${prefix}`, currentPullTime);

      return changed;
    }
    return false;
  } catch (e) {
    console.error('Supabase pull failed:', e);
  }
};
