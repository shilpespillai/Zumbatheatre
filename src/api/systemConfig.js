import { supabase } from './supabaseClient';

const IS_DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS === 'true';

export const getSystemConfig = async () => {
  if (IS_DEV_BYPASS) {
    const mockConfig = JSON.parse(localStorage.getItem('zumba_system_config') || '{"subscription_price": 10}');
    return mockConfig;
  }

  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .single();

  if (error) {
    console.warn('System config not found in DB, using defaults', error);
    return { subscription_price: 10 };
  }
  return data;
};

export const updateSystemConfig = async (updates) => {
  if (IS_DEV_BYPASS) {
    const current = await getSystemConfig();
    const updated = { ...current, ...updates };
    localStorage.setItem('zumba_system_config', JSON.stringify(updated));
    return updated;
  }

  const { data, error } = await supabase
    .from('system_config')
    .update(updates)
    .eq('id', 1) // Assuming single row config
    .select()
    .single();

  if (error) throw error;
  return data;
};
