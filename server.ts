import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('ssajb.db', { verbose: console.log });
const JWT_SECRET = process.env.JWT_SECRET || 'ssajb-secret-key';

console.log('Initializing database...');
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    city TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    salesrun_api_key TEXT,
    salesrun_webhook_url TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    name TEXT,
    role TEXT,
    store_id INTEGER,
    password_hash TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY(store_id) REFERENCES stores(id)
  );

  CREATE TABLE IF NOT EXISTS sectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER,
    sector_id INTEGER,
    device_uid TEXT,
    device_type TEXT,
    location TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    UNIQUE(store_id, device_uid),
    FOREIGN KEY(store_id) REFERENCES stores(id),
    FOREIGN KEY(sector_id) REFERENCES sectors(id)
  );

  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    value REAL,
    unit TEXT,
    meta TEXT DEFAULT '{}',
    FOREIGN KEY(device_id) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sector_id INTEGER,
    device_type TEXT,
    min_value REAL,
    max_value REAL,
    notes TEXT DEFAULT '',
    FOREIGN KEY(sector_id) REFERENCES sectors(id)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER,
    sector_id INTEGER,
    severity TEXT,
    title TEXT,
    detail TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolution TEXT DEFAULT '',
    FOREIGN KEY(store_id) REFERENCES stores(id),
    FOREIGN KEY(sector_id) REFERENCES sectors(id)
  );

  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER,
    sector_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_at DATETIME,
    status TEXT DEFAULT 'open',
    assigned_role TEXT DEFAULT 'operator',
    title TEXT,
    instruction TEXT DEFAULT '',
    completed_at DATETIME,
    completed_by INTEGER,
    evidence TEXT DEFAULT '{}',
    FOREIGN KEY(store_id) REFERENCES stores(id),
    FOREIGN KEY(sector_id) REFERENCES sectors(id),
    FOREIGN KEY(completed_by) REFERENCES users(id)
  );
  `);
  console.log('Database initialized successfully.');
} catch (err) {
  console.error('Database initialization failed:', err);
}

  // --- Seed Data ---
const seed = () => {
  // Stores
  const stores = [
    { id: 1, name: "Loja 01", city: "São Paulo" },
    { id: 2, name: "Loja 02", city: "Rio de Janeiro" }
  ];
  stores.forEach(st => {
    const existing = db.prepare('SELECT * FROM stores WHERE id = ?').get(st.id);
    if (!existing) {
      db.prepare('INSERT INTO stores (id, name, city) VALUES (?, ?, ?)').run(st.id, st.name, st.city);
    }
  });

  const sectors = ['butchery', 'flv', 'bakery', 'rotisserie', 'deli'];
  const sectorNames: Record<string, string> = {
    butchery: 'Açougue', flv: 'FLV', bakery: 'Padaria', rotisserie: 'Rotisseria', deli: 'Frios/Fatiados'
  };
  sectors.forEach(code => {
    const s = db.prepare('SELECT * FROM sectors WHERE code = ?').get(code);
    if (!s) {
      db.prepare('INSERT INTO sectors (code, name) VALUES (?, ?)').run(code, sectorNames[code]);
    }
  });

  const users = [
    { email: 'operador@loja.com', name: 'Operador', role: 'operator', store_id: 1 },
    { email: 'gerente@loja.com', name: 'Gerente Loja', role: 'manager', store_id: 1 },
    { email: 'ssa@empresa.com', name: 'Segurança do Alimento', role: 'ssa', store_id: null },
    { email: 'auditor@empresa.com', name: 'Auditoria', role: 'auditor', store_id: null },
    { email: 'gerente2@loja.com', name: 'Gerente Loja 02', role: 'manager', store_id: 2 },
  ];

  const hash = bcrypt.hashSync('senha123', 10);
  users.forEach(u => {
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(u.email);
    if (!existing) {
      db.prepare('INSERT INTO users (email, name, role, store_id, password_hash) VALUES (?, ?, ?, ?, ?)').run(u.email, u.name, u.role, u.store_id, hash);
    }
  });

  // Thresholds
  const thresholdData = [
    { sector: 'butchery', type: 'temp', min: 0, max: 5, notes: 'Refrigerado' },
    { sector: 'flv', type: 'temp', min: 8, max: 12, notes: 'Frutas e Legumes' },
    { sector: 'bakery', type: 'temp', min: 0, max: 5, notes: 'Refrigerado' },
    { sector: 'rotisserie', type: 'hot', min: 60, max: 90, notes: 'Quente' },
    { sector: 'deli', type: 'temp', min: 0, max: 5, notes: 'Refrigerado' },
  ];

  thresholdData.forEach(t => {
    const sector: any = db.prepare('SELECT id FROM sectors WHERE code = ?').get(t.sector);
    const existing = db.prepare('SELECT * FROM thresholds WHERE sector_id = ? AND device_type = ?').get(sector.id, t.type);
    if (!existing) {
      db.prepare('INSERT INTO thresholds (sector_id, device_type, min_value, max_value, notes) VALUES (?, ?, ?, ?, ?)').run(sector.id, t.type, t.min, t.max, t.notes);
    }
  });

  // Example Devices
  const devices = [
    { store_id: 1, sector_code: 'butchery', uid: 'SENS-AC-01', type: 'temp', loc: 'Câmara Fria 01' },
    { store_id: 1, sector_code: 'deli', uid: 'SENS-FR-01', type: 'temp', loc: 'Balcão de Frios' },
    { store_id: 1, sector_code: 'rotisserie', uid: 'SENS-RT-01', type: 'hot', loc: 'Pass-through' },
  ];

  devices.forEach(d => {
    const sector: any = db.prepare('SELECT id FROM sectors WHERE code = ?').get(d.sector_code);
    const existing = db.prepare('SELECT * FROM devices WHERE store_id = ? AND device_uid = ?').get(d.store_id, d.uid);
    if (!existing) {
      db.prepare('INSERT INTO devices (store_id, sector_id, device_uid, device_type, location) VALUES (?, ?, ?, ?, ?)').run(d.store_id, sector.id, d.uid, d.type, d.loc);
    }
  });

  // Example Alerts & Actions for Dashboard
  const existingAlert = db.prepare('SELECT * FROM alerts WHERE store_id = 1').get();
  if (!existingAlert) {
    const butchery: any = db.prepare('SELECT id FROM sectors WHERE code = "butchery"').get();
    const deli: any = db.prepare('SELECT id FROM sectors WHERE code = "deli"').get();

    db.prepare('INSERT INTO alerts (store_id, sector_id, severity, title, detail) VALUES (1, ?, "red", "Temperatura Crítica: Açougue", "Sensor SENS-AC-01 registrou 8.5°C (Limite: 5°C)")').run(butchery.id);
    db.prepare('INSERT INTO alerts (store_id, sector_id, severity, title, detail) VALUES (1, ?, "yellow", "Alerta de Temperatura: Frios", "Sensor SENS-FR-01 registrou 6.2°C (Limite: 5°C)")').run(deli.id);

    db.prepare('INSERT INTO actions (store_id, sector_id, title, instruction, assigned_role) VALUES (1, ?, "Verificar Câmara Açougue", "Checar vedação da porta e sistema de degelo.", "manager")').run(butchery.id);
    db.prepare('INSERT INTO actions (store_id, sector_id, title, instruction, assigned_role) VALUES (1, ?, "Ajustar Balcão de Frios", "Reduzir carga térmica e verificar circulação de ar.", "operator")').run(deli.id);
  }
};
seed();

// --- Auth Middleware ---
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

async function pushToSalesRun(storeId: number, data: any) {
  const store: any = db.prepare('SELECT salesrun_webhook_url, salesrun_api_key FROM stores WHERE id = ?').get(storeId);
  if (store?.salesrun_webhook_url) {
    console.log(`Pushing to SalesRun: ${store.salesrun_webhook_url}`);
    try {
      await fetch(store.salesrun_webhook_url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-SalesRun-Key': store.salesrun_api_key || ''
        },
        body: JSON.stringify({
          source: 'SSA-FoodSafety',
          timestamp: new Date().toISOString(),
          ...data
        })
      });
    } catch (e) {
      console.error('SalesRun Push Failed:', e);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check for platform
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // --- API Routes ---
  app.post('/api/auth/token', (req, res) => {
    const { username, password, email: bodyEmail } = req.body;
    const email = username || bodyEmail;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user: any = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { sub: user.email, role: user.role, store_id: user.store_id, id: user.id }, 
      JWT_SECRET, 
      { expiresIn: '8h' }
    );
    
    res.json({ access_token: token, token_type: 'bearer' });
  });

  app.get('/api/me', authenticate, (req: any, res) => {
    const user = db.prepare('SELECT id, email, name, role, store_id FROM users WHERE email = ?').get(req.user.sub);
    res.json(user);
  });

  app.get('/api/stores/:store_id/dashboard', authenticate, (req: any, res) => {
    const store_id = parseInt(req.params.store_id);
    if ((req.user.role === 'operator' || req.user.role === 'manager') && req.user.store_id !== store_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Simple Risk Calculation
    const red_alerts = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE store_id = ? AND severity = "red" AND resolved_at IS NULL').get(store_id) as any;
    const yellow_alerts = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE store_id = ? AND severity = "yellow" AND resolved_at IS NULL').get(store_id) as any;
    const open_actions = db.prepare('SELECT COUNT(*) as count FROM actions WHERE store_id = ? AND status = "open"').get(store_id) as any;

    const risk_score = Math.min(100, 5 + (red_alerts.count * 18) + (yellow_alerts.count * 7) + (open_actions.count * 2));
    const compliance = Math.max(0, 100 - (red_alerts.count * 12 + yellow_alerts.count * 5));

    const top_sectors = db.prepare(`
      SELECT s.name as sector, COUNT(a.id) as open_alerts
      FROM sectors s
      JOIN alerts a ON a.sector_id = s.id
      WHERE a.store_id = ? AND a.resolved_at IS NULL
      GROUP BY s.name
      ORDER BY open_alerts DESC
      LIMIT 5
    `).all(store_id);

    res.json({
      store_id,
      risk_score,
      compliance_pct_24h: compliance,
      red_alerts: red_alerts.count,
      yellow_alerts: yellow_alerts.count,
      open_actions: open_actions.count,
      top_sectors
    });
  });

  app.get('/api/stores/:store_id/alerts', authenticate, (req: any, res) => {
    const store_id = parseInt(req.params.store_id);
    const open_only = req.query.open_only === 'true';
    let query = 'SELECT * FROM alerts WHERE store_id = ?';
    if (open_only) query += ' AND resolved_at IS NULL';
    query += ' ORDER BY created_at DESC LIMIT 200';
    const alerts = db.prepare(query).all(store_id);
    res.json(alerts);
  });

  app.post('/api/alerts/:alert_id/resolve', authenticate, (req: any, res) => {
    if (!['manager', 'ssa', 'auditor'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    const { resolution } = req.query;
    db.prepare('UPDATE alerts SET resolved_at = CURRENT_TIMESTAMP, resolution = ? WHERE id = ?').run(resolution || '', req.params.alert_id);
    res.json({ ok: true });
  });

  app.get('/api/stores/:store_id/actions', authenticate, (req: any, res) => {
    const store_id = parseInt(req.params.store_id);
    const status = req.query.status || 'open';
    const actions = db.prepare('SELECT * FROM actions WHERE store_id = ? AND status = ? ORDER BY created_at DESC LIMIT 200').all(store_id, status);
    res.json(actions);
  });

  app.post('/api/actions/:action_id/complete', authenticate, (req: any, res) => {
    const { evidence } = req.body;
    db.prepare('UPDATE actions SET status = "done", completed_at = CURRENT_TIMESTAMP, completed_by = ?, evidence = ? WHERE id = ?')
      .run(req.user.id, JSON.stringify(evidence || {}), req.params.action_id);
    
    // Integration Push
    const action: any = db.prepare('SELECT * FROM actions WHERE id = ?').get(req.params.action_id);
    if (action) {
      pushToSalesRun(action.store_id, {
        type: 'ACTION_COMPLETED',
        action_id: action.id,
        title: action.title,
        completed_by: req.user.sub,
        evidence: evidence
      });
    }
    
    res.json({ ok: true });
  });

  app.get('/api/devices/:device_id/history', authenticate, (req: any, res) => {
    const history = db.prepare(`
      SELECT ts, value 
      FROM readings 
      WHERE device_id = ? 
      ORDER BY ts DESC 
      LIMIT 50
    `).all(req.params.device_id);
    res.json(history.reverse());
  });

  // --- Admin Routes ---
  app.get('/api/admin/devices', authenticate, (req: any, res) => {
    if (req.user.role !== 'ssa' && req.user.role !== 'auditor') return res.status(403).json({ error: 'Forbidden' });
    const store_id = req.query.store_id;
    let query = 'SELECT d.*, s.name as sector FROM devices d JOIN sectors s ON d.sector_id = s.id';
    if (store_id) query += ' WHERE d.store_id = ' + parseInt(store_id as string);
    const devices = db.prepare(query).all();
    res.json(devices);
  });

  app.post('/api/admin/devices', authenticate, (req: any, res) => {
    if (req.user.role !== 'ssa') return res.status(403).json({ error: 'Forbidden' });
    const { store_id, sector_code, device_uid, device_type, location } = req.body;
    const sector: any = db.prepare('SELECT id FROM sectors WHERE code = ?').get(sector_code);
    if (!sector) return res.status(400).json({ error: 'Invalid sector' });
    
    db.prepare(`
      INSERT INTO devices (store_id, sector_id, device_uid, device_type, location)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(store_id, device_uid) DO UPDATE SET
        sector_id=excluded.sector_id,
        device_type=excluded.device_type,
        location=excluded.location
    `).run(store_id, sector.id, device_uid, device_type, location);
    res.json({ ok: true });
  });

  app.get('/api/admin/thresholds', authenticate, (req: any, res) => {
    const thresholds = db.prepare('SELECT t.*, s.name as sector FROM thresholds t JOIN sectors s ON t.sector_id = s.id').all();
    res.json(thresholds);
  });

  app.post('/api/admin/thresholds', authenticate, (req: any, res) => {
    if (req.user.role !== 'ssa') return res.status(403).json({ error: 'Forbidden' });
    const { sector_code, device_type, min_value, max_value, notes } = req.body;
    const sector: any = db.prepare('SELECT id FROM sectors WHERE code = ?').get(sector_code);
    db.prepare(`
      INSERT INTO thresholds (sector_id, device_type, min_value, max_value, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(sector.id, device_type, min_value, max_value, notes);
    res.json({ ok: true });
  });

  app.post('/api/stores/:store_id/integrations/salesrun', authenticate, (req: any, res) => {
    if (req.user.role !== 'ssa') return res.status(403).json({ error: 'Forbidden' });
    const { api_key, webhook_url } = req.body;
    db.prepare('UPDATE stores SET salesrun_api_key = ?, salesrun_webhook_url = ? WHERE id = ?')
      .run(api_key, webhook_url, req.params.store_id);
    res.json({ ok: true });
  });

  // --- IoT Ingestion ---
  app.post('/api/iot/reading', (req, res) => {
    const { store_id, device_uid, device_type, sector_code, value, unit } = req.body;
    const sector: any = db.prepare('SELECT id FROM sectors WHERE code = ?').get(sector_code);
    if (!sector) return res.status(400).json({ error: 'Invalid sector' });
    
    let device: any = db.prepare('SELECT id FROM devices WHERE store_id = ? AND device_uid = ?').get(store_id, device_uid);
    if (!device) {
      const result = db.prepare('INSERT INTO devices (store_id, sector_id, device_uid, device_type) VALUES (?, ?, ?, ?)').run(store_id, sector.id, device_uid, device_type);
      device = { id: result.lastInsertRowid };
    }

    db.prepare('INSERT INTO readings (device_id, value, unit) VALUES (?, ?, ?)').run(device.id, value, unit);

    // Update device last reading in meta if needed (optional)
    
    // Check thresholds
    const th: any = db.prepare('SELECT * FROM thresholds WHERE sector_id = ? AND device_type = ?').get(sector.id, device_type);
    if (th) {
      if ((th.min_value !== null && value < th.min_value) || (th.max_value !== null && value > th.max_value)) {
        const severity = (th.max_value !== null && value > th.max_value + 2) || (th.min_value !== null && value < th.min_value - 2) ? 'red' : 'yellow';
        
        // Avoid duplicate alerts in short time
        const recent = db.prepare('SELECT id FROM alerts WHERE store_id = ? AND sector_id = ? AND resolved_at IS NULL AND created_at > datetime("now", "-30 minutes")').get(store_id, sector.id);
        if (!recent) {
          db.prepare('INSERT INTO alerts (store_id, sector_id, severity, title, detail) VALUES (?, ?, ?, ?, ?)').run(
            store_id, sector.id, severity, `Temperatura fora do padrão - ${sector_code}`, `Leitura: ${value}${unit}. Faixa: ${th.min_value}..${th.max_value}`
          );
          
          // Integration Push
          pushToSalesRun(store_id, {
            type: 'ALERT',
            severity,
            title: `Temperatura fora do padrão - ${sector_code}`,
            detail: `Leitura: ${value}${unit}. Faixa: ${th.min_value}..${th.max_value}`,
            sector: sector_code
          });

          db.prepare('INSERT INTO actions (store_id, sector_id, title, instruction, assigned_role) VALUES (?, ?, ?, ?, ?)').run(
            store_id, sector.id, 'Verificar equipamento / reposição', 'Checar portas, carga térmica, degelo. Acionar manutenção se necessário.', severity === 'red' ? 'manager' : 'operator'
          );
        }
      }
    }

    res.json({ ok: true });
  });

  // --- Audit PDF (Mock) ---
  app.get('/api/stores/:store_id/audit/pdf', authenticate, (req: any, res) => {
    const store_id = parseInt(req.params.store_id);
    const days = parseInt(req.query.days as string || '7');
    
    // In a real app, we would use reportlab or similar. 
    // Here we return a text-based "report" as a file download.
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    const alerts = db.prepare('SELECT * FROM alerts WHERE store_id = ? AND created_at >= ?').all(store_id, start.toISOString());
    const actions = db.prepare('SELECT * FROM actions WHERE store_id = ? AND created_at >= ?').all(store_id, start.toISOString());
    
    let report = `SSA - RELATORIO DE AUDITORIA\n`;
    report += `Loja: ${store_id} | Periodo: ${days} dias\n`;
    report += `Gerado em: ${new Date().toLocaleString()}\n`;
    report += `------------------------------------------\n\n`;
    
    report += `1) ALERTAS NO PERIODO (${alerts.length})\n`;
    alerts.forEach((a: any) => {
      report += `[${a.severity.toUpperCase()}] ${a.created_at} - ${a.title}\n`;
    });
    
    report += `\n2) ACOES NO PERIODO (${actions.length})\n`;
    actions.forEach((a: any) => {
      report += `[${a.status.toUpperCase()}] ${a.created_at} - ${a.title}\n`;
    });
    
    report += `\n------------------------------------------\n`;
    report += `Assinatura Gerente: ______________________\n`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=auditoria_loja_${store_id}.txt`);
    res.send(report);
  });

  // --- Escalation Logic (Background) ---
  setInterval(() => {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000).toISOString();
    
    // Escalate open actions older than 30 mins
    const toEscalate = db.prepare('SELECT * FROM actions WHERE status = "open" AND created_at < ? AND assigned_role = "operator"').all(thirtyMinsAgo);
    
    toEscalate.forEach((a: any) => {
      db.prepare('UPDATE actions SET status = "escalated", assigned_role = "manager" WHERE id = ?').run(a.id);
      db.prepare('INSERT INTO alerts (store_id, sector_id, severity, title, detail) VALUES (?, ?, "yellow", "Escalonamento: Ação Pendente", "Ação pendente há mais de 30 min. Escalonada para gerente.")')
        .run(a.store_id, a.sector_id);
      
      // Integration Push
      pushToSalesRun(a.store_id, {
        type: 'ESCALATION',
        action_id: a.id,
        title: a.title,
        status: 'escalated',
        reason: 'Time limit exceeded (30m)'
      });
    });
  }, 60000); // Check every minute

  // --- Vite Middleware ---
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    console.log('Starting Vite in middleware mode...');
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          host: '0.0.0.0',
          port: 3000
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite middleware loaded.');
    } catch (e) {
      console.error('Failed to start Vite server:', e);
    }
  } else {
    console.log('Serving static files from dist...');
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:3000 (Mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Critical server startup error:', err);
  process.exit(1);
});
