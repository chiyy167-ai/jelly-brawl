/** 把本机战绩同步到 Supabase；未登录或未配置时静默跳过。 */
import type { MatchResult } from '../game/types';
import { getSupabase } from '../net/supabase';
import { auth } from './auth';
import { loadHistory, type HistoryEntry } from './storage';

const MAX_CLOUD = 50;

interface Row {
  played_at: string;
  mode: HistoryEntry['mode'];
  rank: number;
  total: number;
  score: number;
  kos: number;
}

export async function pushMatchResult(r: MatchResult): Promise<void> {
  const sb = getSupabase();
  const uid = auth.user?.id;
  if (!sb || !uid) return;
  const me = r.ranking.find((x) => x.isPlayer);
  if (!me) return;
  const { error } = await sb.from('match_history').insert({
    user_id: uid,
    played_at: new Date().toISOString(),
    mode: r.mode,
    rank: me.rank,
    total: r.ranking.length,
    score: me.score,
    kos: me.kos,
  });
  if (error) console.warn('上传战绩失败', error.message);
}

/** 登录后：拉取云端战绩，并把本机还没有上传过的补上去 */
export async function syncHistoryAfterLogin(): Promise<HistoryEntry[]> {
  const sb = getSupabase();
  const uid = auth.user?.id;
  if (!sb || !uid) return loadHistory();

  const { data, error } = await sb
    .from('match_history')
    .select('played_at, mode, rank, total, score, kos')
    .eq('user_id', uid)
    .order('played_at', { ascending: false })
    .limit(MAX_CLOUD);

  if (error) {
    console.warn('拉取云端战绩失败', error.message);
    return loadHistory();
  }

  const cloud = ((data ?? []) as Row[]).map(rowToEntry);
  const cloudKeys = new Set(cloud.map(keyOf));
  const missing = loadHistory().filter((h) => !cloudKeys.has(keyOf(h)));
  if (missing.length) {
    await sb.from('match_history').insert(
      missing.map((h) => ({
        user_id: uid,
        played_at: new Date(h.at).toISOString(),
        mode: h.mode,
        rank: h.rank,
        total: h.total,
        score: h.score,
        kos: h.kos,
      })),
    );
  }
  // 再拉一次，保证顺序和上限一致
  const again = await sb
    .from('match_history')
    .select('played_at, mode, rank, total, score, kos')
    .eq('user_id', uid)
    .order('played_at', { ascending: false })
    .limit(MAX_CLOUD);
  return ((again.data ?? data ?? []) as Row[]).map(rowToEntry);
}

export async function fetchCloudHistory(): Promise<HistoryEntry[]> {
  const sb = getSupabase();
  const uid = auth.user?.id;
  if (!sb || !uid) return loadHistory();
  const { data, error } = await sb
    .from('match_history')
    .select('played_at, mode, rank, total, score, kos')
    .eq('user_id', uid)
    .order('played_at', { ascending: false })
    .limit(MAX_CLOUD);
  if (error) {
    console.warn('拉取云端战绩失败', error.message);
    return loadHistory();
  }
  return ((data ?? []) as Row[]).map(rowToEntry);
}

function rowToEntry(r: Row): HistoryEntry {
  return {
    at: new Date(r.played_at).getTime(),
    mode: r.mode,
    rank: r.rank,
    total: r.total,
    score: r.score,
    kos: r.kos,
  };
}

function keyOf(h: HistoryEntry): string {
  // 同一秒内同模式同名次视为同一条，避免登录时重复上传
  return `${Math.floor(h.at / 1000)}|${h.mode}|${h.rank}|${h.total}|${h.score}|${h.kos}`;
}
