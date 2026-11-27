import { useCallback, useRef, useState } from 'react';
import { getCuisineMeta } from '../data/cuisines';
import type { LanguageType, Recipe } from '../types';
import { apiFetch } from '../utils/api';

export type RecipeVideo = { id: string; title: string; channel: string; thumbnail: string; url: string };
export type VideoState = { status: 'loading' | 'ready' | 'error' | 'not_configured'; videos?: RecipeVideo[]; expiresAt?: number };
const CACHE_KEY = 'coldscan_recipe_videos_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

export function videoSearchKey(recipe: Recipe, language: LanguageType): string {
  return JSON.stringify([recipe.name.trim(), getCuisineMeta(recipe.cuisine)?.name || recipe.cuisine?.trim() || '', language]);
}

function readCache(): Record<string, VideoState> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, VideoState>).filter(([, value]) => {
      const entry = value as VideoState;
      return entry?.status === 'ready' && Array.isArray(entry.videos) && typeof entry.expiresAt === 'number' && entry.expiresAt > Date.now() && entry.expiresAt <= Date.now() + TTL_MS;
    }));
  } catch { return {}; }
}

export function useRecipeVideos() {
  const [states, setStates] = useState<Record<string, VideoState>>(readCache);
  const statesRef = useRef(states);
  const pending = useRef(new Set<string>());

  const update = useCallback((key: string, value: VideoState) => {
    const next: Record<string, VideoState> = { ...statesRef.current, [key]: value };
    statesRef.current = next;
    setStates(next);
    try {
      const ready = Object.fromEntries(Object.entries(next).filter(([, item]) => item.status === 'ready' && (item.expiresAt || 0) > Date.now()).slice(-100));
      localStorage.setItem(CACHE_KEY, JSON.stringify(ready));
    } catch { /* The in-memory cache still works if browser storage is unavailable. */ }
  }, []);

  const search = useCallback(async (recipe: Recipe, language: LanguageType) => {
    const key = videoSearchKey(recipe, language);
    const existing = statesRef.current[key];
    if (pending.current.has(key) || (existing?.status === 'ready' && (existing.expiresAt || 0) > Date.now())) return;
    pending.current.add(key);
    update(key, { status: 'loading' });
    try {
      const response = await apiFetch('/api/recipe-videos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: recipe.name.trim(), cuisine: getCuisineMeta(recipe.cuisine)?.name || recipe.cuisine?.trim() || '', language }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.videos) || typeof data.expiresAt !== 'number') {
        update(key, { status: data.code === 'not_configured' ? 'not_configured' : 'error' });
      } else {
        update(key, { status: 'ready', videos: data.videos.slice(0, 3), expiresAt: Math.min(data.expiresAt, Date.now() + TTL_MS) });
      }
    } catch {
      update(key, { status: 'error' });
    } finally {
      pending.current.delete(key);
    }
  }, [update]);

  return { states, search };
}
