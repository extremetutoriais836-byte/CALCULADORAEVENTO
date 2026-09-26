/* =========================================================
   Papo de Business · Check-in  (v2)
   App 100% estático. Dados salvos no localStorage do aparelho.
   - Busca em ordem alfabética (uma letra lista todos com aquela letra)
   - Cadastro manual de convidados
   - Cruzamento de dados a cada nova planilha (e-mail > telefone > nome)
   ========================================================= */
(function () {
  "use strict";

  // ---------- storage ----------
  const KEYS = { guests: "pdb.guests.v1", checkins: "pdb.checkins.v1", meta: "pdb.meta.v1" };
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { toast("Não foi possível salvar neste aparelho (armazenamento cheio ou bloqueado).", "warn"); return false; }
    },
    del(key) { try { localStorage.removeItem(key); } catch (e) { /* noop */ } }
  };

  // guest: { id, name, phone, email, paid, premium, source: "planilha"|"manual", addedAt?, manualMerged? }
  let guests = store.get(KEYS.guests, []);
  // checkins: { guestId: { at, companions:[{name,phone,at}], snapshot:{name,phone,email,premium,paid,source} } }
  let checkins = store.get(KEYS.checkins, {});
  // meta: { files:[{name, importedAt, count, mode}] }
  let meta = migrateMeta(store.get(KEYS.meta, null));
  guests.forEach(prep);

  function migrateMeta(m) {
    if (!m) return { files: [] };
    if (!m.files) return { files: m.fileName ? [{ name: m.fileName, importedAt: m.importedAt, count: m.total, mode: "replace" }] : [] };
    return m;
  }
  function prep(g) {
    if (!g.source) g.source = "planilha";
    g._n = norm(g.name);
    g._d = digits(g.phone);
    g._e = (g.email || "").toLowerCase();
    g._w = g._n.split(" ");
    return g;
  }
  function clean(g) { const { _n, _d, _e, _w, ...rest } = g; return rest; }
  function persist() {
    store.set(KEYS.guests, guests.map(clean));
    store.set(KEYS.checkins, checkins);
    store.set(KEYS.meta, meta);
  }
  function persistCheckins() { store.set(KEYS.checkins, checkins); }
  function byId(id) { return guests.find(g => g.id === id) || null; }

  // ---------- helpers ----------
  function norm(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9@.\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function digits(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }
  function phoneKey(p) { const d = digits(p); return d.length >= 8 ? d.slice(-8) : ""; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function fmtPhone(p) {
    let d = digits(p);
    if (!d) return "";
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
    return String(p).trim();
  }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function fmtDateTime(ts) { return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  function titleCase(s) {
    const low = ["da", "de", "do", "das", "dos", "e"];
    return String(s || "").trim().replace(/\s+/g, " ").toLowerCase()
      .split(" ").map((w, i) => (i > 0 && low.includes(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }
  function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* noop */ } }
  const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
  const byName = (a, b) => collator.compare(a.name, b.name);
  function firstLetter(g) { const c = (g._n || "").charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>',
    chev: '<svg class="result__chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'
  };

  // ---------- spreadsheet value parsing ----------
  const YES = ["sim", "s", "yes", "y", "true", "verdadeiro", "1", "x", "ok", "pago", "paga", "pagou", "aprovado", "aprovada", "confirmado", "confirmada", "comprou", "comprado", "premium", "vip", "ativo", "concluido", "concluida", "completo"];
  function isYes(v) {
    if (v === true || v === 1) return true;
    const n = norm(v);
    if (!n) return false;
    if (YES.includes(n)) return true;
    if (/^(nao|n|no|false|falso|0|pendente|cancelad[oa]|reembolsad[oa]|estornad[oa]|recusad[oa]|expirad[oa]|geral|comum|normal)$/.test(n)) return false;
    return /\b(sim|pago|aprovad|premium|vip|confirmad)/.test(n);
  }

  // ---------- column detection ----------
  const COLS = {
    name: ["nome", "nome completo", "name", "participante", "convidado", "cliente", "comprador", "nome do participante", "nome do convidado", "full name"],
    phone: ["numero", "número", "telefone", "celular", "whatsapp", "whats", "fone", "phone", "contato", "tel", "numero de telefone", "telefone celular", "numero whatsapp"],
    email: ["email", "e-mail", "e mail", "mail", "endereco de email"],
    paid: ["comprou", "compra", "pago", "pagou", "pagamento", "status pagamento", "status do pagamento", "status", "comprado", "paid", "situacao", "compra realizada", "ingresso pago"],
    premium: ["premium", "vip", "e premium", "é premium", "tipo", "tipo ingresso", "tipo de ingresso", "categoria", "ingresso", "lote", "plano"]
  };
  function keyOf(h) { return norm(h).replace(/[?:]/g, "").trim(); }
  function detectColumns(headers) {
    const map = {};
    const used = new Set();
    const hn = headers.map(keyOf);
    for (const pass of ["exact", "contains"]) {
      for (const field of Object.keys(COLS)) {
        if (map[field] != null) continue;
        const cands = COLS[field].map(keyOf);
        for (let i = 0; i < hn.length; i++) {
          if (used.has(i) || !hn[i]) continue;
          const ok = pass === "exact" ? cands.includes(hn[i]) : cands.some(c => c.length > 3 && hn[i].includes(c));
          if (ok) { map[field] = i; used.add(i); break; }
        }
      }
    }
    return map;
  }
  function baseId(r) {
    return r.email ? "e:" + r.email : phoneKey(r.phone) ? "p:" + phoneKey(r.phone) : "n:" + norm(r.name);
  }
  function parseRows(rows, fileName) {
    let headerIdx = -1, map = null;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = (rows[i] || []).map(v => String(v == null ? "" : v));
      const m = detectColumns(r);
      if (m.name != null) { headerIdx = i; map = m; break; }
    }
    if (headerIdx < 0) {
      return { error: "Não encontrei a coluna de nome. A primeira linha da planilha precisa ter os títulos (Nome, Número, E-mail, Comprou, Premium)." };
    }
    const headers = (rows[headerIdx] || []).map(v => String(v == null ? "" : v).trim());
    const out = [];
    let skipped = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const rawName = String(r[map.name] == null ? "" : r[map.name]).trim();
      if (!rawName) { if (r.some(v => String(v == null ? "" : v).trim())) skipped++; continue; }
      const name = rawName.replace(/\s+/g, " ");
      const phone = map.phone != null ? String(r[map.phone] == null ? "" : r[map.phone]).trim() : "";
      const email = map.email != null ? String(r[map.email] == null ? "" : r[map.email]).trim().toLowerCase() : "";
      const paid = map.paid != null ? isYes(r[map.paid]) : false;
      const premium = map.premium != null ? isYes(r[map.premium]) : false;
      out.push({ name, phone, email, paid, premium });
    }
    return { rows: out, headers, map, skipped, fileName };
  }

  // =========================================================
  //  CRUZAMENTO DE DADOS
  //  Mesma pessoa = mesmo e-mail, ou mesmo telefone (8 últimos
  //  dígitos), ou mesmo nome completo sem conflito de e-mail/telefone.
  // =========================================================
  function buildIndex(list) {
    const e = new Map(), p = new Map(), n = new Map();
    list.forEach(g => {
      const em = (g.email || "").toLowerCase();
      if (em && !e.has(em)) e.set(em, g);
      const pk = phoneKey(g.phone);
      if (pk && !p.has(pk)) p.set(pk, g);
      const nk = norm(g.name);
      if (nk) { if (!n.has(nk)) n.set(nk, []); n.get(nk).push(g); }
    });
    return { e, p, n };
  }
  function compatible(a, b) {
    const ea = (a.email || "").toLowerCase(), eb = (b.email || "").toLowerCase();
    if (ea && eb && ea !== eb) return false;
    const pa = phoneKey(a.phone), pb = phoneKey(b.phone);
    if (pa && pb && pa !== pb) return false;
    return true;
  }
  function findMatch(g, idx, used) {
    const free = c => c && !(used && used.has(c.id));
    const em = (g.email || "").toLowerCase();
    if (em) { const m = idx.e.get(em); if (free(m)) return { g: m, by: "e-mail" }; }
    const pk = phoneKey(g.phone);
    if (pk) { const m = idx.p.get(pk); if (free(m) && compatible(g, m)) return { g: m, by: "telefone" }; }
    const list = idx.n.get(norm(g.name)) || [];
    const m = list.find(c => free(c) && compatible(g, c));
    if (m) return { g: m, by: "nome" };
    return null;
  }
  function newId(prefix, taken) {
    let id;
    do { id = prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); } while (taken.has(id));
    taken.add(id);
    return id;
  }
  function uniqueId(base, taken) {
    let id = base, k = 2;
    while (taken.has(id)) id = base + "#" + (k++);
    taken.add(id);
    return id;
  }

  /** Planeja a importação sem alterar nada (usado na prévia e na aplicação). */
  function planImport(rows, mode) {
    const current = guests.map(g => Object.assign({}, clean(g)));
    const idx = buildIndex(current);
    const used = new Set();
    const taken = new Set(current.map(g => g.id));
    const st = { novos: 0, atualizados: 0, manuaisUnificados: 0, manuaisMantidos: 0, removidos: 0, duplicadosPlanilha: 0 };
    let result;

    if (mode === "replace") {
      result = [];
      const seenInFile = buildIndex([]);
      for (const r of rows) {
        // duplicado dentro da própria planilha → une
        const dupIn = findMatch(r, seenInFile);
        if (dupIn) {
          const t = dupIn.g;
          t.paid = t.paid || r.paid; t.premium = t.premium || r.premium;
          t.phone = t.phone || r.phone; t.email = t.email || r.email;
          st.duplicadosPlanilha++;
          continue;
        }
        const m = findMatch(r, idx, used);
        let g;
        if (m) {
          used.add(m.g.id);
          g = Object.assign({}, r, { id: m.g.id, source: "planilha" });
          g.phone = r.phone || m.g.phone;
          g.email = r.email || m.g.email;
          if (m.g.source === "manual" || m.g.manualMerged) {
            // o que a equipe marcou na porta não se perde
            g.paid = r.paid || m.g.paid;
            g.premium = r.premium || m.g.premium;
            g.manualMerged = true;
            g.addedAt = m.g.addedAt;
            if (m.g.source === "manual") st.manuaisUnificados++; else st.atualizados++;
          } else st.atualizados++;
        } else {
          st.novos++;
          g = Object.assign({}, r, { id: uniqueId(baseId(r), taken), source: "planilha" });
        }
        result.push(g);
        pushIndex(seenInFile, g);
      }
      current.filter(g => g.source === "manual" && !used.has(g.id)).forEach(g => { result.push(g); st.manuaisMantidos++; });
      st.removidos = current.filter(g => g.source !== "manual" && !used.has(g.id)).length;
    } else {
      // somar à lista atual
      result = current;
      const ridx = idx;
      for (const r of rows) {
        const m = findMatch(r, ridx);
        if (m) {
          const t = m.g;
          const wasManual = t.source === "manual";
          t.phone = t.phone || r.phone; t.email = t.email || r.email;
          t.paid = t.paid || r.paid; t.premium = t.premium || r.premium;
          if (wasManual) { t.source = "planilha"; t.manualMerged = true; st.manuaisUnificados++; }
          else if (used.has(t.id)) st.duplicadosPlanilha++;
          else st.atualizados++;
          used.add(t.id);
        } else {
          const g = Object.assign({}, r, { id: uniqueId(baseId(r), taken), source: "planilha" });
          result.push(g);
          pushIndex(ridx, g);
          used.add(g.id);
          st.novos++;
        }
      }
      st.manuaisMantidos = result.filter(g => g.source === "manual").length;
    }

    // confirmações: mantém, religa pelo cruzamento ou marca como fora da lista
    const ids = new Set(result.map(g => g.id));
    const fidx = buildIndex(result);
    const rekey = {};
    const target = new Set(Object.keys(checkins).filter(id => ids.has(id)));
    let kept = 0, relinked = 0, orphan = 0;
    for (const [id, ci] of Object.entries(checkins)) {
      if (ids.has(id)) { kept++; continue; }
      const m = findMatch(ci.snapshot || {}, fidx);
      if (m && !target.has(m.g.id)) { rekey[id] = m.g.id; target.add(m.g.id); relinked++; }
      else orphan++;
    }
    return { result, st, kept, relinked, orphan, rekey, mode };
  }
  function pushIndex(idx, g) {
    const em = (g.email || "").toLowerCase();
    if (em && !idx.e.has(em)) idx.e.set(em, g);
    const pk = phoneKey(g.phone);
    if (pk && !idx.p.has(pk)) idx.p.set(pk, g);
    const nk = norm(g.name);
    if (nk) { if (!idx.n.has(nk)) idx.n.set(nk, []); idx.n.get(nk).push(g); }
  }
  function applyImport(plan, fileName) {
    guests = plan.result.map(prep);
    Object.entries(plan.rekey).forEach(([from, to]) => { checkins[to] = checkins[from]; delete checkins[from]; });
    guests.forEach(g => { if (checkins[g.id]) checkins[g.id].snapshot = snapshotOf(g); });
    const entry = { name: fileName, importedAt: Date.now(), count: plan.result.filter(g => g.source !== "manual").length, mode: plan.mode };
    meta.files = plan.mode === "replace" ? [entry] : (meta.files || []).concat(entry);
    persist();
  }
  function snapshotOf(g) { return { name: g.name, phone: g.phone, email: g.email, premium: !!g.premium, paid: !!g.paid, source: g.source }; }

  // =========================================================
  //  BUSCA PELO INÍCIO DO NOME COMPLETO (ordem alfabética)
  //  "D"    → só quem tem o nome começando com D, de A a Z
  //  "Davi" → primeiro os "Davi…", logo abaixo os demais com D
  //  Telefone (números) ou e-mail (@) também funcionam.
  //  groups[0] = começa com o termo digitado
  //  groups[1] = demais nomes com a mesma letra inicial
  //  groups[2] = (só se nada começar com a letra) termo no meio do nome
  // =========================================================
  function search(q) {
    const nq = norm(q);
    const empty = { groups: [[], [], []], total: 0, kind: "name", nq };
    if (!nq) return empty;
    const dq = digits(q);
    const compact = nq.replace(/\s/g, "");
    const isDigits = dq.length >= 3 && dq.length >= compact.length - 2;
    const isEmail = nq.includes("@");
    const groups = [[], [], []];

    if (isDigits || isEmail) {
      for (const g of guests) {
        if (isDigits ? g._d.includes(dq) : (g._e && g._e.includes(compact))) groups[0].push(g);
      }
      groups[0].sort(byName);
      return { groups, total: groups[0].length, kind: isDigits ? "phone" : "email", nq };
    }

    const letter = nq.charAt(0);
    for (const g of guests) {
      if (g._n.startsWith(nq)) groups[0].push(g);
      else if (nq.length > 1 && g._n.charAt(0) === letter) groups[1].push(g);
    }
    if (!groups[0].length && !groups[1].length && nq.length >= 2) {
      const tokens = nq.split(" ").filter(Boolean);
      for (const g of guests) if (tokens.every(t => g._w.some(w => w.startsWith(t)))) groups[2].push(g);
    }
    groups.forEach(arr => arr.sort(byName));
    return { groups, total: groups[0].length + groups[1].length + groups[2].length, kind: "name", nq };
  }
  // destaca os primeiros n caracteres (sem acento) do nome
  function highlightPrefix(name, n) {
    if (!n) return esc(name);
    const chars = Array.from(name);
    let html = "<mark>", count = 0, i = 0;
    for (; i < chars.length && count < n; i++) {
      html += esc(chars[i]);
      count += (norm(chars[i]) || " ").length;
    }
    html += "</mark>";
    for (; i < chars.length; i++) html += esc(chars[i]);
    return html;
  }

  // ---------- DOM refs ----------
  const el = {
    tabs: $$(".tab"),
    views: { checkin: $("#view-checkin"), confirmados: $("#view-confirmados") },
    tabCount: $("#tabCount"),
    emptyBase: $("#emptyBase"),
    checkinArea: $("#checkinArea"),
    searchInput: $("#searchInput"),
    searchClear: $("#searchClear"),
    searchStats: $("#searchStats"),
    alpha: $("#alpha"),
    resultsHead: $("#resultsHead"),
    results: $("#results"),
    noResult: $("#noResult"),
    noResultText: $("#noResultText"),
    sheet: $("#sheet"),
    sheetBody: $("#sheetBody"),
    stats: $("#stats"),
    confList: $("#confList"),
    confEmpty: $("#confEmpty"),
    confSearch: $("#confSearch"),
    baseInfo: $("#baseInfo"),
    manualBox: $("#manualBox"),
    fileInput: $("#fileInput"),
    dropzone: $("#dropzone"),
    preview: $("#preview"),
    modal: $("#modal"),
    toast: $("#toast")
  };

  // ---------- tabs ----------
  function showView(name) {
    el.tabs.forEach(t => {
      const on = t.dataset.view === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(el.views).forEach(([k, v]) => { v.hidden = k !== name; v.classList.toggle("is-active", k === name); });
    if (name === "confirmados") renderConfirmados();
    if (name === "checkin") { renderCheckinState(); renderResults(); setTimeout(() => el.searchInput.focus(), 50); }
    window.scrollTo({ top: 0 });
  }
  el.tabs.forEach(t => t.addEventListener("click", () => showView(t.dataset.view)));
  $$("[data-goto-upload]").forEach(b => b.addEventListener("click", () => {
    showView("confirmados");
    setTimeout(() => $("#uploadPanel").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }));
  $$("[data-add-guest]").forEach(b => b.addEventListener("click", () => manualForm("")));
  $("#addFromSearch").addEventListener("click", () => {
    const q = el.searchInput.value.trim();
    const isPhone = digits(q).length >= 8 && digits(q).length >= q.replace(/\D/g, "").length;
    manualForm(isPhone ? "" : q, isPhone ? q : "");
  });

  // ---------- check-in view ----------
  function counts() {
    const ids = Object.keys(checkins);
    const comps = ids.reduce((s, id) => s + (checkins[id].companions || []).length, 0);
    const paid = guests.filter(g => g.paid).length;
    const premiumIn = ids.filter(id => checkins[id].snapshot && checkins[id].snapshot.premium).length;
    const paidIn = guests.filter(g => g.paid && checkins[g.id]).length;
    return { guestsIn: ids.length, comps, total: ids.length + comps, paid, premiumIn, pending: Math.max(0, paid - paidIn), listTotal: guests.length };
  }
  function renderCheckinState() {
    const has = guests.length > 0;
    el.emptyBase.hidden = has;
    el.checkinArea.hidden = !has;
    const c = counts();
    el.tabCount.textContent = c.guestsIn;
    el.searchStats.innerHTML = has
      ? `<span><b>${c.listTotal}</b> na lista</span><span><b>${c.guestsIn}</b> confirmados</span><span><b>${c.comps}</b> acompanhantes</span><span><b>${c.pending}</b> pagantes a chegar</span>`
      : "";
  }

  let browseAll = false;
  let activeLetter = "";
  function renderAlpha() {
    if (!guests.length) { el.alpha.innerHTML = ""; return; }
    const have = new Set(guests.map(firstLetter));
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    if (have.has("#")) letters.push("#");
    el.alpha.innerHTML =
      `<button class="alpha__btn alpha__btn--all ${browseAll ? "is-active" : ""}" type="button" data-letter="*">Todos</button>` +
      letters.map(l => `<button class="alpha__btn ${activeLetter === l && !browseAll ? "is-active" : ""}" type="button" data-letter="${l}" ${have.has(l) ? "" : "disabled"}>${l}</button>`).join("");
  }
  el.alpha.addEventListener("click", e => {
    const b = e.target.closest("[data-letter]");
    if (!b || b.disabled) return;
    const l = b.dataset.letter;
    if (l === "*") { browseAll = !browseAll; el.searchInput.value = ""; }
    else { browseAll = false; el.searchInput.value = l === "#" ? "" : l; }
    renderResults();
    if (l !== "*" && l !== "#") el.searchInput.focus();
  });

  let flatResults = [];
  let primaryResults = [];
  function resultItem(g, hl) {
    const ci = checkins[g.id];
    const sub = [fmtPhone(g.phone), g.email].filter(Boolean).join(" · ");
    const badges = [];
    if (ci) badges.push(`<span class="badge badge--in">Já entrou ${fmtTime(ci.at)}</span>`);
    else badges.push(g.paid ? `<span class="badge badge--ok">Pago</span>` : `<span class="badge badge--no">Não pago</span>`);
    if (g.premium) badges.push(`<span class="badge badge--premium">Premium</span>`);
    if (g.source === "manual") badges.push(`<span class="badge badge--manual">Manual</span>`);
    return `<li><button class="result" type="button" data-id="${esc(g.id)}">
      <span class="result__avatar ${g.premium ? "result__avatar--premium" : ""}">${esc(initials(g.name))}</span>
      <span class="result__main">
        <span class="result__name">${highlightPrefix(g.name, hl || 0)}</span>
        ${sub ? `<span class="result__sub">${esc(sub)}</span>` : ""}
      </span>
      <span class="result__badges">${badges.join("")}</span>
      ${ICON.chev}
    </button></li>`;
  }
  function renderResults() {
    const q = el.searchInput.value;
    const qt = q.trim();
    if (qt) browseAll = false;
    el.searchClear.hidden = !q;
    el.noResult.hidden = true;
    el.resultsHead.hidden = true;

    // letra ativa na barra A–Z = primeira letra do nome digitado
    const nq = norm(qt);
    activeLetter = /^[a-z]/.test(nq) && !nq.includes("@") ? nq.charAt(0).toUpperCase() : "";
    renderAlpha();

    if (browseAll) {
      const all = guests.slice().sort(byName);
      flatResults = all;
      let html = "", last = "";
      all.forEach(g => {
        const l = firstLetter(g);
        if (l !== last) { html += `<li class="res-group"><span class="res-letter">${l}</span></li>`; last = l; }
        html += resultItem(g, 0);
      });
      el.results.innerHTML = html;
      el.resultsHead.hidden = false;
      el.resultsHead.innerHTML = `<span><b>${all.length}</b> convidados</span><span class="az">A → Z</span>`;
      return;
    }
    if (!qt) { el.results.innerHTML = ""; flatResults = []; primaryResults = []; return; }

    const res = search(qt);
    const { groups, total, kind } = res;
    flatResults = groups[0].concat(groups[1], groups[2]);
    primaryResults = groups[0].length ? groups[0] : groups[2];
    if (!total) {
      el.results.innerHTML = "";
      el.noResult.hidden = false;
      el.noResultText.textContent = kind === "name"
        ? `Nenhum nome começa com “${qt}”. Confira a grafia, busque pelo telefone / e-mail ou adicione a pessoa manualmente.`
        : `Nenhum convidado com “${qt}”. Confira o número / e-mail ou adicione a pessoa manualmente.`;
      return;
    }
    const L = (res.nq.charAt(0) || "").toUpperCase();
    const typed = qt.replace(/\s+/g, " ");
    const hlLen = kind === "name" ? res.nq.length : 0;
    let html = "";
    if (groups[0].length) {
      if (groups[1].length) html += `<li class="res-group">Começam com “${esc(typed)}” · ${groups[0].length}</li>`;
      html += groups[0].map(g => resultItem(g, hlLen)).join("");
    }
    if (groups[1].length) {
      html += `<li class="res-group">Outros nomes com “${esc(L)}” · ${groups[1].length}</li>`;
      html += groups[1].map(g => resultItem(g, 1)).join("");
    }
    if (groups[2].length) {
      html += `<li class="res-group">Nenhum nome começa com “${esc(typed)}” — encontrados no sobrenome</li>`;
      html += groups[2].map(g => resultItem(g, 0)).join("");
    }
    el.results.innerHTML = html;
    el.resultsHead.hidden = false;
    let head;
    if (kind === "phone") head = `<b>${total}</b> ${total === 1 ? "convidado" : "convidados"} com o número “${esc(typed)}”`;
    else if (kind === "email") head = `<b>${total}</b> ${total === 1 ? "convidado" : "convidados"} com o e-mail “${esc(typed)}”`;
    else if (res.nq.length === 1) head = `<b>${total}</b> ${total === 1 ? "nome começa" : "nomes começam"} com “${esc(L)}”`;
    else head = `<b>${groups[0].length}</b> ${groups[0].length === 1 ? "começa" : "começam"} com “${esc(typed)}”${groups[1].length ? ` · <b>${groups[0].length + groups[1].length}</b> com “${esc(L)}”` : ""}`;
    el.resultsHead.innerHTML = `<span>${head}</span><span class="az">A → Z</span>`;
  }
  el.searchInput.addEventListener("input", renderResults);
  el.searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nq = norm(el.searchInput.value);
      const exact = flatResults.find(g => g._n === nq);
      if (exact) openGuest(exact);
      else if (primaryResults.length === 1) openGuest(primaryResults[0]);
      else if (flatResults.length === 1) openGuest(flatResults[0]);
      else if (flatResults.length) { const first = $(".result", el.results); first && first.focus(); }
    }
    if (e.key === "Escape") { el.searchInput.value = ""; renderResults(); }
  });
  el.searchClear.addEventListener("click", () => { el.searchInput.value = ""; browseAll = false; renderResults(); el.searchInput.focus(); });
  el.results.addEventListener("click", e => {
    const b = e.target.closest(".result");
    if (!b) return;
    const g = byId(b.dataset.id);
    if (g) openGuest(g);
  });

  // ---------- sheet ----------
  let current = null;
  function openSheet(html) {
    el.sheetBody.innerHTML = html;
    el.sheet.hidden = false;
    document.body.style.overflow = "hidden";
    $(".sheet__card", el.sheet).scrollTop = 0;
    const auto = $("[data-autofocus]", el.sheetBody) || $(".btn", el.sheetBody);
    if (auto) setTimeout(() => auto.focus(), 60);
  }
  function closeSheet(resetSearch) {
    el.sheet.hidden = true;
    document.body.style.overflow = "";
    current = null;
    if (resetSearch) { el.searchInput.value = ""; browseAll = false; }
    renderCheckinState();
    renderResults();
    if (!el.views.confirmados.hidden) renderConfirmados();
    if (!el.views.checkin.hidden) setTimeout(() => el.searchInput.focus(), 60);
  }
  $$("[data-close-sheet]").forEach(b => b.addEventListener("click", () => closeSheet(false)));
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!el.modal.hidden) closeModal();
    else if (!el.sheet.hidden) closeSheet(false);
  });

  function guestHeader(g, eyebrow) {
    const badges = [];
    if (g.premium) badges.push(`<span class="badge badge--premium">Premium</span>`);
    badges.push(g.paid ? `<span class="badge badge--ok">Compra confirmada</span>` : `<span class="badge badge--no">Sem compra</span>`);
    if (g.source === "manual") badges.push(`<span class="badge badge--manual">Adicionado manualmente</span>`);
    return `<div class="guest-head">
      <span class="eyebrow">${esc(eyebrow)}</span>
      <h2 class="guest-name" id="sheetTitle">${esc(g.name)}</h2>
      <div class="guest-badges">${badges.join("")}</div>
    </div>`;
  }
  function guestData(g) {
    const rows = [];
    if (g.phone) rows.push(["Telefone", fmtPhone(g.phone)]);
    if (g.email) rows.push(["E-mail", g.email]);
    rows.push(["Ingresso", g.premium ? "Premium" : "Geral"]);
    rows.push(["Origem", g.source === "manual" ? "Cadastro manual" : g.manualMerged ? "Planilha + cadastro manual" : "Planilha"]);
    return `<dl class="guest-data">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
  }
  function companionsBlock(ci) {
    const list = (ci && ci.companions) || [];
    if (!list.length) return "";
    return `<div class="companions">
      <span class="eyebrow companions__title">Acompanhantes (${list.length})</span>
      ${list.map((c, i) => `<div class="companion"><span class="companion__idx">${i + 1}</span><div><div class="companion__name">${esc(c.name)}</div>${c.phone ? `<div class="companion__phone">${esc(fmtPhone(c.phone))}</div>` : ""}</div></div>`).join("")}
    </div>`;
  }

  function openGuest(g) {
    current = g;
    const ci = checkins[g.id];
    if (ci) {
      vibrate([60, 40, 60]);
      openSheet(`${guestHeader(g, "Convidado")}
        <div class="verdict verdict--in">
          <div class="verdict__icon">${ICON.alert}</div>
          <p class="verdict__title">Já confirmado</p>
          <p class="verdict__text">Entrada registrada às <b>${fmtTime(ci.at)}</b>${ci.companions && ci.companions.length ? ` com ${plural(ci.companions.length, "acompanhante", "acompanhantes")}` : ""}.</p>
        </div>
        ${companionsBlock(ci)}
        <div class="stack">
          <button class="btn btn--ghost btn--block" type="button" data-act="add-companion">+ Adicionar acompanhante</button>
          <button class="btn btn--gold btn--block" type="button" data-act="done" data-autofocus>Próximo convidado</button>
        </div>`);
      return;
    }
    if (!g.paid) {
      vibrate([120, 60, 120]);
      openSheet(`${guestHeader(g, "Convidado")}
        <div class="verdict verdict--no">
          <div class="verdict__icon">${ICON.x}</div>
          <p class="verdict__title">Acesso não liberado</p>
          <p class="verdict__text">O nome está na lista, mas a compra do ingresso não foi identificada. Encaminhe para a organização.</p>
        </div>
        ${guestData(g)}
        <button class="btn btn--ghost btn--block" type="button" data-act="done" data-autofocus>Voltar à busca</button>`);
      return;
    }
    openSheet(`${guestHeader(g, "Convidado encontrado")}
      ${guestData(g)}
      <button class="btn btn--gold btn--block btn--xl" type="button" data-act="grant" data-autofocus>${ICON.check} Liberar entrada</button>`);
  }

  function grant() {
    const g = current;
    if (!g || checkins[g.id]) return;
    checkins[g.id] = { at: Date.now(), companions: [], snapshot: snapshotOf(g) };
    persistCheckins();
    vibrate(80);
    renderCheckinState();
    askCompanion(true);
  }

  function askCompanion(first) {
    const g = current;
    const ci = checkins[g.id];
    const n = ci.companions.length;
    const head = first
      ? `<div class="verdict verdict--granted ${g.premium ? "is-premium" : ""}">
          <div class="verdict__icon">${ICON.check}</div>
          <p class="verdict__title gold-text">Acesso liberado</p>
          <p class="verdict__text">${esc(g.name)}</p>
          ${g.premium ? `<span class="premium-ribbon">PREMIUM</span>` : ""}
        </div>`
      : `<div class="verdict verdict--ok">
          <div class="verdict__icon">${ICON.check}</div>
          <p class="verdict__title">Acompanhante registrado</p>
          <p class="verdict__text">${esc(ci.companions[n - 1].name)} entra com ${esc(g.name.split(" ")[0])}.</p>
        </div>`;
    openSheet(`${head}
      ${first ? "" : companionsBlock(ci)}
      <div class="question">
        <p class="question__title">${first ? "Trouxe mais alguém?" : "Mais algum acompanhante?"}</p>
        <p>${first ? "O convidado está acompanhado de outra pessoa?" : `Até agora: ${plural(n, "acompanhante", "acompanhantes")}.`}</p>
      </div>
      <div class="yesno">
        <button class="btn btn--ghost btn--xl" type="button" data-act="no">Não</button>
        <button class="btn btn--gold btn--xl" type="button" data-act="yes">Sim</button>
      </div>`);
    setTimeout(() => { const b = $('[data-act="no"]', el.sheetBody); b && b.focus(); }, 70);
  }

  function phoneMask(input) {
    input.addEventListener("input", () => {
      const d = digits(input.value).slice(0, 11);
      let v = d;
      if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length === 11 ? 7 : 6)}-${d.slice(d.length === 11 ? 7 : 6)}`;
      input.value = v;
    });
  }
  function clearErrors(form) { $$(".field", form).forEach(f => { f.classList.remove("has-error"); const er = $(".field__err", f); er && er.remove(); }); }
  function setErr(input, msg) {
    const f = input.closest(".field");
    f.classList.add("has-error");
    f.insertAdjacentHTML("beforeend", `<div class="field__err">${esc(msg)}</div>`);
    input.focus();
  }

  function companionForm(fromAlready) {
    const g = current;
    openSheet(`<div class="guest-head">
        <span class="eyebrow">Acompanhante de</span>
        <h2 class="guest-name" id="sheetTitle">${esc(g.name)}</h2>
      </div>
      <form class="form" id="compForm" novalidate>
        <div class="field">
          <label for="compName">Nome completo do acompanhante</label>
          <input id="compName" name="name" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" data-autofocus>
        </div>
        <div class="field">
          <label for="compPhone">Número de telefone</label>
          <input id="compPhone" name="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="(82) 99999-9999" enterkeyhint="done">
        </div>
      </form>
      <div class="yesno">
        <button class="btn btn--ghost" type="button" data-act="${fromAlready ? "back-already" : "back-ask"}">Voltar</button>
        <button class="btn btn--gold" type="submit" form="compForm">Salvar</button>
      </div>`);
    const form = $("#compForm");
    const phone = $("#compPhone");
    phoneMask(phone);
    $("#compName").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); phone.focus(); } });
    form.addEventListener("submit", e => {
      e.preventDefault();
      const nameEl = $("#compName");
      const name = titleCase(nameEl.value);
      const ph = digits(phone.value);
      clearErrors(form);
      let ok = true;
      if (name.length < 2) { setErr(nameEl, "Informe o nome do acompanhante."); ok = false; }
      if (ph.length < 10) { setErr(phone, "Informe o telefone com DDD."); ok = false; }
      if (!ok) { vibrate(60); return; }
      checkins[g.id].companions.push({ name, phone: ph, at: Date.now() });
      persistCheckins();
      vibrate(50);
      if (fromAlready) { toast(`${name} registrado(a) como acompanhante.`); openGuest(g); }
      else askCompanion(false);
    });
  }

  // =========================================================
  //  CADASTRO MANUAL
  // =========================================================
  function manualForm(prefillName, prefillPhone) {
    current = null;
    const state = { paid: true, premium: false, ignoreDup: false };
    openSheet(`<div class="guest-head">
        <span class="eyebrow">Cadastro manual</span>
        <h2 class="guest-name" id="sheetTitle">Adicionar convidado</h2>
      </div>
      <form class="form" id="manForm" novalidate>
        <div class="field">
          <label for="manName">Nome completo</label>
          <input id="manName" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" value="${esc(prefillName || "")}" data-autofocus>
        </div>
        <div class="field">
          <label for="manPhone">Número de telefone</label>
          <input id="manPhone" type="tel" inputmode="tel" autocomplete="off" placeholder="(82) 99999-9999" enterkeyhint="next" value="${esc(prefillPhone || "")}">
        </div>
        <div class="field">
          <label for="manEmail">E-mail <span class="opt">(opcional)</span></label>
          <input id="manEmail" type="email" inputmode="email" autocomplete="off" autocapitalize="off" enterkeyhint="done">
        </div>
        <div class="form__row">
          <div class="field">
            <label>Comprou?</label>
            <div class="seg" data-seg="paid"><button type="button" data-v="1" class="is-on">Sim</button><button type="button" data-v="0">Não</button></div>
          </div>
          <div class="field">
            <label>Premium?</label>
            <div class="seg" data-seg="premium"><button type="button" data-v="1">Sim</button><button type="button" data-v="0" class="is-on is-no">Não</button></div>
          </div>
        </div>
        <div id="dupBox"></div>
      </form>
      <div class="yesno">
        <button class="btn btn--ghost" type="button" data-act="done">Cancelar</button>
        <button class="btn btn--gold" type="submit" form="manForm">Salvar</button>
      </div>`);
    const form = $("#manForm");
    const nameEl = $("#manName"), phoneEl = $("#manPhone"), emailEl = $("#manEmail");
    phoneMask(phoneEl);
    if (prefillPhone) phoneEl.dispatchEvent(new Event("input"));
    $$(".seg", form).forEach(seg => seg.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      const on = b.dataset.v === "1";
      state[seg.dataset.seg] = on;
      $$("button", seg).forEach(x => { const sel = x === b; x.classList.toggle("is-on", sel); x.classList.toggle("is-no", sel && !on); });
    }));
    [nameEl, phoneEl, emailEl].forEach(i => i.addEventListener("input", () => { state.ignoreDup = false; $("#dupBox").innerHTML = ""; }));
    nameEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); phoneEl.focus(); } });
    phoneEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); emailEl.focus(); } });

    form.addEventListener("submit", e => {
      e.preventDefault();
      clearErrors(form);
      const cand = {
        name: titleCase(nameEl.value),
        phone: digits(phoneEl.value),
        email: emailEl.value.trim().toLowerCase(),
        paid: state.paid, premium: state.premium
      };
      let ok = true;
      if (cand.name.length < 2) { setErr(nameEl, "Informe o nome do convidado."); ok = false; }
      if (cand.phone && cand.phone.length < 10) { setErr(phoneEl, "Telefone incompleto — informe com DDD."); ok = false; }
      if (!cand.phone) { setErr(phoneEl, "Informe o telefone com DDD."); ok = false; }
      if (cand.email && !/^\S+@\S+\.\S+$/.test(cand.email)) { setErr(emailEl, "E-mail inválido."); ok = false; }
      if (!ok) { vibrate(60); return; }

      if (!state.ignoreDup) {
        const m = findMatch(cand, buildIndex(guests));
        if (m) {
          const d = m.g;
          $("#dupBox").innerHTML = `<div class="dup">
            <b>Essa pessoa já parece estar na lista</b> (mesmo ${esc(m.by)}):<br>
            ${esc(d.name)}${d.phone ? " · " + esc(fmtPhone(d.phone)) : ""}${d.email ? " · " + esc(d.email) : ""}
            <div class="dup__actions">
              <button class="btn btn--gold btn--sm" type="button" data-open-dup="${esc(d.id)}">Abrir cadastro existente</button>
              <button class="btn btn--ghost btn--sm" type="button" data-force>Adicionar mesmo assim</button>
            </div></div>`;
          $("[data-open-dup]").addEventListener("click", ev => { const g = byId(ev.currentTarget.dataset.openDup); g && openGuest(g); });
          $("[data-force]").addEventListener("click", () => { state.ignoreDup = true; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true })); });
          vibrate(60);
          return;
        }
      }
      const taken = new Set(guests.map(g => g.id));
      const g = prep(Object.assign(cand, { id: newId("m:", taken), source: "manual", addedAt: Date.now() }));
      guests.push(g);
      persist();
      toast(`${g.name} adicionado(a) à lista.`);
      renderCheckinState();
      if (!el.views.confirmados.hidden) renderConfirmados();
      openGuest(g); // segue direto para liberar a entrada
    });
  }

  function finishGuest() {
    const g = current;
    const ci = g && checkins[g.id];
    const n = ci ? ci.companions.length : 0;
    closeSheet(true);
    if (g && ci) toast(`Entrada confirmada: ${g.name.split(" ")[0]}${n ? ` +${n}` : ""}`);
  }

  el.sheetBody.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "grant") grant();
    else if (act === "yes") companionForm(false);
    else if (act === "no") finishGuest();
    else if (act === "back-ask") askCompanion(checkins[current.id].companions.length === 0);
    else if (act === "add-companion") companionForm(true);
    else if (act === "back-already") openGuest(current);
    else if (act === "done") closeSheet(true);
  });

  // ---------- confirmados view ----------
  let confFilter = "all";
  function renderStats() {
    const c = counts();
    const pct = c.paid ? Math.round((c.guestsIn / c.paid) * 100) : 0;
    el.stats.innerHTML = `
      <div class="stat stat--hero"><div class="stat__label">Pessoas no evento</div><div class="stat__value">${c.total}</div><div class="stat__hint">${c.guestsIn} convidados + ${c.comps} acompanhantes</div></div>
      <div class="stat"><div class="stat__label">Convidados confirmados</div><div class="stat__value">${c.guestsIn}</div><div class="stat__hint">${pct}% dos pagantes</div></div>
      <div class="stat"><div class="stat__label">Premium presentes</div><div class="stat__value gold-text">${c.premiumIn}</div><div class="stat__hint">de ${guests.filter(g => g.premium && g.paid).length} premium pagos</div></div>
      <div class="stat"><div class="stat__label">Pagantes a chegar</div><div class="stat__value">${c.pending}</div><div class="stat__hint">${c.paid} pagos na lista</div></div>`;
  }
  function confirmedList() {
    return Object.entries(checkins).map(([id, ci]) => {
      const g = byId(id);
      const s = ci.snapshot || {};
      return {
        id, ci,
        name: (g && g.name) || s.name || "—",
        phone: (g && g.phone) || s.phone || "",
        email: (g && g.email) || s.email || "",
        premium: g ? !!g.premium : !!s.premium,
        source: g ? g.source : (s.source || "planilha"),
        merged: !!(g && g.manualMerged),
        inList: !!g
      };
    }).sort((a, b) => b.ci.at - a.ci.at);
  }
  function renderConfirmados() {
    renderStats();
    renderBaseInfo();
    renderManualBox();
    el.tabCount.textContent = Object.keys(checkins).length;
    const q = norm(el.confSearch.value);
    const qd = digits(el.confSearch.value);
    let list = confirmedList();
    if (confFilter === "premium") list = list.filter(x => x.premium);
    if (confFilter === "companions") list = list.filter(x => x.ci.companions && x.ci.companions.length);
    if (q) list = list.filter(x => {
      const hay = norm([x.name, x.email, ...(x.ci.companions || []).map(c => c.name)].join(" "));
      const hd = [x.phone, ...(x.ci.companions || []).map(c => c.phone)].map(digits).join(" ");
      return q.split(" ").every(t => hay.includes(t)) || (qd.length >= 4 && hd.includes(qd));
    });
    el.confEmpty.hidden = list.length > 0;
    el.confEmpty.textContent = Object.keys(checkins).length ? "Nenhum resultado para esse filtro." : "Nenhuma entrada confirmada ainda.";
    el.confList.innerHTML = list.map(x => {
      const comps = x.ci.companions || [];
      const sub = [fmtPhone(x.phone), x.email].filter(Boolean).join(" · ");
      return `<li class="conf">
        <div class="conf__row">
          <span class="conf__time">${fmtTime(x.ci.at)}</span>
          <div class="conf__main">
            <div class="conf__name">${esc(x.name)} ${x.premium ? `<span class="badge badge--premium">Premium</span>` : ""} ${x.source === "manual" ? `<span class="badge badge--manual">Manual</span>` : ""} ${comps.length ? `<span class="badge">+${comps.length}</span>` : ""} ${x.inList ? "" : `<span class="badge badge--in" title="Não está na lista atual">Fora da lista atual</span>`}</div>
            ${sub ? `<div class="conf__sub">${esc(sub)}</div>` : ""}
          </div>
          <div class="conf__btns">
            <button class="conf__add" type="button" data-add="${esc(x.id)}">+ Acomp.</button>
            <button class="conf__undo" type="button" data-undo="${esc(x.id)}">Desfazer</button>
          </div>
        </div>
        ${comps.length ? `<ul class="conf__comps">${comps.map((c, i) => `<li>${esc(c.name)} ${c.phone ? `<span>${esc(fmtPhone(c.phone))}</span>` : ""}<button class="btn--text" type="button" data-rmcomp="${esc(x.id)}" data-i="${i}" style="background:none;border:0;padding:0 4px;font-size:11px;cursor:pointer" aria-label="Remover acompanhante">remover</button></li>`).join("")}</ul>` : ""}
      </li>`;
    }).join("");
  }
  el.confSearch.addEventListener("input", renderConfirmados);
  $$(".chip").forEach(c => c.addEventListener("click", () => {
    confFilter = c.dataset.filter;
    $$(".chip").forEach(x => x.classList.toggle("is-active", x === c));
    renderConfirmados();
  }));
  el.confList.addEventListener("click", e => {
    const undo = e.target.closest("[data-undo]");
    const add = e.target.closest("[data-add]");
    const rm = e.target.closest("[data-rmcomp]");
    if (undo) {
      const id = undo.dataset.undo;
      const ci = checkins[id];
      const name = (ci.snapshot && ci.snapshot.name) || "convidado";
      confirmModal("Desfazer entrada?", `A confirmação de ${name}${ci.companions.length ? ` e ${plural(ci.companions.length, "acompanhante", "acompanhantes")}` : ""} será removida.`, "Desfazer", () => {
        delete checkins[id]; persistCheckins(); renderConfirmados(); renderCheckinState(); toast("Entrada desfeita.");
      });
    } else if (add) {
      const id = add.dataset.add;
      current = byId(id) || Object.assign({ id }, checkins[id].snapshot);
      companionForm(true);
    } else if (rm) {
      const id = rm.dataset.rmcomp, i = +rm.dataset.i;
      const c = checkins[id].companions[i];
      confirmModal("Remover acompanhante?", `${c.name} será removido(a) da lista.`, "Remover", () => {
        checkins[id].companions.splice(i, 1); persistCheckins(); renderConfirmados(); renderCheckinState();
      });
    }
  });

  // ---------- base info + manual list ----------
  function renderBaseInfo() {
    if (!guests.length) {
      el.baseInfo.innerHTML = `<span>Nenhuma planilha carregada neste aparelho.</span>`;
      return;
    }
    const paid = guests.filter(g => g.paid).length;
    const prem = guests.filter(g => g.premium).length;
    const manual = guests.filter(g => g.source === "manual").length;
    const files = (meta.files || []);
    const last = files[files.length - 1];
    el.baseInfo.innerHTML = `
      <span>${files.length > 1 ? "Planilhas" : "Planilha"}: <b>${files.length ? files.map(f => esc(f.name)).join(" + ") : "—"}</b></span>
      <span><b>${guests.length}</b> na lista</span>
      <span><b>${paid}</b> compraram</span>
      <span><b>${prem}</b> premium</span>
      <span><b>${manual}</b> manuais</span>
      ${last && last.importedAt ? `<span>Última importação <b>${fmtDateTime(last.importedAt)}</b></span>` : ""}`;
  }
  function renderManualBox() {
    const list = guests.filter(g => g.source === "manual").sort(byName);
    if (!list.length) { el.manualBox.innerHTML = ""; return; }
    el.manualBox.innerHTML = `
      <div class="manual-box__head"><span class="eyebrow">Adicionados manualmente (${list.length})</span></div>
      <ul class="manual-list">${list.map(g => {
        const ci = checkins[g.id];
        return `<li class="manual-item">
          <div class="manual-item__main">
            <div class="manual-item__name">${esc(g.name)} ${g.premium ? `<span class="badge badge--premium">Premium</span>` : ""} ${g.paid ? `<span class="badge badge--ok">Pago</span>` : `<span class="badge badge--no">Não pago</span>`} ${ci ? `<span class="badge badge--in">Entrou ${fmtTime(ci.at)}</span>` : ""}</div>
            <div class="manual-item__sub">${esc([fmtPhone(g.phone), g.email].filter(Boolean).join(" · "))}${g.addedAt ? ` · adicionado ${fmtTime(g.addedAt)}` : ""}</div>
          </div>
          ${ci ? "" : `<button class="conf__undo" type="button" data-rmguest="${esc(g.id)}">Remover</button>`}
        </li>`;
      }).join("")}</ul>`;
  }
  el.manualBox.addEventListener("click", e => {
    const b = e.target.closest("[data-rmguest]");
    if (!b) return;
    const g = byId(b.dataset.rmguest);
    if (!g) return;
    confirmModal("Remover convidado?", `${g.name} será removido(a) da lista de convidados.`, "Remover", () => {
      guests = guests.filter(x => x.id !== g.id); persist(); renderConfirmados(); renderCheckinState(); toast("Convidado removido.");
    });
  });

  // ---------- export ----------
  function origin(src, merged) { return src === "manual" ? "Manual" : merged ? "Planilha + manual" : "Planilha"; }
  function exportRows() {
    const rows = [];
    confirmedList().slice().sort((a, b) => a.ci.at - b.ci.at).forEach(x => {
      rows.push({ "Tipo": "Convidado", "Nome": x.name, "Telefone": fmtPhone(x.phone), "E-mail": x.email, "Premium": x.premium ? "Sim" : "Não", "Origem": origin(x.source, x.merged), "Acompanhante de": "", "Horário": fmtDateTime(x.ci.at) });
      (x.ci.companions || []).forEach(c => rows.push({ "Tipo": "Acompanhante", "Nome": c.name, "Telefone": fmtPhone(c.phone), "E-mail": "", "Premium": "", "Origem": "Acompanhante", "Acompanhante de": x.name, "Horário": fmtDateTime(c.at || x.ci.at) }));
    });
    return rows;
  }
  function stamp() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`; }
  $("#exportXlsx").addEventListener("click", () => {
    if (!window.XLSX) return toast("Biblioteca de planilhas ainda carregando…", "warn");
    const rows = exportRows();
    if (!rows.length && !guests.length) return toast("Nada para exportar ainda.", "warn");
    const wb = XLSX.utils.book_new();
    if (rows.length) {
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 14 }, { wch: 34 }, { wch: 17 }, { wch: 30 }, { wch: 9 }, { wch: 13 }, { wch: 30 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, "Presentes");
    }
    const pend = guests.filter(g => g.paid && !checkins[g.id]).sort(byName).map(g => ({ "Nome": g.name, "Telefone": fmtPhone(g.phone), "E-mail": g.email, "Premium": g.premium ? "Sim" : "Não", "Origem": origin(g.source, g.manualMerged) }));
    if (pend.length) { const ws2 = XLSX.utils.json_to_sheet(pend); ws2["!cols"] = [{ wch: 34 }, { wch: 17 }, { wch: 30 }, { wch: 9 }, { wch: 10 }]; XLSX.utils.book_append_sheet(wb, ws2, "Pagantes ausentes"); }
    // base completa no mesmo formato da planilha de importação (pode ser reenviada)
    const base = guests.slice().sort(byName).map(g => ({ "Nome": g.name, "Número": fmtPhone(g.phone), "E-mail": g.email, "Comprou": g.paid ? "Sim" : "Não", "Premium": g.premium ? "Sim" : "Não", "Origem": origin(g.source, g.manualMerged), "Entrada": checkins[g.id] ? fmtDateTime(checkins[g.id].at) : "" }));
    if (base.length) { const ws3 = XLSX.utils.json_to_sheet(base); ws3["!cols"] = [{ wch: 34 }, { wch: 17 }, { wch: 30 }, { wch: 9 }, { wch: 9 }, { wch: 10 }, { wch: 14 }]; XLSX.utils.book_append_sheet(wb, ws3, "Base completa"); }
    XLSX.writeFile(wb, `papo-de-business_check-in_${stamp()}.xlsx`);
  });
  $("#exportCsv").addEventListener("click", () => {
    const rows = exportRows();
    if (!rows.length) return toast("Nenhuma entrada para exportar.", "warn");
    const head = Object.keys(rows[0]);
    const q = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const csv = "﻿" + [head.map(q).join(";"), ...rows.map(r => head.map(h => q(r[h])).join(";"))].join("\r\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `papo-de-business_presentes_${stamp()}.csv`);
  });
  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $("#downloadTemplate").addEventListener("click", () => {
    if (!window.XLSX) return toast("Biblioteca de planilhas ainda carregando…", "warn");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nome", "Número", "E-mail", "Comprou", "Premium"],
      ["Maria Silva Santos", "(82) 99999-1111", "maria@email.com", "Sim", "Não"],
      ["João Pereira", "(82) 98888-2222", "joao@email.com", "Sim", "Sim"],
      ["Ana Souza", "(82) 97777-3333", "ana@email.com", "Não", "Não"]
    ]);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Convidados");
    XLSX.writeFile(wb, "modelo-lista-convidados.xlsx");
  });

  // =========================================================
  //  UPLOAD + PRÉVIA DO CRUZAMENTO
  // =========================================================
  let pending = null;   // { parsed, mode, plan }
  function handleFile(file) {
    if (!file) return;
    if (!window.XLSX) { toast("Biblioteca de planilhas ainda carregando, tente novamente.", "warn"); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array", cellDates: false, raw: false, codepage: 65001 });
        let parsed = null;
        for (const sn of wb.SheetNames) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "", raw: false, blankrows: false });
          const p = parseRows(rows, file.name);
          if (!p.error) { p.sheet = sn; parsed = p; break; }
          if (!parsed) parsed = p;
        }
        if (parsed.error) return showError(parsed.error, file.name);
        pending = { parsed, mode: "replace" };
        renderPreview();
      } catch (err) {
        console.error(err);
        showError("Não consegui ler esse arquivo. Envie em .xlsx, .xls ou .csv.", file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  }
  function showError(msg, fileName) {
    pending = null;
    el.preview.hidden = false;
    el.preview.innerHTML = `<p class="preview__title">${esc(fileName)}</p><div class="warnbox" style="color:var(--danger);border-color:var(--danger-line);background:var(--danger-bg)">${esc(msg)}</div>
      <div class="preview__actions"><button class="btn btn--ghost" type="button" data-prev="cancel">Fechar</button></div>`;
  }
  function renderPreview() {
    const p = pending.parsed;
    const plan = pending.plan = planImport(p.rows, pending.mode);
    const st = plan.st;
    const hasBase = guests.length > 0;
    const labels = { name: "Nome", phone: "Número", email: "E-mail", paid: "Comprou", premium: "Premium" };
    const paid = p.rows.filter(g => g.paid).length;
    const prem = p.rows.filter(g => g.premium).length;
    const warns = [];
    if (p.map.paid == null) warns.push("Coluna <b>Comprou</b> não encontrada — ninguém desta planilha terá o acesso liberado. Confira o título da coluna.");
    if (p.map.premium == null) warns.push("Coluna <b>Premium</b> não encontrada — todos serão tratados como ingresso geral.");
    if (p.skipped) warns.push(`${p.skipped} linha(s) sem nome foram ignoradas.`);
    if (plan.orphan > 0) warns.push(`${plan.orphan} entrada(s) já confirmada(s) não aparecem na lista resultante — continuam na lista de confirmados, marcadas como “fora da lista atual”.`);
    const row = (label, val, cls) => `<div class="${cls || ""}"><span>${label}</span><b>${val}</b></div>`;
    const sample = p.rows.slice(0, 5);

    el.preview.hidden = false;
    el.preview.innerHTML = `
      <p class="preview__title">${esc(p.fileName)}${p.sheet ? ` <span class="muted" style="font-weight:500">· aba “${esc(p.sheet)}”</span>` : ""}</p>
      <div class="preview__grid">
        <div><b>${p.rows.length}</b><span>linhas</span></div>
        <div><b>${paid}</b><span>compraram</span></div>
        <div><b class="gold-text">${prem}</b><span>premium</span></div>
      </div>
      <div class="mapping">${Object.keys(labels).map(k => `<div><span>${labels[k]}</span>${p.map[k] != null ? `<span class="ok">✓ ${esc(p.headers[p.map[k]])}</span>` : `<span class="miss">não encontrada</span>`}</div>`).join("")}</div>

      ${hasBase ? `
      <span class="eyebrow cross-title">Como carregar</span>
      <div class="modes" role="radiogroup">
        <button type="button" class="mode ${pending.mode === "replace" ? "is-on" : ""}" data-mode="replace" role="radio" aria-checked="${pending.mode === "replace"}">
          <span class="mode__dot"></span>
          <span><b>Atualizar lista</b><span>Esta planilha substitui a anterior. Cadastros manuais e entradas confirmadas continuam.</span></span>
        </button>
        <button type="button" class="mode ${pending.mode === "merge" ? "is-on" : ""}" data-mode="merge" role="radio" aria-checked="${pending.mode === "merge"}">
          <span class="mode__dot"></span>
          <span><b>Somar à lista atual</b><span>Junta com quem já está no app (ex.: outra lista de vendas), sem duplicar ninguém.</span></span>
        </button>
      </div>` : ""}

      <span class="eyebrow cross-title">Cruzamento de dados</span>
      <div class="cross">
        ${row("Novos convidados", st.novos, "is-gold")}
        ${hasBase ? row("Já estavam na lista (dados atualizados)", st.atualizados) : ""}
        ${hasBase ? row("Cadastros manuais encontrados na planilha (unificados)", st.manuaisUnificados, st.manuaisUnificados ? "is-gold" : "") : ""}
        ${hasBase ? row("Cadastros manuais mantidos", st.manuaisMantidos) : ""}
        ${st.duplicadosPlanilha ? row("Linhas repetidas na planilha (unidas)", st.duplicadosPlanilha, "is-warn") : ""}
        ${hasBase && pending.mode === "replace" ? row("Saem da lista (não estão na nova planilha)", st.removidos, st.removidos ? "is-warn" : "") : ""}
        ${Object.keys(checkins).length ? row("Entradas confirmadas mantidas", plan.kept + plan.relinked) : ""}
        ${row("Total na lista após importar", plan.result.length, "is-gold")}
      </div>
      ${warns.map(w => `<div class="warnbox">${w}</div>`).join("")}
      <div class="sample-wrap"><table class="sample"><thead><tr><th>Nome</th><th>Número</th><th>Comprou</th><th>Premium</th></tr></thead>
        <tbody>${sample.map(g => `<tr><td>${esc(g.name)}</td><td>${esc(fmtPhone(g.phone))}</td><td>${g.paid ? "Sim" : "Não"}</td><td>${g.premium ? "Sim" : "Não"}</td></tr>`).join("")}</tbody></table></div>
      <div class="preview__actions">
        <button class="btn btn--ghost" type="button" data-prev="cancel">Cancelar</button>
        <button class="btn btn--gold" type="button" data-prev="import">${!hasBase ? "Importar lista" : pending.mode === "replace" ? "Atualizar lista" : "Somar à lista"}</button>
      </div>`;
    el.preview.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  el.preview.addEventListener("click", e => {
    const m = e.target.closest("[data-mode]");
    if (m && pending) { pending.mode = m.dataset.mode; renderPreview(); return; }
    const b = e.target.closest("[data-prev]");
    if (!b) return;
    if (b.dataset.prev === "import" && pending) {
      const plan = planImport(pending.parsed.rows, pending.mode); // recalcula com o estado mais recente
      applyImport(plan, pending.parsed.fileName);
      const st = plan.st;
      toast(`Lista pronta: ${guests.length} convidados (${st.novos} novos${st.manuaisUnificados ? `, ${st.manuaisUnificados} manuais unificados` : ""}).`);
    }
    pending = null;
    el.preview.hidden = true;
    el.preview.innerHTML = "";
    el.fileInput.value = "";
    renderConfirmados();
    renderCheckinState();
    renderResults();
  });
  el.fileInput.addEventListener("change", () => handleFile(el.fileInput.files[0]));
  ["dragenter", "dragover"].forEach(ev => el.dropzone.addEventListener(ev, e => { e.preventDefault(); el.dropzone.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach(ev => el.dropzone.addEventListener(ev, e => { e.preventDefault(); el.dropzone.classList.remove("is-over"); }));
  el.dropzone.addEventListener("drop", e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });

  $("#resetCheckins").addEventListener("click", () => {
    const n = Object.keys(checkins).length;
    if (!n) return toast("Não há confirmações para zerar.", "warn");
    confirmModal("Zerar confirmações?", `${plural(n, "entrada confirmada será apagada", "entradas confirmadas serão apagadas")} deste aparelho. Exporte a lista antes, se precisar.`, "Zerar", () => {
      checkins = {}; persistCheckins(); renderConfirmados(); renderCheckinState(); toast("Confirmações zeradas.");
    });
  });
  $("#resetAll").addEventListener("click", () => {
    confirmModal("Apagar tudo?", "A lista de convidados (inclusive os cadastros manuais) e todas as confirmações serão apagadas deste aparelho.", "Apagar tudo", () => {
      guests = []; checkins = {}; meta = { files: [] };
      Object.values(KEYS).forEach(k => store.del(k));
      renderConfirmados(); renderCheckinState(); renderResults(); toast("Dados apagados.");
    });
  });

  // ---------- modal & toast ----------
  let modalCb = null;
  function confirmModal(title, text, okLabel, cb) {
    $("#modalTitle").textContent = title;
    $("#modalText").textContent = text;
    $("#modalOk").textContent = okLabel || "Confirmar";
    modalCb = cb;
    el.modal.hidden = false;
    setTimeout(() => $("#modalOk").focus(), 50);
  }
  function closeModal() { el.modal.hidden = true; modalCb = null; }
  $$("[data-close-modal]").forEach(b => b.addEventListener("click", closeModal));
  $("#modalOk").addEventListener("click", () => { const cb = modalCb; closeModal(); cb && cb(); });

  let toastT = null;
  function toast(msg, kind) {
    el.toast.innerHTML = (kind === "warn" ? '<svg viewBox="0 0 24 24" style="color:var(--warn)"><path d="M12 7v6M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>' : ICON.check) + `<span>${esc(msg)}</span>`;
    el.toast.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.toast.hidden = true; }, 2800);
  }

  // mantém várias abas do mesmo navegador sincronizadas
  window.addEventListener("storage", e => {
    if (!Object.values(KEYS).includes(e.key)) return;
    guests = store.get(KEYS.guests, []).map(prep);
    checkins = store.get(KEYS.checkins, {});
    meta = migrateMeta(store.get(KEYS.meta, null));
    renderCheckinState(); renderResults();
    if (!el.views.confirmados.hidden) renderConfirmados();
  });

  // ---------- init ----------
  renderCheckinState();
  renderBaseInfo();
  renderResults();
  if (guests.length) setTimeout(() => el.searchInput.focus(), 100);

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
