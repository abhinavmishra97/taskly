import supabase from './supabase.js';

export async function recordHistory(taskId, userId, userName, field, oldValue, newValue) {
  try {
    await supabase.from('task_history').insert([{
      task_id: taskId,
      user_id: userId,
      user_name: userName || 'Unknown',
      field,
      old_value: oldValue != null ? String(oldValue) : null,
      new_value: newValue != null ? String(newValue) : null,
    }]);
  } catch (e) {
    console.error('Failed to record history:', e.message);
  }
}

export async function getUserName(userId) {
  try {
    const { data } = await supabase.from('users').select('name').eq('id', userId).single();
    return data?.name || 'Unknown';
  } catch {
    return 'Unknown';
  }
}
