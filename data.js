const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function text(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function optionalText(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function normalizeData(data) {
  const source = data && typeof data === 'object' ? data : {};
  const config = source.config && typeof source.config === 'object' ? source.config : {};
  const sections = Array.isArray(source.sections) ? source.sections : [];

  if (!Array.isArray(config.authors)) {
    config.authors = [];
  }

  return {
    sections: sections.map((section, index) => ({
      id: text(section.id, `section-${index}`),
      title: text(section.title, '新板块'),
      icon: text(section.icon, '📋'),
      items: Array.isArray(section.items) ? section.items : []
    })),
    config
  };
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json({ error: 'D1 binding DB is missing' }, 500);
  }

  const { results: sectionRows } = await env.DB.prepare(`
    SELECT id, title, icon, sort_order
    FROM sections
    ORDER BY sort_order ASC, title ASC
  `).all();

  const { results: itemRows } = await env.DB.prepare(`
    SELECT id, section_id, title, status, priority, tags, cover_image, content, author, created_at, updated_at
    FROM items
    ORDER BY created_at ASC
  `).all();

  const { results: configRows } = await env.DB.prepare(`
    SELECT key, value
    FROM config
  `).all();

  const config = {};
  for (const row of configRows) {
    config[row.key] = safeJsonParse(row.value, row.value);
  }
  if (!Array.isArray(config.authors)) {
    config.authors = [];
  }

  const itemsBySection = new Map();
  for (const row of itemRows) {
    const item = {
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      tags: safeJsonParse(row.tags || '[]', []),
      coverImage: row.cover_image || null,
      content: row.content || '',
      author: row.author || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    if (!itemsBySection.has(row.section_id)) {
      itemsBySection.set(row.section_id, []);
    }
    itemsBySection.get(row.section_id).push(item);
  }

  const sections = sectionRows.map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon,
    items: itemsBySection.get(row.id) || []
  }));

  return json({ sections, config });
}

export async function onRequestPost({ env, request }) {
  if (!env.DB) {
    return json({ error: 'D1 binding DB is missing' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON' }, 400);
  }

  const data = normalizeData(body);
  const now = new Date().toISOString();

  await env.DB.prepare('DELETE FROM items').run();
  await env.DB.prepare('DELETE FROM sections').run();
  await env.DB.prepare('DELETE FROM config').run();

  let itemCount = 0;
  for (let sectionIndex = 0; sectionIndex < data.sections.length; sectionIndex++) {
    const section = data.sections[sectionIndex];

    await env.DB.prepare(`
      INSERT INTO sections (id, title, icon, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      section.id,
      section.title,
      section.icon,
      sectionIndex,
      now,
      now
    ).run();

    for (const rawItem of section.items) {
      const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
      await env.DB.prepare(`
        INSERT INTO items (
          id, section_id, title, status, priority, tags, cover_image,
          content, author, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        text(item.id, `item-${sectionIndex}-${itemCount}`),
        section.id,
        text(item.title, '新条目'),
        text(item.status, 'draft'),
        text(item.priority, 'medium'),
        JSON.stringify(Array.isArray(item.tags) ? item.tags : []),
        optionalText(item.coverImage),
        text(item.content),
        text(item.author),
        text(item.createdAt, now),
        text(item.updatedAt, now)
      ).run();
      itemCount++;
    }
  }

  for (const [key, value] of Object.entries(data.config)) {
    await env.DB.prepare(`
      INSERT INTO config (key, value)
      VALUES (?, ?)
    `).bind(
      key,
      typeof value === 'string' ? value : JSON.stringify(value)
    ).run();
  }

  return json({
    ok: true,
    sections: data.sections.length,
    items: itemCount
  });
}
