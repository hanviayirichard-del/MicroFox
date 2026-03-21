import { supabase } from '../supabase';

export const syncToSupabase = async (key: string, value: string): Promise<boolean> => {
  try {
    if (!supabase || !import.meta.env.VITE_SUPABASE_URL) return false;
    
    const { error } = await supabase
      .from('storage')
      .upsert({ 
        key: key, 
        value: value, 
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

export const pullFromSupabase = async (prefix: string, originalSetItem: (key: string, value: string) => void) => {
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
        originalSetItem(item.key, item.value);
      });
    }
  } catch (e) {
    console.error('Supabase pull failed:', e);
  }
};
