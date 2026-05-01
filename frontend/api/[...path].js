import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// ── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

// ── Auth helper ──────────────────────────────────────────────────────────────
async function protect(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authorized, no token' });
    return null;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const { data: user, error } = await supabase
      .from('users').select('id, name, email, role').eq('id', decoded.id).single();
    if (error || !user) throw new Error('User not found');
    return user;
  } catch {
    res.status(401).json({ error: 'Not authorized, token failed' });
    return null;
  }
}

// ── History helpers ──────────────────────────────────────────────────────────
async function recordHistory(taskId, userId, userName, field, oldValue, newValue) {
  try {
    await supabase.from('task_history').insert([{
      task_id: taskId, user_id: userId, user_name: userName || 'Unknown',
      field,
      old_value: oldValue != null ? String(oldValue) : null,
      new_value: newValue != null ? String(newValue) : null,
    }]);
  } catch (e) {
    console.error('Failed to record history:', e.message);
  }
}

async function getUserName(userId) {
  try {
    const { data } = await supabase.from('users').select('name').eq('id', userId).single();
    return data?.name || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// ── Token generator ──────────────────────────────────────────────────────────
function generateTokens(id) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return {
    access_token:  jwt.sign({ id }, secret, { expiresIn: '24h' }),
    refresh_token: jwt.sign({ id }, secret, { expiresIn: '30d' }),
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const segments = (Array.isArray(req.query.path) ? req.query.path : [req.query.path])
    .filter(Boolean);
  const [seg0, seg1, seg2] = segments;
  const method = req.method;

  // ── /api/auth/* ────────────────────────────────────────────────────────────
  if (seg0 === 'auth') {
    if (seg1 === 'register' && method === 'POST') {
      const { name, email, password, role } = req.body;
      try {
        if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
        const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
        if (existing) return res.status(400).json({ error: 'User already exists' });
        const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
        const { data: user, error } = await supabase
          .from('users')
          .insert([{ name, email, password: hashedPassword, role: role || 'Member' }])
          .select('id, name, email, role').single();
        if (error) throw error;
        return res.status(201).json({ ...generateTokens(user.id), user });
      } catch (e) { return res.status(500).json({ error: e.message }); }
    }

    if (seg1 === 'login' && method === 'POST') {
      const { email, password } = req.body;
      try {
        const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
        if (user && (await bcrypt.compare(password, user.password))) {
          delete user.password;
          return res.json({ ...generateTokens(user.id), user });
        }
        return res.status(401).json({ error: 'Invalid email or password' });
      } catch (e) { return res.status(500).json({ error: e.message }); }
    }

    if (seg1 === 'logout' && method === 'POST') return res.status(204).end();

    if (seg1 === 'refresh' && method === 'POST') {
      const { refresh_token } = req.body;
      if (!refresh_token) return res.status(401).json({ error: 'No refresh token' });
      try {
        const secret = process.env.JWT_SECRET || 'dev-secret';
        const decoded = jwt.verify(refresh_token, secret);
        return res.json(generateTokens(decoded.id));
      } catch { return res.status(401).json({ error: 'Invalid refresh token' }); }
    }

    return res.status(404).json({ error: 'Not found' });
  }

  // ── /api/users/* ───────────────────────────────────────────────────────────
  if (seg0 === 'users') {
    const user = await protect(req, res);
    if (!user) return;

    if (!seg1 && method === 'GET') {
      try {
        const { data: users, error } = await supabase.from('users').select('id, name, email, role');
        if (error) throw error;
        return res.json({ users });
      } catch (e) { return res.status(500).json({ error: e.message }); }
    }

    if (seg1 === 'me' && method === 'GET') return res.json(user);

    return res.status(404).json({ error: 'Not found' });
  }

  // ── /api/projects/* ────────────────────────────────────────────────────────
  if (seg0 === 'projects') {
    const user = await protect(req, res);
    if (!user) return;

    // GET/POST /api/projects
    if (!seg1) {
      if (method === 'GET') {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.max(1, parseInt(req.query.limit) || 12);
        const search = (req.query.search || '').trim();
        const offset = (page - 1) * limit;
        let query = supabase
          .from('projects')
          .select('*, owner:owner_id (id, name, email)', { count: 'exact' });
        if (search) query = query.ilike('name', `%${search}%`);
        const { data: projects, error, count } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ projects, total: count ?? 0, page, limit });
      }
      if (method === 'POST') {
        const { data: project, error } = await supabase
          .from('projects')
          .insert([{ name: req.body.name, description: req.body.description, owner_id: user.id }])
          .select('*, owner:owner_id (id, name, email)').single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(project);
      }
      return res.status(405).end();
    }

    // GET /api/projects/check-name
    if (seg1 === 'check-name') {
      if (method !== 'GET') return res.status(405).end();
      const { name, exclude_id } = req.query;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      let query = supabase.from('projects').select('id').ilike('name', name);
      if (exclude_id) query = query.neq('id', exclude_id);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ available: data.length === 0 });
    }

    const projectId = seg1;

    // GET/PATCH/DELETE /api/projects/:id
    if (!seg2) {
      if (method === 'GET') {
        const { data: project, error } = await supabase
          .from('projects').select('*, owner:owner_id(id, name, email)').eq('id', projectId).single();
        if (error || !project) return res.status(404).json({ error: 'Project not found' });
        return res.json(project);
      }
      if (method === 'PATCH') {
        const { data: proj } = await supabase.from('projects').select('owner_id').eq('id', projectId).single();
        if (!proj) return res.status(404).json({ error: 'Not found' });
        if (user.role !== 'Admin' && proj.owner_id !== user.id)
          return res.status(403).json({ error: 'Not authorized. Only the project owner or an Admin can edit.' });
        const { data: updated, error } = await supabase
          .from('projects').update(req.body).eq('id', projectId)
          .select('*, owner:owner_id(id, name, email)').single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(updated);
      }
      if (method === 'DELETE') {
        const { data: proj } = await supabase.from('projects').select('owner_id').eq('id', projectId).single();
        if (!proj) return res.status(404).json({ error: 'Not found' });
        if (user.role !== 'Admin' && proj.owner_id !== user.id)
          return res.status(403).json({ error: 'Not authorized. Only the project owner or an Admin can delete.' });
        const { error } = await supabase.from('projects').delete().eq('id', projectId);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(204).end();
      }
      return res.status(405).end();
    }

    // GET/POST /api/projects/:id/tasks
    if (seg2 === 'tasks') {
      if (method === 'GET') {
        let query = supabase
          .from('tasks')
          .select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)')
          .eq('project_id', projectId);
        if (req.query.status)   query = query.eq('status', req.query.status);
        if (req.query.assignee) query = query.eq('assignee_id', req.query.assignee);
        const { data: tasks, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ tasks, total: tasks.length, page: 1, limit: 500 });
      }
      if (method === 'POST') {
        const { title, description, priority, assignee_id, due_date } = req.body;
        const { data: task, error } = await supabase
          .from('tasks')
          .insert([{ title, description, priority, status: 'todo', project_id: projectId,
            assignee_id: assignee_id || null, creator_id: user.id, due_date }])
          .select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)')
          .single();
        if (error) return res.status(500).json({ error: error.message });
        const userName = await getUserName(user.id);
        await recordHistory(task.id, user.id, userName, 'created', null, null);
        return res.status(201).json(task);
      }
      return res.status(405).end();
    }

    // GET /api/projects/:id/history
    if (seg2 === 'history' && method === 'GET') {
      const limit  = parseInt(req.query.limit)  || 15;
      const offset = parseInt(req.query.offset) || 0;
      try {
        const { data: tasks, error: taskErr } = await supabase
          .from('tasks').select('id, title').eq('project_id', projectId);
        if (taskErr) throw taskErr;
        if (!tasks || tasks.length === 0) return res.json({ history: [], has_more: false });
        const taskIds = tasks.map(t => t.id);
        const taskTitleMap = Object.fromEntries(tasks.map(t => [t.id, t.title]));
        const { data: history, error: histErr } = await supabase
          .from('task_history').select('*').in('task_id', taskIds)
          .order('created_at', { ascending: false }).range(offset, offset + limit);
        if (histErr) throw histErr;
        const enriched = (history || []).map(h => ({ ...h, task_title: taskTitleMap[h.task_id] || 'Deleted task' }));
        return res.json({ history: enriched, has_more: enriched.length > limit });
      } catch (e) {
        if (e.code === 'PGRST205' || e.code === '42P01') return res.json({ history: [], has_more: false });
        return res.status(500).json({ error: e.message });
      }
    }

    // GET /api/projects/:id/stats
    if (seg2 === 'stats' && method === 'GET') {
      const { data: tasks, error } = await supabase
        .from('tasks').select('status').eq('project_id', projectId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({
        total:       tasks.length,
        done:        tasks.filter(t => t.status === 'done').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        todo:        tasks.filter(t => t.status === 'todo').length,
      });
    }

    return res.status(404).json({ error: 'Not found' });
  }

  // ── /api/tasks/* ───────────────────────────────────────────────────────────
  if (seg0 === 'tasks') {
    const user = await protect(req, res);
    if (!user) return;
    const taskId = seg1;

    // PATCH/DELETE /api/tasks/:id
    if (!seg2) {
      if (method === 'PATCH') {
        const updates = { ...req.body };
        const { data: oldTask } = await supabase
          .from('tasks')
          .select('title, description, status, priority, assignee_id, due_date, creator_id, project_id')
          .eq('id', taskId).single();
        if (!oldTask) return res.status(404).json({ error: 'Task not found' });

        if (user.role !== 'Admin') {
          const isCreator = oldTask.creator_id === user.id;
          const { data: proj } = await supabase.from('projects').select('owner_id').eq('id', oldTask.project_id).single();
          const isProjectOwner = proj?.owner_id === user.id;
          const statusOnly = Object.keys(updates).length === 1 && updates.status;
          if (!statusOnly && !isCreator && !isProjectOwner)
            return res.status(403).json({ error: 'Not authorized to edit this task' });
        }

        if (updates.clear_assignee) { updates.assignee_id = null; delete updates.clear_assignee; }

        const { data: task, error } = await supabase
          .from('tasks').update(updates).eq('id', taskId)
          .select('*, assignee:assignee_id(id, name, email), creator:creator_id(id, name, email)')
          .single();
        if (error) return res.status(500).json({ error: error.message });

        const userName = await getUserName(user.id);
        for (const field of ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date']) {
          const oldVal = oldTask[field], newVal = updates[field];
          if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? ''))
            await recordHistory(taskId, user.id, userName, field, oldVal, newVal);
        }
        return res.json(task);
      }

      if (method === 'DELETE') {
        const { data: task } = await supabase
          .from('tasks').select('creator_id, projects!inner(owner_id)').eq('id', taskId).single();
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (!task.creator_id === user.id && task.projects.owner_id !== user.id && user.role !== 'Admin')
          return res.status(403).json({ error: 'Not authorized.' });
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(204).end();
      }
      return res.status(405).end();
    }

    // GET /api/tasks/:id/history
    if (seg2 === 'history' && method === 'GET') {
      try {
        const { data: history, error } = await supabase
          .from('task_history').select('*').eq('task_id', taskId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ history: history || [] });
      } catch (e) {
        if (e.code === 'PGRST205' || e.code === '42P01') return res.json({ history: [] });
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  }

  res.status(404).json({ error: 'Not found' });
}
