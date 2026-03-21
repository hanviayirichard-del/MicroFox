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
    
    // Fetch current remote value to merge and avoid overwriting other devices' data
    const { data: remoteItem } = await supabase
      .from('storage')
      .select('value')
      .eq('key', key)
      .maybeSingle();
      
    const finalValue = remoteItem?.value ? mergeJSON(remoteItem.value, value) : value;

    const { error } = await supabase
      .from('storage')
      .upsert({ 
        key: key, 
        value: finalValue, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });
      
    if (error) {
      console.error('Error syncing to Supabase:', error);
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
  originalGetItem: (key: string) => string | null
) => {
  try {
    if (!supabase || !import.meta.env.VITE_SUPABASE_URL) return;
    
    const { data, error } = await supabase
      .from('storage')
      .select('key, value')
      .like('key', `${prefix}%`);
      
    if (error) {
      console.error('Error pulling from Supabase:', error);
      return;
    }
    
    if (data) {
      data.forEach(item => {
        const localValue = originalGetItem(item.key);
        const finalValue = localValue ? mergeJSON(localValue, item.value) : item.value;
        originalSetItem(item.key, finalValue);
      });
    }
  } catch (e) {
    console.error('Supabase pull failed:', e);
  }
};
