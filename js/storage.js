/* ==========================================================================
   storage.js — CAMADA DE PERSISTÊNCIA
   --------------------------------------------------------------------------
   Todo o app lê e grava dados SOMENTE por aqui (objeto global `DB`).
   Hoje os dados ficam no localStorage do navegador. Para migrar para um banco
   real, basta escrever outro adapter com a mesma interface (veja `ApiAdapter`
   no fim do arquivo) e trocar a linha `const adapter = ...`.

   Interface que um adapter precisa ter (todas retornam Promise):
     readTable(nome)            -> array de registros
     mutate(nome, fn)           -> fn(registros) altera o array e devolve um valor
     getKV(chave, padrao)       -> valor
     setKV(chave, valor)
     removeKV(chave)
     wipe()                     -> apaga tudo do app
     usage()                    -> bytes usados (opcional)
   ========================================================================== */
(function (g) {
  'use strict';

  class StorageError extends Error {}

  class LocalStorageAdapter {
    constructor(prefix) {
      this.prefix = prefix || 'sa:';
      this._lock = Promise.resolve();
    }
    // Fila: garante que leitura+gravação de uma operação não se misturem com outra.
    _run(fn) {
      const p = this._lock.then(fn);
      this._lock = p.catch(() => {});
      return p;
    }
    _readSync(name) {
      try { return JSON.parse(localStorage.getItem(this.prefix + 't:' + name) || '[]'); }
      catch (e) { return []; }
    }
    _writeSync(name, rows) {
      try { localStorage.setItem(this.prefix + 't:' + name, JSON.stringify(rows)); }
      catch (e) { throw new StorageError('O armazenamento do navegador está cheio. Remova fotos ou áudios antigos e tente de novo.'); }
    }
    readTable(name) { return this._run(() => this._readSync(name)); }
    mutate(name, fn) {
      return this._run(() => {
        const rows = this._readSync(name);
        const result = fn(rows);
        this._writeSync(name, rows);
        return result;
      });
    }
    getKV(key, fallback) {
      return this._run(() => {
        try {
          const raw = localStorage.getItem(this.prefix + 'k:' + key);
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      });
    }
    setKV(key, value) {
      return this._run(() => {
        try { localStorage.setItem(this.prefix + 'k:' + key, JSON.stringify(value)); }
        catch (e) { throw new StorageError('O armazenamento do navegador está cheio.'); }
      });
    }
    removeKV(key) { return this._run(() => localStorage.removeItem(this.prefix + 'k:' + key)); }
    wipe() {
      return this._run(() => {
        Object.keys(localStorage).filter((k) => k.startsWith(this.prefix)).forEach((k) => localStorage.removeItem(k));
      });
    }
    usage() {
      return this._run(() => Object.keys(localStorage).filter((k) => k.startsWith(this.prefix))
        .reduce((sum, k) => sum + k.length + (localStorage.getItem(k) || '').length, 0) * 2);
    }
    // usado pelo backup/restauração
    dumpAll() {
      return this._run(() => {
        const out = {};
        Object.keys(localStorage).filter((k) => k.startsWith(this.prefix)).forEach((k) => { out[k.slice(this.prefix.length)] = localStorage.getItem(k); });
        return out;
      });
    }
    restoreAll(obj) {
      return this._run(() => {
        Object.keys(localStorage).filter((k) => k.startsWith(this.prefix)).forEach((k) => localStorage.removeItem(k));
        Object.keys(obj).forEach((k) => localStorage.setItem(this.prefix + k, obj[k]));
      });
    }
  }

  /* --------------------------------------------------------------------
     EXEMPLO de adapter para um banco real (não é usado hoje).
     Cada método viraria uma chamada HTTP ao seu backend:

     class ApiAdapter {
       constructor(baseUrl) { this.baseUrl = baseUrl; }
       async readTable(name) { return (await fetch(`${this.baseUrl}/${name}`)).json(); }
       async mutate(name, fn) { ... }   // ou troque por insert/update/remove no servidor
       ...
     }
     -------------------------------------------------------------------- */

  const adapter = new LocalStorageAdapter('sa:');

  class Collection {
    constructor(name, idPrefix) { this.name = name; this.idPrefix = idPrefix; }
    all() { return adapter.readTable(this.name); }
    async get(id) { return (await this.all()).find((r) => r.id === id) || null; }
    async where(pred) { return (await this.all()).filter(pred); }
    async find(pred) { return (await this.all()).find(pred) || null; }
    insert(data) {
      return adapter.mutate(this.name, (rows) => {
        const row = Object.assign({ createdAt: Date.now() }, data);
        row.id = data.id || g.U.uid(this.idPrefix);
        rows.push(row);
        return row;
      });
    }
    insertMany(list) {
      return adapter.mutate(this.name, (rows) => list.map((data) => {
        const row = Object.assign({ createdAt: Date.now() }, data);
        row.id = data.id || g.U.uid(this.idPrefix);
        rows.push(row);
        return row;
      }));
    }
    update(id, patch) {
      return adapter.mutate(this.name, (rows) => {
        const i = rows.findIndex((r) => r.id === id);
        if (i < 0) throw new StorageError('Registro não encontrado.');
        const p = typeof patch === 'function' ? patch(rows[i]) : patch;
        rows[i] = Object.assign({}, rows[i], p, { updatedAt: Date.now() });
        return rows[i];
      });
    }
    remove(id) {
      return adapter.mutate(this.name, (rows) => {
        const i = rows.findIndex((r) => r.id === id);
        if (i >= 0) rows.splice(i, 1);
        return i >= 0;
      });
    }
    removeWhere(pred) {
      return adapter.mutate(this.name, (rows) => {
        let n = 0;
        for (let i = rows.length - 1; i >= 0; i--) if (pred(rows[i])) { rows.splice(i, 1); n++; }
        return n;
      });
    }
  }

  const DB = {
    adapter,
    StorageError,
    users: new Collection('users', 'usr'),
    requests: new Collection('requests', 'req'),
    proposals: new Collection('proposals', 'prop'),
    messages: new Collection('messages', 'msg'),
    notifications: new Collection('notifications', 'not'),
    transactions: new Collection('transactions', 'trx'),
    kv: { get: (k, d) => adapter.getKV(k, d), set: (k, v) => adapter.setKV(k, v), remove: (k) => adapter.removeKV(k) },
    async reset() { await adapter.wipe(); },
    dump: () => adapter.dumpAll(),
    async restore(obj) { await adapter.restoreAll(obj); },
    usage: () => adapter.usage()
  };

  g.DB = DB;
})(window);
