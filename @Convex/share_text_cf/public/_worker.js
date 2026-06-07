const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const path = url.pathname;
    const method = request.method;
    const db = env.DB;

    // --- NOTES ---
    if (path === '/api/notes') {
      if (method === 'GET') {
        const folderId = url.searchParams.get('folderId');
        let rows;
        if (folderId === 'none') {
          rows = (await db.prepare('SELECT * FROM notes WHERE folder_id IS NULL').all()).results;
        } else if (folderId) {
          rows = (await db.prepare('SELECT * FROM notes WHERE folder_id = ?').bind(folderId).all()).results;
        } else {
          rows = (await db.prepare('SELECT * FROM notes').all()).results;
        }
        rows.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.timestamp - a.timestamp;
        });
        return json(rows.map(r => ({
          _id: r.id, text: r.text, timestamp: r.timestamp,
          pinned: !!r.pinned, color: r.color, bgColor: r.bg_color, folderId: r.folder_id
        })));
      }
      if (method === 'POST') {
        const { text, color, bgColor, folderId } = await request.json();
        const id = crypto.randomUUID();
        await db.prepare(
          'INSERT INTO notes (id, text, timestamp, pinned, color, bg_color, folder_id) VALUES (?,?,?,0,?,?,?)'
        ).bind(id, text, Date.now(), color ?? null, bgColor ?? null, folderId ?? null).run();
        return json({ _id: id });
      }
      // DELETE all (clean)
      if (method === 'DELETE') {
        const folderId = url.searchParams.get('folderId');
        if (folderId === 'none') {
          await db.prepare('DELETE FROM notes WHERE folder_id IS NULL').run();
        } else if (folderId) {
          await db.prepare('DELETE FROM notes WHERE folder_id = ?').bind(folderId).run();
        } else {
          await db.prepare('DELETE FROM notes').run();
        }
        return json({ ok: true });
      }
    }

    const noteMatch = path.match(/^\/api\/notes\/([^/]+)(\/pin)?$/);
    if (noteMatch) {
      const id = noteMatch[1];
      const isPin = !!noteMatch[2];

      if (method === 'DELETE') {
        await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
      if (method === 'PATCH' && isPin) {
        const note = await db.prepare('SELECT pinned FROM notes WHERE id = ?').bind(id).first();
        if (!note) return err('Not found', 404);
        await db.prepare('UPDATE notes SET pinned = ? WHERE id = ?').bind(note.pinned ? 0 : 1, id).run();
        return json({ ok: true });
      }
      if (method === 'PATCH') {
        const { text, color, bgColor, folderId } = await request.json();
        await db.prepare(
          'UPDATE notes SET text=?, color=?, bg_color=?, folder_id=? WHERE id=?'
        ).bind(text, color ?? null, bgColor ?? null, folderId ?? null, id).run();
        return json({ ok: true });
      }
    }

    // --- SETTINGS ---
    if (path === '/api/settings') {
      if (method === 'GET') {
        const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('customSyntaxes').first();
        return json({ customSyntaxes: row ? JSON.parse(row.value) : [] });
      }
      if (method === 'POST') {
        const { customSyntaxes } = await request.json();
        await db.prepare(
          'INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
        ).bind('customSyntaxes', JSON.stringify(customSyntaxes)).run();
        return json({ ok: true });
      }
    }

    // --- FOLDERS ---
    if (path === '/api/folders') {
      if (method === 'GET') {
        const rows = (await db.prepare('SELECT * FROM folders ORDER BY position ASC').all()).results;
        return json(rows.map(r => ({
          _id: r.id, name: r.name, color: r.color,
          bgColor: r.bg_color, borderColor: r.border_color, position: r.position
        })));
      }
      if (method === 'POST') {
        const { name, color, bgColor, borderColor } = await request.json();
        const id = crypto.randomUUID();
        const maxRow = await db.prepare('SELECT MAX(position) as m FROM folders').first();
        const pos = (maxRow?.m ?? -1) + 1;
        await db.prepare(
          'INSERT INTO folders (id, name, color, bg_color, border_color, position) VALUES (?,?,?,?,?,?)'
        ).bind(id, name, color ?? null, bgColor ?? null, borderColor ?? null, pos).run();
        return json({ _id: id });
      }
    }

    const folderMatch = path.match(/^\/api\/folders\/([^/]+)$/);
    if (folderMatch) {
      const id = folderMatch[1];
      if (method === 'PATCH') {
        const { name, color, bgColor, borderColor, position } = await request.json();
        await db.prepare(
          'UPDATE folders SET name=?, color=?, bg_color=?, border_color=?, position=? WHERE id=?'
        ).bind(name, color ?? null, bgColor ?? null, borderColor ?? null, position ?? 0, id).run();
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        await db.prepare('UPDATE notes SET folder_id = NULL WHERE folder_id = ?').bind(id).run();
        await db.prepare('DELETE FROM folders WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
    }

    return err('Not found', 404);
  },
};
