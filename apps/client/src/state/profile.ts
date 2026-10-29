/** 云端游戏昵称：登录后读写 profiles；未登录只用本机 loadName。 */
import { getSupabase } from '../net/supabase';
import { auth } from './auth';
import { loadProgress } from './progress';
import { cleanProfile } from '../net/protocol';
import { loadName, saveName } from './storage';

/** 清洗昵称（与联机协议同一套规则） */
export function cleanNickname(raw: string): string {
  return cleanProfile({ name: raw }).name;
}

/** 登录后：拉取云端昵称 → 写本机；再把本机等级推上去 */
export async function syncProfileAfterLogin(): Promise<string> {
  const sb = getSupabase();
  const uid = auth.user?.id;
  if (!sb || !uid) return loadName();

  const localName = cleanNickname(loadName());
  const level = loadProgress().level;

  const { data, error } = await sb
    .from('profiles')
    .select('nickname, level')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.warn('拉取资料失败', error.message);
    return localName;
  }

  if (data?.nickname) {
    const nick = cleanNickname(data.nickname);
    saveName(nick);
    // 用本机等级刷新云端（本机可能更高）
    await sb.from('profiles').upsert({
      user_id: uid,
      nickname: nick,
      level: Math.max(level, Number(data.level) || 1),
      updated_at: new Date().toISOString(),
    });
    return nick;
  }

  // 还没有行：用本机昵称创建
  await sb.from('profiles').upsert({
    user_id: uid,
    nickname: localName,
    level,
    updated_at: new Date().toISOString(),
  });
  return localName;
}

/** 保存昵称到本机 + 云端（已登录时） */
export async function saveNickname(raw: string): Promise<string | null> {
  const nick = cleanNickname(raw);
  saveName(nick);
  const sb = getSupabase();
  const uid = auth.user?.id;
  if (!sb || !uid) return null;
  const { error } = await sb.from('profiles').upsert({
    user_id: uid,
    nickname: nick,
    level: loadProgress().level,
    updated_at: new Date().toISOString(),
  });
  return error ? error.message : null;
}

/** 结算后把等级刷到云端（未登录则跳过） */
export async function pushLevelToCloud(): Promise<void> {
  const sb = getSupabase();
  const uid = auth.user?.id;
  if (!sb || !uid) return;
  const { error } = await sb.from('profiles').upsert({
    user_id: uid,
    nickname: cleanNickname(loadName()),
    level: loadProgress().level,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('同步等级失败', error.message);
}
