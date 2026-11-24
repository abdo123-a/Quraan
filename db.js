/**
 * QuranDB: Reliable dual-layer persistence (IndexedDB primary + localStorage mirror)
 * Ensures the permanent reading marker and user preferences survive refreshes,
 * browser restarts, offline launches, and style/theme switches.
 */
const QuranDB = (() => {
  const DB_NAME = 'OfflineHolyQuranDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'app_state';
  const LS_PREFIX = 'hq_v1_';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  function lsGet(key) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(LS_PREFIX + key);
      } else {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      }
    } catch (_) {}
  }

  async function get(key) {
    const db = await openDB();
    if (db) {
      try {
        const val = await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
          req.onerror = () => resolve(undefined);
        });
        if (val !== undefined) {
          lsSet(key, val); // keep mirror synced
          return val;
        }
      } catch (_) {}
    }
    return lsGet(key);
  }

  async function set(key, value) {
    lsSet(key, value);
    const db = await openDB();
    if (db) {
      try {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({ key, value, updatedAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (_) {}
    }
    return true;
  }

  async function remove(key) {
    lsSet(key, null);
    const db = await openDB();
    if (db) {
      try {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (_) {}
    }
    return true;
  }

  return {
    getMarker: () => get('reading_marker'),
    setMarker: (marker) => set('reading_marker', marker),
    clearMarker: () => remove('reading_marker'),
    getSettings: () => get('user_settings'),
    setSettings: (settings) => set('user_settings', settings),
    getLastView: () => get('last_view'),
    setLastView: (view) => set('last_view', view)
  };
})();
