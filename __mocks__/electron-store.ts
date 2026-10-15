/**
 * electron-store is ESM only, which Jest can't load. Jest uses this
 * in-memory stand-in instead, so tests never touch a real config file.
 */
export default class ElectronStore<T extends Record<string, unknown>> {
  store = {} as T;

  has(key: keyof T) {
    return key in this.store;
  }

  get(key: keyof T) {
    return this.store[key];
  }

  set(key: keyof T, value: T[keyof T]) {
    this.store[key] = value;
  }

  delete(key: keyof T) {
    delete this.store[key];
  }

  onDidAnyChange() {
    return () => {};
  }
}
