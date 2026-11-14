import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The starter's auth helper deliberately ignores bearer tokens on web, because its own flow is
 * cookie-based. Celestial Baymax uses an owner session token on every platform, so it keeps its
 * own small store: AsyncStorage (localStorage on web, encrypted store on native) plus a memory
 * cache for the synchronous request headers.
 */
export const OWNER_TOKEN_KEY = "celestial.ownerToken";

let cached: string | null = null;
let loaded = false;

export async function loadOwnerToken(): Promise<string | null> {
  if (loaded) return cached;
  try {
    cached = await AsyncStorage.getItem(OWNER_TOKEN_KEY);
  } catch {
    cached = null;
  }
  loaded = true;
  return cached;
}

export function getCachedOwnerToken(): string | null {
  return cached;
}

export async function setOwnerToken(token: string): Promise<void> {
  cached = token;
  loaded = true;
  await AsyncStorage.setItem(OWNER_TOKEN_KEY, token);
}

export async function clearOwnerToken(): Promise<void> {
  cached = null;
  loaded = true;
  await AsyncStorage.removeItem(OWNER_TOKEN_KEY);
}
