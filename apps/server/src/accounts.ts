/** 账号库：邮箱不存在就自动建号。文件库在 data/accounts.json，启动时写入开发者账号。 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME } from '../../client/src/game/config';

interface AuthResponse {
  setHeader(name: string, value: string): void;
  status(code: number): { end(): void; json(body: unknown): void };
  json(body: unknown): void;
}

interface AuthRequest {
  on(event: 'data', cb: (chunk: Buffer) => void): void;
  on(event: 'end', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
}

interface AuthApp {
  options(path: string, handler: (req: AuthRequest, res: AuthResponse) => void): void;
  post(path: string, handler: (req: AuthRequest, res: AuthResponse) => void): void;
}

const DEV_EMAIL = 'admin@jb.com';
const DEV_PASSWORD = 'happy123';
const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'accounts.json');

interface UserRow {
  email: string;
  salt: string;
  hash: string;
  coins: number;
  role: 'admin' | 'player';
  createdAt: number;
}

interface Db {
  users: UserRow[];
}

function hashPassword(salt: string, password: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function load(): Db {
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as Db;
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch {
    return { users: [] };
  }
}

function save(db: Db): void {
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, FILE);
}

function ensureDeveloper(): void {
  const db = load();
  if (db.users.some((u) => u.email === DEV_EMAIL)) return;
  const salt = randomBytes(8).toString('hex');
  db.users.push({
    email: DEV_EMAIL,
    salt,
    hash: hashPassword(salt, DEV_PASSWORD),
    coins: GAME.economy.newUserCoins,
    role: 'admin',
    createdAt: Date.now(),
  });
  save(db);
}

export type LoginResult =
  | { ok: true; email: string; isNew: boolean; coins: number }
  | { ok: false; error: string };

/** 邮箱已存在则核对密码；不存在则建号并赠送见面礼金币 */
export function loginOrCreate(email: string, password: string): LoginResult {
  const addr = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return { ok: false, error: '请填写正确的邮箱' };
  if (password.length < 6) return { ok: false, error: '密码至少 6 位' };
  const db = load();
  const found = db.users.find((u) => u.email === addr);
  if (found) {
    if (hashPassword(found.salt, password) !== found.hash) return { ok: false, error: '邮箱或密码不对' };
    return { ok: true, email: addr, isNew: false, coins: found.coins };
  }
  const salt = randomBytes(8).toString('hex');
  const coins = GAME.economy.newUserCoins;
  db.users.push({
    email: addr, salt, hash: hashPassword(salt, password), coins, role: 'player', createdAt: Date.now(),
  });
  save(db);
  return { ok: true, email: addr, isNew: true, coins };
}

function cors(res: AuthResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function readBody(req: AuthRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 4096) reject(new Error('too big'));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function attachAccounts(app: AuthApp): void {
  ensureDeveloper();
  app.options('/auth/login', (_req, res) => {
    cors(res);
    res.status(204).end();
  });
  app.post('/auth/login', async (req, res) => {
    cors(res);
    res.setHeader('cache-control', 'no-store');
    try {
      const body = JSON.parse((await readBody(req)) || '{}') as { email?: string; password?: string };
      const result = loginOrCreate(String(body.email ?? ''), String(body.password ?? ''));
      res.status(result.ok ? 200 : 400).json(result);
    } catch {
      res.status(400).json({ ok: false, error: '登录请求读不懂' });
    }
  });
}
