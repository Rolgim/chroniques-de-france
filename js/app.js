(() => {
  "use strict";

  /* ============================================================
     Données dérivées
     ============================================================ */
  const P = HDF.periodes;
  const PAR_ID = Object.fromEntries(P.map((p) => [p.id, p]));
  const ROIS = HDF.souverains;
  const AN_COURANT = new Date().getFullYear();

  const EV = [];
  const PERS = [];
  P.forEach((p, pi) => {
    p.ev.forEach((e, i) => EV.push({ id: `e:${p.id}:${i}`, pid: p.id, pi, y: e[0], t: e[1], d: e[2], approx: e[3] === "a" }));
    p.pers.forEach((x, i) => PERS.push({ id: `p:${p.id}:${i}`, pid: p.id, pi, nom: x[0], dates: x[1], role: x[2], bio: x[3], ind: x[4] }));
  });

  /* ============================================================
     Utilitaires
     ============================================================ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");

  let alea = Math.random;
  const rnd = (n) => Math.floor(alea() * n);
  const melange = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const tirage = (a, n) => melange(a).slice(0, n);
  const graine = (s) => () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const riche = (s) => esc(s).replace(/\*(.+?)\*/g, "<strong>$1</strong>");
  const an = (y) => (y < 0 ? `${Math.abs(y).toLocaleString("fr-FR")} av. J.-C.` : String(y));
  const jour = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  const etoilesHtml = (n) => `<span class="etoiles" aria-label="${n} étoile${n > 1 ? "s" : ""} sur 3">${"★".repeat(n)}<i>${"★".repeat(3 - n)}</i></span>`;
  const uniques = (a, cle) => { const vu = new Set(); return a.filter((x) => !vu.has(cle(x)) && vu.add(cle(x))); };

  let minuterieToast;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("vu");
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => t.classList.remove("vu"), 2600);
  }

  /* ============================================================
     Sauvegarde
     ============================================================ */
  const CLE = "chroniques-de-france-v1";
  const VIDE = () => ({
    xp: 0, serie: 0, dernierJour: null,
    etoiles: {}, lus: {}, cartes: {},
    rec: { chrono: 0, annee: 0, qui: 0, survie: 0, rois: 0 },
    badges: {},
    stats: { parties: 0, rep: 0, ok: 0, exact: 0 },
    defi: { jour: null, score: 0, n: 0 },
    opt: { son: true, libre: false, theme: "auto" },
  });
  let S = VIDE();
  function charger() {
    try {
      const brut = JSON.parse(localStorage.getItem(CLE) || "null");
      if (brut) {
        const v = VIDE();
        S = { ...v, ...brut, rec: { ...v.rec, ...brut.rec }, stats: { ...v.stats, ...brut.stats }, defi: { ...v.defi, ...brut.defi }, opt: { ...v.opt, ...brut.opt } };
      }
    } catch (e) { /* stockage indisponible : on joue sans sauvegarde */ }
  }
  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) { /* idem */ }
  }
  function appliquerTheme() {
    const t = S.opt.theme;
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  /* ============================================================
     Progression : niveaux, série, badges
     ============================================================ */
  const RANGS = [
    ["Serf", "🌾"], ["Paysan", "🧑‍🌾"], ["Artisan", "🔨"], ["Bourgeois", "🪙"], ["Écuyer", "🐴"], ["Chevalier", "⚔️"],
    ["Baron", "🏰"], ["Vicomte", "🎩"], ["Comte", "🦁"], ["Marquis", "💎"], ["Duc", "🦅"], ["Pair de France", "📜"],
    ["Maréchal", "🎖️"], ["Dauphin", "🐬"], ["Monarque", "👑"], ["Légende", "⚜️"],
  ];
  const seuil = (n) => 50 * (n - 1) * (n + 1); // XP cumulés pour atteindre le niveau n
  function niveau(xp) {
    let n = 1;
    while (n < RANGS.length && xp >= seuil(n + 1)) n++;
    return n;
  }
  const totalEtoiles = () => Object.values(S.etoiles).reduce((a, b) => a + b, 0);
  const serieActive = () => (S.dernierJour !== null && jour() - S.dernierJour <= 1 ? S.serie : 0);
  function marquerJour() {
    const j = jour();
    if (S.dernierJour === j) return;
    S.serie = S.dernierJour === j - 1 ? S.serie + 1 : 1;
    S.dernierJour = j;
  }
  const maitrisees = () => Object.values(S.cartes).filter((c) => c.b >= 3).length;
  const ereOk = (nom) => P.filter((p) => p.ere === nom).every((p) => S.etoiles[p.id] >= 1);

  const BADGES = [
    ["premier", "🌱", "Premier pas", "Terminer une partie", () => S.stats.parties >= 1],
    ["lecteur", "📖", "Rat de bibliothèque", "Lire 5 leçons", () => Object.keys(S.lus).length >= 5],
    ["erudit", "🎓", "Érudit", "Lire toutes les leçons", () => Object.keys(S.lus).length >= P.length],
    ["parfait", "⭐", "Sans-faute", "3 étoiles à une épreuve", () => Object.values(S.etoiles).some((v) => v >= 3)],
    ["constellation", "🌟", "Constellation", "Cumuler 30 étoiles", () => totalEtoiles() >= 30],
    ["tour", "🗺️", "Tour de France", "1 étoile partout", () => P.every((p) => S.etoiles[p.id] >= 1)],
    ["immortel", "🏛️", "Immortel", "3 étoiles partout", () => P.every((p) => S.etoiles[p.id] >= 3)],
    ["antique", "🏺", "Antiquaire", "Finir Préhistoire et Antiquité", () => ereOk("Préhistoire et Antiquité")],
    ["medieval", "🏰", "Médiéviste", "Finir le Moyen Âge", () => ereOk("Moyen Âge")],
    ["moderne", "☀️", "Courtisan", "Finir les Temps modernes", () => ereOk("Temps modernes")],
    ["revolution", "🗽", "Sans-culotte", "Finir Révolution et Empire", () => ereOk("Révolution et Empire")],
    ["xix", "🚂", "Enfant du siècle", "Finir le XIXe siècle", () => ereOk("XIXe siècle")],
    ["xx", "🌍", "Contemporain", "Finir les XXe et XXIe siècles", () => ereOk("XXe et XXIe siècles")],
    ["flamme3", "🔥", "Assidu", "3 jours de suite", () => S.serie >= 3],
    ["flamme7", "☄️", "Semaine parfaite", "7 jours de suite", () => S.serie >= 7],
    ["flamme30", "🌋", "Inarrêtable", "30 jours de suite", () => S.serie >= 30],
    ["cent", "💯", "Centurion", "100 bonnes réponses", () => S.stats.ok >= 100],
    ["mille", "🧠", "Mémoire d'éléphant", "1 000 bonnes réponses", () => S.stats.ok >= 1000],
    ["chrono", "⏳", "Maître du temps", "10 cartes en Chronologie", () => S.rec.chrono >= 10],
    ["sniper", "🎯", "Dans le mille", "Trouver une année exacte", () => S.stats.exact >= 1],
    ["limier", "🕵️", "Fin limier", "15/15 à Qui suis-je ?", () => S.rec.qui >= 15],
    ["survivant", "⚡", "Survivant", "25 points en Survie", () => S.rec.survie >= 25],
    ["couronne", "👑", "Généalogiste", "10/10 aux Successions", () => S.rec.rois >= 10],
    ["cartes", "🃏", "Bonne mémoire", "Maîtriser 50 cartes", () => maitrisees() >= 50],
    ["defi", "📅", "Au rendez-vous", "Relever un défi du jour", () => S.defi.n >= 1],
    ["defi7", "🗓️", "Fidèle", "Relever 7 défis du jour", () => S.defi.n >= 7],
  ];
  function nouveauxBadges() {
    const gagnes = [];
    for (const b of BADGES) if (!S.badges[b[0]] && b[4]()) { S.badges[b[0]] = jour(); gagnes.push(b); }
    return gagnes;
  }

  const ouvert = (i) => S.opt.libre || i === 0 || S.etoiles[P[i - 1].id] >= 1;
  const idsOuverts = () => P.filter((_, i) => ouvert(i)).map((p) => p.id);

  /* ============================================================
     Sons
     ============================================================ */
  let audio;
  function bip(notes) {
    if (!S.opt.son) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      let t = audio.currentTime;
      for (const [f, d] of notes) {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.connect(g).connect(audio.destination);
        o.start(t); o.stop(t + d);
        t += d * 0.8;
      }
    } catch (e) { /* pas d'audio : tant pis */ }
  }
  const sonOk = () => bip([[660, 0.09], [880, 0.14]]);
  const sonKo = () => { bip([[220, 0.2]]); if (S.opt.son && navigator.vibrate) navigator.vibrate(80); };
  const sonFin = () => bip([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]]);

  function confettis() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const formes = ["🎉", "⚜️", "⭐", "🇫🇷", "✨"];
    for (let i = 0; i < 26; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.textContent = formes[i % formes.length];
      c.style.left = Math.random() * 100 + "vw";
      c.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
      c.style.animationDelay = Math.random() * 0.5 + "s";
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }

  /* ============================================================
     Fabrique de questions
     ============================================================ */
  function qQcm(item) {
    const [q, bonne, fausses, expl] = item;
    const ch = melange([bonne, ...fausses]);
    return { tag: "Question", q, ch, rep: ch.indexOf(bonne), expl };
  }
  function qVf(item) {
    return { tag: "Vrai ou faux ?", q: item[0], ch: ["Vrai", "Faux"], rep: item[1] ? 0 : 1, expl: item[2], cls: "deux" };
  }
  function qDate(e) {
    const ecart = e.y < 500 ? 120 : e.y < 1500 ? 40 : e.y < 1800 ? 20 : 8;
    const s = new Set([e.y]);
    for (let g = 0; s.size < 4 && g < 300; g++) {
      const c = e.y + rnd(2 * ecart + 1) - ecart;
      if (c !== 0 && c <= AN_COURANT) s.add(c);
    }
    const ch = [...s].sort((a, b) => a - b);
    return { tag: "La bonne date", q: `${e.t} : en quelle année ?`, ch: ch.map(an), rep: ch.indexOf(e.y), expl: e.d, cls: "annees" };
  }
  function qQuoi(e) {
    const autres = uniques(EV.filter((x) => x.y !== e.y && Math.abs(x.pi - e.pi) <= 1), (x) => x.t);
    if (autres.length < 3) return null;
    const ch = melange([e, ...tirage(autres, 3)]);
    return { tag: "L'événement", q: `Que s'est-il passé en ${an(e.y)} ?`, ch: ch.map((x) => x.t), rep: ch.indexOf(e), expl: e.d };
  }
  function qQui(p, iIndice = 1) {
    const ch = melange([p, ...leurres(p)]);
    return { tag: "Qui suis-je ?", q: `« ${p.ind[iIndice]} »`, ch: ch.map((x) => x.nom), rep: ch.indexOf(p), expl: `${p.nom} (${p.dates}) — ${p.role}.` };
  }
  function leurres(p) {
    let autres = uniques(PERS.filter((x) => x.nom !== p.nom && Math.abs(x.pi - p.pi) <= 1), (x) => x.nom);
    if (autres.length < 3) autres = uniques(PERS.filter((x) => x.nom !== p.nom), (x) => x.nom);
    return tirage(autres, 3);
  }
  const SUCC = ROIS.map((_, i) => i).filter((i) => i + 1 < ROIS.length && ROIS[i][2] === ROIS[i + 1][1] && !/Napoléon III/.test(ROIS[i + 1][0]));
  function qSucc(i) {
    const suivant = ROIS[i + 1];
    const autres = ROIS.filter((r, k) => k !== i + 1 && k !== i && Math.abs(k - i) <= 7);
    const ch = melange([suivant, ...tirage(autres, 3)]);
    return { tag: "Succession", q: `Qui prend la tête de l'État après ${ROIS[i][0]}, en ${ROIS[i][2]} ?`, ch: ch.map((r) => r[0]), rep: ch.indexOf(suivant), expl: `${suivant[0]} (${suivant[1]}–${suivant[2] ?? "…"}), ${suivant[3]}.` };
  }

  /* Réservoir de « tickets » de questions pour un ensemble de périodes. */
  function reservoir(pids) {
    const r = { qcm: [], vf: [], date: [], quoi: [], qui: [] };
    for (const id of pids) {
      const p = PAR_ID[id];
      p.qcm.forEach((x) => r.qcm.push(() => qQcm(x)));
      p.vf.forEach((x) => r.vf.push(() => qVf(x)));
    }
    EV.filter((e) => pids.includes(e.pid) && !e.approx).forEach((e) => {
      r.date.push(() => qDate(e));
      r.quoi.push(() => qQuoi(e));
    });
    uniques(PERS.filter((x) => pids.includes(x.pid)), (x) => x.nom).forEach((x) => r.qui.push(() => qQui(x)));
    for (const k in r) r[k] = melange(r[k]);
    return r;
  }
  /* Compose n questions en respectant au mieux les quotas, puis complète. */
  function composer(pids, n, quotas = { qcm: 5, date: 2, quoi: 1, qui: 1, vf: 1 }) {
    const r = reservoir(pids);
    const qs = [];
    const prendre = (k) => { while (r[k].length) { const q = r[k].pop()(); if (q) return q; } return null; };
    for (const k in quotas) for (let i = 0; i < quotas[k] && qs.length < n; i++) { const q = prendre(k); if (q) qs.push(q); }
    const ordre = ["qcm", "vf", "qui", "date", "quoi"];
    for (let g = 0; qs.length < n && g < 200; g++) { const q = prendre(ordre[g % ordre.length]); if (q) qs.push(q); }
    return melange(qs);
  }

  /* ============================================================
     Cadre commun des jeux
     ============================================================ */
  function cadre(info, pct, corps) {
    document.body.classList.add("en-jeu");
    app.innerHTML = `
      <div class="jeu">
        <header class="jeu-top">
          <button class="x" id="quitter" aria-label="Quitter la partie">✕</button>
          <div class="barre" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
          <span class="jeu-info">${info}</span>
        </header>
        ${corps}
      </div>`;
    $("#quitter").onclick = quitter;
    window.scrollTo(0, 0);
  }
  function quitter() {
    document.body.classList.remove("en-jeu");
    rendre();
  }
  const coeurs = (n) => "❤️".repeat(Math.max(n, 0)) + "🖤".repeat(Math.max(3 - n, 0));

  /* Écran de fin commun : crédite l'XP, la série et les badges. */
  function fin({ emoji, titre, score, detail = "", xp, etoiles = null, rejouer }) {
    const avant = niveau(S.xp);
    S.xp += xp;
    S.stats.parties++;
    marquerJour();
    const badges = nouveauxBadges();
    const apres = niveau(S.xp);
    sauver();
    document.body.classList.add("en-jeu");
    app.innerHTML = `
      <div class="fin">
        <div class="gros-emoji">${emoji}</div>
        <h2>${esc(titre)}</h2>
        ${etoiles !== null ? etoilesHtml(etoiles) : ""}
        <div class="score">${score}</div>
        ${detail ? `<p class="muted">${detail}</p>` : ""}
        <div class="gain">+${xp} XP</div>
        ${apres > avant ? `<div class="carte nouveau"><div class="ico">${RANGS[apres - 1][1]}</div><div><span class="surtitre">Nouveau rang</span><br><b>${RANGS[apres - 1][0]}</b></div></div>` : ""}
        ${badges.map((b) => `<div class="carte nouveau"><div class="ico">${b[1]}</div><div><span class="surtitre">Badge débloqué</span><br><b>${b[2]}</b> <small>— ${b[3]}</small></div></div>`).join("")}
        <div class="rangee" style="margin-top:8px">
          <button class="btn second" id="fin-retour">Terminer</button>
          <button class="btn" id="fin-rejouer">Rejouer</button>
        </div>
      </div>`;
    $("#fin-retour").onclick = quitter;
    $("#fin-rejouer").onclick = rejouer;
    window.scrollTo(0, 0);
    if (apres > avant || badges.length || etoiles === 3) { confettis(); sonFin(); }
  }

  /* ============================================================
     Moteur de quiz (épreuve, défi du jour, survie, successions)
     ============================================================ */
  function quiz({ titre, questions, suivante, vies = 0, terminer }) {
    let i = 0, ok = 0, v = vies;
    const total = questions ? questions.length : null;
    function poser() {
      const q = questions ? questions[i] : suivante(i);
      if (!q || (vies && v <= 0)) return terminer({ ok, total: i });
      const info = vies ? `${coeurs(v)} · ${ok}` : `${i + 1} / ${total}`;
      const pct = total ? (i / total) * 100 : Math.min(100, ok * 4);
      cadre(info, pct, `
        <div class="surtitre">${esc(titre)} · ${esc(q.tag)}</div>
        <h2 class="question">${esc(q.q)}</h2>
        <div class="choix ${q.cls || ""}">
          ${q.ch.map((c, k) => `<button data-k="${k}">${esc(c)}</button>`).join("")}
        </div>
        <div id="verdict"></div>`);
      $$(".choix button").forEach((b) => (b.onclick = () => repondre(q, +b.dataset.k)));
    }
    function repondre(q, k) {
      const juste = k === q.rep;
      const boutons = $$(".choix button");
      boutons.forEach((b) => (b.disabled = true));
      boutons[q.rep].classList.add("bon");
      if (!juste) boutons[k].classList.add("faux");
      S.stats.rep++;
      if (juste) { ok++; S.stats.ok++; sonOk(); } else { v--; sonKo(); }
      i++;
      const dernier = questions ? i >= total : vies && v <= 0;
      $("#verdict").innerHTML = `
        <div class="verdict ${juste ? "ok" : "ko"}">
          <b>${juste ? "✅ Exact !" : "❌ Raté…"}</b>
          ${esc(q.expl || "")}
          <button class="btn large" id="continuer">${dernier ? "Voir le résultat" : "Continuer"}</button>
        </div>`;
      const c = $("#continuer");
      c.onclick = poser;
      c.focus({ preventScroll: true });
      c.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    poser();
  }

  function epreuve(pid) {
    const p = PAR_ID[pid];
    quiz({
      titre: p.titre,
      questions: composer([pid], 10),
      terminer({ ok, total }) {
        const e = ok === total ? 3 : ok >= total * 0.8 ? 2 : ok >= total * 0.5 ? 1 : 0;
        const avant = S.etoiles[pid] || 0;
        if (e > avant) S.etoiles[pid] = e;
        const idx = P.indexOf(p);
        const debloque = avant === 0 && e >= 1 && idx + 1 < P.length && !S.opt.libre;
        fin({
          emoji: e === 3 ? "🏆" : e >= 1 ? "🎉" : "📚",
          titre: e === 3 ? "Sans-faute !" : e >= 1 ? "Épreuve réussie" : "Encore un effort",
          score: `${ok} / ${total}`,
          etoiles: e,
          detail: debloque ? `Chapitre débloqué : <b>${esc(P[idx + 1].titre)}</b> ${P[idx + 1].emoji}` : e === 0 ? "Il faut 5 bonnes réponses pour décrocher une étoile. Relis la leçon et retente ta chance !" : "",
          xp: ok * 10 + (e === 3 ? 20 : 0),
          rejouer: () => epreuve(pid),
        });
      },
    });
  }

  function defiDuJour() {
    const dejaFait = S.defi.jour === jour();
    alea = graine(jour() * 7919);
    const questions = composer(P.map((p) => p.id), 10, { qcm: 4, date: 2, quoi: 1, qui: 2, vf: 1 });
    alea = Math.random;
    quiz({
      titre: "Défi du jour",
      questions,
      terminer({ ok, total }) {
        if (!dejaFait) { S.defi = { jour: jour(), score: ok, n: S.defi.n + 1 }; }
        else if (ok > S.defi.score) S.defi.score = ok;
        fin({
          emoji: ok >= 8 ? "🥇" : ok >= 5 ? "🥈" : "🥉",
          titre: "Défi du jour",
          score: `${ok} / ${total}`,
          detail: dejaFait ? "Défi déjà relevé aujourd'hui : pas de bonus cette fois." : "Reviens demain pour un nouveau défi et fais grandir ta série 🔥",
          xp: dejaFait ? 0 : ok * 10 + 30,
          rejouer: defiDuJour,
        });
      },
    });
  }

  function survie() {
    const pids = idsOuverts();
    let r = reservoir(pids);
    const ordre = ["qcm", "date", "qui", "vf", "quoi", "qcm"];
    quiz({
      titre: "Survie",
      vies: 3,
      suivante(i) {
        for (let g = 0; g < 12; g++) {
          const k = ordre[(i + g) % ordre.length];
          if (!r[k].length) { const neuf = reservoir(pids); r[k] = neuf[k]; }
          const ticket = r[k].pop();
          const q = ticket && ticket();
          if (q) return q;
        }
        return null;
      },
      terminer({ ok }) {
        const record = ok > S.rec.survie;
        if (record) S.rec.survie = ok;
        fin({ emoji: record ? "🏆" : "⚡", titre: record ? "Nouveau record !" : "Fin de la survie", score: `${ok}`, detail: `bonne${ok > 1 ? "s" : ""} réponse${ok > 1 ? "s" : ""} · record : ${S.rec.survie}`, xp: ok * 6, rejouer: survie });
      },
    });
  }

  function successions() {
    quiz({
      titre: "Rois et présidents",
      questions: tirage(SUCC, 10).map(qSucc),
      terminer({ ok, total }) {
        if (ok > S.rec.rois) S.rec.rois = ok;
        fin({ emoji: ok === total ? "👑" : "🤴", titre: "Successions", score: `${ok} / ${total}`, xp: ok * 8, rejouer: successions });
      },
    });
  }

  /* ============================================================
     Chronologie : placer chaque carte au bon endroit de la frise
     ============================================================ */
  function chronologie(pids) {
    const pool = melange(uniques(melange(EV.filter((e) => pids.includes(e.pid))), (e) => e.y));
    if (pool.length < 4) return toast("Pas assez d'événements pour jouer.");
    const aPlacer = Math.min(pool.length - 1, 12);
    const ligne = [pool.pop()];
    let vies = 3, score = 0, n = 0, dernier = null;

    function tour() {
      if (vies <= 0 || n >= aPlacer) return terminer();
      const c = pool[pool.length - 1];
      let h = "";
      for (let k = 0; k <= ligne.length; k++) {
        const lib = k === 0 ? "⬆ Avant" : k === ligne.length ? "⬇ Après" : "↔ Entre les deux";
        h += `<button class="fente" data-k="${k}">${lib}</button>`;
        if (k < ligne.length) {
          const e = ligne[k];
          const neuve = dernier && dernier.e === e ? ` neuve ${dernier.ok ? "ok" : "ko"}` : "";
          h += `<div class="posee${neuve}"><span class="an">${an(e.y)}</span><span>${esc(e.t)}</span></div>`;
        }
      }
      cadre(`${coeurs(vies)} · ${score}`, (n / aPlacer) * 100, `
        <div class="surtitre">Chronologie · carte ${n + 1} sur ${aPlacer}</div>
        <div class="a-placer"><small>Où placer cet événement ?</small><b>${esc(c.t)}</b><p>${esc(c.d)}</p></div>
        <div class="ligne-temps">${h}</div>`);
      $$(".fente").forEach((b) => (b.onclick = () => placer(+b.dataset.k)));
    }
    function placer(k) {
      const c = pool.pop();
      const ok = (k === 0 || ligne[k - 1].y <= c.y) && (k === ligne.length || c.y <= ligne[k].y);
      S.stats.rep++;
      if (ok) { score++; S.stats.ok++; sonOk(); } else { vies--; sonKo(); toast(`C'était en ${an(c.y)}`); }
      let pos = ligne.findIndex((e) => e.y > c.y);
      if (pos < 0) pos = ligne.length;
      ligne.splice(pos, 0, c);
      dernier = { e: c, ok };
      n++;
      tour();
    }
    function terminer() {
      const record = score > S.rec.chrono;
      if (record) S.rec.chrono = score;
      fin({
        emoji: vies > 0 ? "⏳" : "💥", titre: record ? "Nouveau record !" : vies > 0 ? "Frise complète" : "Plus de vies",
        score: `${score} / ${n}`, detail: `carte${score > 1 ? "s" : ""} bien placée${score > 1 ? "s" : ""} · record : ${S.rec.chrono}`,
        xp: score * 8 + (vies === 3 && n === aPlacer ? 20 : 0), rejouer: () => chronologie(pids),
      });
    }
    tour();
  }

  /* ============================================================
     Devine l'année
     ============================================================ */
  function devineAnnee(pids) {
    const pool = tirage(uniques(EV.filter((e) => pids.includes(e.pid) && !e.approx), (e) => e.t), 5);
    if (pool.length < 3) return toast("Ce jeu s'ouvre avec le chapitre sur la Gaule.");
    let i = 0, total = 0;

    function tour() {
      if (i >= pool.length) return terminer();
      const e = pool[i];
      const largeur = e.y < 500 ? 300 : e.y < 1500 ? 200 : e.y < 1800 ? 120 : 60;
      let min = e.y - 5 - rnd(largeur - 10);
      let max = min + largeur;
      if (max > AN_COURANT) { max = AN_COURANT; min = max - largeur; }
      let v = Math.round((min + max) / 2);
      cadre(`${total} pts`, (i / pool.length) * 100, `
        <div class="surtitre">Devine l'année · ${i + 1} sur ${pool.length}</div>
        <h2 class="question">${esc(e.t)}</h2>
        <p class="muted">${esc(e.d)}</p>
        <div class="annee-affiche" id="aff" aria-live="polite"></div>
        <input type="range" id="curseur" min="${min}" max="${max}" value="${v}" aria-label="Année">
        <div class="bornes"><span>${an(min)}</span><span>${an(max)}</span></div>
        <div class="pas">
          <button data-d="-10">−10</button><button data-d="-1">−1</button><button data-d="1">+1</button><button data-d="10">+10</button>
        </div>
        <button class="btn large" id="valider">Valider</button>
        <div id="verdict"></div>`);
      const curseur = $("#curseur"), aff = $("#aff");
      const maj = () => { v = +curseur.value; aff.textContent = an(v === 0 ? 1 : v); };
      curseur.oninput = maj;
      $$(".pas button").forEach((b) => (b.onclick = () => { curseur.value = Math.max(min, Math.min(max, v + +b.dataset.d)); maj(); }));
      maj();
      $("#valider").onclick = () => {
        const ecart = Math.abs(v - e.y);
        const pts = Math.max(0, Math.round(100 * (1 - ecart / (largeur * 0.3))));
        total += pts;
        S.stats.rep++;
        if (ecart === 0) S.stats.exact++;
        if (pts >= 50) { S.stats.ok++; sonOk(); } else sonKo();
        curseur.disabled = true;
        $$(".pas button").forEach((b) => (b.disabled = true));
        $("#valider").remove();
        i++;
        $("#verdict").innerHTML = `
          <div class="verdict ${pts >= 50 ? "ok" : "ko"}">
            <b>${ecart === 0 ? "🎯 Dans le mille !" : `Réponse : ${an(e.y)}`}</b>
            ${ecart === 0 ? "Année exacte." : `Tu étais à ${ecart} an${ecart > 1 ? "s" : ""} près.`} <b style="display:inline">+${pts} points</b>
            <button class="btn large" id="continuer">${i >= pool.length ? "Voir le résultat" : "Suivant"}</button>
          </div>`;
        $("#continuer").onclick = tour;
        $("#continuer").scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
    }
    function terminer() {
      const record = total > S.rec.annee;
      if (record) S.rec.annee = total;
      fin({ emoji: total >= 400 ? "🎯" : "📅", titre: record ? "Nouveau record !" : "Devine l'année", score: `${total} pts`, detail: `sur ${pool.length * 100} · record : ${S.rec.annee}`, xp: Math.round(total / 8), rejouer: () => devineAnnee(pids) });
    }
    tour();
  }

  /* ============================================================
     Qui suis-je ? (indices progressifs)
     ============================================================ */
  function quiSuisJe(pids) {
    const pool = tirage(uniques(PERS.filter((p) => pids.includes(p.pid)), (p) => p.nom), 5);
    let i = 0, total = 0;

    function tour() {
      if (i >= pool.length) return terminer();
      const p = pool[i];
      const choix = melange([p, ...leurres(p)]);
      let vus = 1;
      const dessiner = () => {
        cadre(`${total} pts`, (i / pool.length) * 100, `
          <div class="surtitre">Qui suis-je ? · ${i + 1} sur ${pool.length} · vaut ${4 - vus} pt${4 - vus > 1 ? "s" : ""}</div>
          <ul class="indices">${p.ind.slice(0, vus).map((x) => `<li>« ${esc(x)} »</li>`).join("")}</ul>
          ${vus < 3 ? `<button class="btn second large" id="indice" style="margin-bottom:14px">💡 Indice suivant (−1 point)</button>` : ""}
          <div class="choix">${choix.map((c, k) => `<button data-k="${k}">${esc(c.nom)}</button>`).join("")}</div>
          <div id="verdict"></div>`);
        if (vus < 3) $("#indice").onclick = () => { vus++; dessiner(); };
        $$(".choix button").forEach((b) => (b.onclick = () => repondre(+b.dataset.k)));
      };
      const repondre = (k) => {
        const juste = choix[k] === p;
        const pts = juste ? 4 - vus : 0;
        total += pts;
        S.stats.rep++;
        if (juste) { S.stats.ok++; sonOk(); } else sonKo();
        const boutons = $$(".choix button");
        boutons.forEach((b) => (b.disabled = true));
        boutons[choix.indexOf(p)].classList.add("bon");
        if (!juste) boutons[k].classList.add("faux");
        const ind = $("#indice");
        if (ind) ind.remove();
        i++;
        $("#verdict").innerHTML = `
          <div class="verdict ${juste ? "ok" : "ko"}">
            <b>${juste ? `✅ +${pts} point${pts > 1 ? "s" : ""}` : "❌ Raté…"} — ${esc(p.nom)} <small>(${esc(p.dates)})</small></b>
            ${esc(p.bio)}
            <button class="btn large" id="continuer">${i >= pool.length ? "Voir le résultat" : "Suivant"}</button>
          </div>`;
        $("#continuer").onclick = tour;
        $("#continuer").scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
      dessiner();
    }
    function terminer() {
      const max = pool.length * 3;
      if (pool.length === 5 && total > S.rec.qui) S.rec.qui = total;
      fin({ emoji: total === max ? "🕵️" : "🎭", titre: "Qui suis-je ?", score: `${total} / ${max}`, detail: "Moins tu demandes d'indices, plus tu marques.", xp: total * 5, rejouer: () => quiSuisJe(pids) });
    }
    tour();
  }

  /* ============================================================
     Cartes mémoire (répétition espacée de Leitner)
     ============================================================ */
  const INTERVALLES = [1, 2, 4, 8, 16, 32];
  function cartesDe(pids) {
    const c = [];
    EV.filter((e) => pids.includes(e.pid)).forEach((e) => c.push({ id: e.id, tag: "Date", recto: e.t, rep: (e.approx ? "vers " : "") + an(e.y), verso: e.d }));
    PERS.filter((p) => pids.includes(p.pid)).forEach((p) => c.push({ id: p.id, tag: "Personnage", recto: p.nom, rep: p.role, verso: p.dates }));
    return c;
  }
  function cartesMemoire(pids, forcer = false) {
    const toutes = cartesDe(pids);
    const j = jour();
    const dues = melange(toutes.filter((c) => S.cartes[c.id] && S.cartes[c.id].d <= j));
    const neuves = toutes.filter((c) => !S.cartes[c.id]);
    let file = [...dues, ...neuves].slice(0, 12);
    if (!file.length && forcer) file = tirage(toutes, 12);
    if (!file.length) {
      document.body.classList.add("en-jeu");
      app.innerHTML = `
        <div class="fin">
          <div class="gros-emoji">🌙</div>
          <h2>Tout est révisé !</h2>
          <p class="muted">Aucune carte à revoir aujourd'hui dans cette sélection. La répétition espacée te les représentera au bon moment.</p>
          <div class="rangee"><button class="btn second" id="r1">Retour</button><button class="btn" id="r2">Réviser quand même</button></div>
        </div>`;
      $("#r1").onclick = quitter;
      $("#r2").onclick = () => cartesMemoire(pids, true);
      return;
    }
    const total = file.length;
    let sus = 0, vues = 0;
    const revues = new Set();

    function tour() {
      if (!file.length) return fin({ emoji: "🃏", titre: "Révision terminée", score: `${sus} / ${total}`, detail: `carte${sus > 1 ? "s" : ""} sue${sus > 1 ? "s" : ""} du premier coup · ${maitrisees()} maîtrisée${maitrisees() > 1 ? "s" : ""} au total`, xp: sus * 4 + (total - sus) * 2, rejouer: () => cartesMemoire(pids) });
      const c = file[0];
      cadre(`${Math.min(vues + 1, total)} / ${total}`, (vues / total) * 100, `
        <div class="surtitre">Cartes mémoire · ${c.tag}</div>
        <div class="flash" id="flash">
          <button class="flash-in" id="tourner" aria-label="Retourner la carte">
            <span class="face recto"><span class="gros">${esc(c.recto)}</span><p>${c.tag === "Date" ? "Quand ?" : "Qui est-ce ?"}</p><small>Touche pour retourner</small></span>
            <span class="face verso"><span class="rep">${esc(c.rep)}</span><p>${esc(c.verso)}</p></span>
          </button>
        </div>
        <div class="rangee" id="jugement" hidden>
          <button class="btn rouge" id="non">À revoir</button>
          <button class="btn" id="oui" style="background:var(--ok)">Je savais</button>
        </div>`);
      $("#tourner").onclick = () => { $("#flash").classList.toggle("retournee"); $("#jugement").hidden = false; };
      $("#oui").onclick = () => juger(true);
      $("#non").onclick = () => juger(false);
    }
    function juger(su) {
      const c = file.shift();
      const etat = S.cartes[c.id] || { b: 0, d: j };
      if (!revues.has(c.id)) {
        vues++;
        if (su) { sus++; etat.b = Math.min(etat.b + 1, INTERVALLES.length - 1); etat.d = j + INTERVALLES[etat.b - 1]; }
        else { etat.b = 0; etat.d = j; }
        S.cartes[c.id] = etat;
      }
      if (!su) { revues.add(c.id); file.push(c); }
      sauver();
      tour();
    }
    tour();
  }

  /* ============================================================
     Vues
     ============================================================ */
  let invite = null; // événement beforeinstallprompt

  function vueAccueil() {
    const n = niveau(S.xp);
    const [rang, embleme] = RANGS[n - 1];
    const bas = seuil(n), haut = n < RANGS.length ? seuil(n + 1) : null;
    const pct = haut ? ((S.xp - bas) / (haut - bas)) * 100 : 100;
    const prochainIdx = P.findIndex((p, i) => ouvert(i) && !(S.etoiles[p.id] >= 1));
    const prochain = prochainIdx >= 0 ? P[prochainIdx] : P.find((p) => (S.etoiles[p.id] || 0) < 3);
    const defiFait = S.defi.jour === jour();
    const debut = S.stats.parties === 0 && !Object.keys(S.lus).length;
    return `
      <header class="entete">
        <div class="surtitre">Chroniques de France</div>
        <h1>${debut ? "Bienvenue !" : "Bon retour !"}</h1>
        <p>${debut ? "Vingt et un chapitres, de Lascaux à nos jours. Lis, joue, gagne des étoiles." : "L'histoire de France, un chapitre à la fois."}</p>
      </header>
      <div class="tricolore"></div>

      <section class="carte profil-carte">
        <div class="blason">${embleme}</div>
        <div>
          <div class="surtitre">Rang ${n}</div>
          <div class="rang">${rang}</div>
          <div class="xp-ligne"><span>${S.xp} XP</span><span>${haut ? `${RANGS[n][0]} à ${haut} XP` : "Rang maximal"}</span></div>
          <div class="barre"><i style="width:${pct}%"></i></div>
        </div>
      </section>

      <div class="compteurs">
        <div class="compteur"><b>🔥 ${serieActive()}</b><span>jour${serieActive() > 1 ? "s" : ""} de suite</span></div>
        <div class="compteur"><b>⭐ ${totalEtoiles()}</b><span>sur ${P.length * 3} étoiles</span></div>
        <div class="compteur"><b>🏅 ${Object.keys(S.badges).length}</b><span>sur ${BADGES.length} badges</span></div>
      </div>

      <section class="carte defi">
        <div class="surtitre" style="color:#ffd98a">Défi du jour</div>
        <h2>${defiFait ? `Relevé : ${S.defi.score} / 10` : "10 questions, toutes époques"}</h2>
        <p>${defiFait ? "Un nouveau défi t'attend demain. Tu peux rejouer celui-ci pour le plaisir." : "Le même défi pour tout le monde aujourd'hui. Bonus de 30 XP à la clé."}</p>
        <button class="btn large" data-jeu="defi">${defiFait ? "Rejouer" : "Relever le défi"}</button>
      </section>

      ${prochain ? `
      <section class="carte">
        <div class="surtitre">${S.etoiles[prochain.id] ? "À perfectionner" : "Prochain chapitre"}</div>
        <h2 style="margin:4px 0 2px">${prochain.emoji} ${esc(prochain.titre)}</h2>
        <p class="muted">${esc(prochain.sous)}</p>
        <a class="btn large" href="#/p/${prochain.id}">${S.lus[prochain.id] ? "Continuer" : "Commencer"}</a>
      </section>` : `
      <section class="carte"><h2>🏛️ Parcours terminé</h2><p class="muted" style="margin:6px 0 0">Trois étoiles partout : te voilà Immortel. Les jeux d'arcade t'attendent pour battre tes records.</p></section>`}

      ${invite ? `<button class="btn second large" id="installer">📲 Installer l'application</button>` : ""}`;
  }

  function vueParcours() {
    let h = `<header class="entete"><h1>Le parcours</h1><p>Décroche une étoile à l'épreuve d'un chapitre pour ouvrir le suivant.</p></header>`;
    let ere = "";
    P.forEach((p, i) => {
      if (p.ere !== ere) { ere = p.ere; h += `<div class="ere surtitre">${esc(ere)}</div>`; }
      const ok = ouvert(i);
      const corps = `<span class="pastille">${ok ? p.emoji : "🔒"}</span><span><b>${esc(p.titre)}</b><small>${esc(p.sous)}</small></span>${ok ? etoilesHtml(S.etoiles[p.id] || 0) : ""}`;
      h += ok ? `<a class="chapitre" href="#/p/${p.id}">${corps}</a>` : `<button class="chapitre verrou" data-verrou="${esc(P[i - 1].titre)}">${corps}</button>`;
    });
    return h;
  }

  function vuePeriode(id, onglet = "lecon") {
    const p = PAR_ID[id];
    const idx = P.indexOf(p);
    if (!p || !ouvert(idx)) { location.hash = "#/parcours"; return ""; }
    const onglets = [["lecon", "Leçon"], ["dates", "Dates"], ["pers", "Personnages"], ["jouer", "🎮 Jouer"]];
    let corps = "";
    if (onglet === "lecon") {
      corps = `<p class="muted">${esc(p.intro)}</p>` + p.lecons.map(([t, x]) => `<article class="carte lecon"><h3>${esc(t)}</h3><p>${riche(x)}</p></article>`).join("") +
        (S.lus[id] ? `<a class="btn large" href="#/p/${id}/jouer">🎮 Passer aux jeux</a>` : `<button class="btn large or" id="lu">✓ J'ai lu la leçon (+15 XP)</button>`);
    } else if (onglet === "dates") {
      corps = `<section class="carte">${p.ev.map((e) => `<div class="date-ligne"><span class="an">${e[3] ? "vers " : ""}${an(e[0])}</span><div><b>${esc(e[1])}</b><p>${esc(e[2])}</p></div></div>`).join("")}</section>`;
    } else if (onglet === "pers") {
      corps = p.pers.map((x) => `<details class="carte perso"><summary><span><b>${esc(x[0])}</b><small>${esc(x[1])} · ${esc(x[2])}</small></span></summary><p>${esc(x[3])}</p></details>`).join("");
    } else {
      const e = S.etoiles[id] || 0;
      const suiv = P[idx + 1];
      corps = `
        <button class="mode" data-jeu="epreuve"><span class="ico">🏆</span><span><b>L'épreuve</b><small>10 questions. ${e ? "Améliore ton score !" : suiv ? "Une étoile ouvre le chapitre suivant." : "Décroche tes étoiles."}</small></span>${etoilesHtml(e)}</button>
        <button class="mode" data-jeu="chrono"><span class="ico">⏳</span><span><b>Chronologie</b><small>Replace les événements du chapitre dans l'ordre.</small></span></button>
        <button class="mode" data-jeu="qui"><span class="ico">🕵️</span><span><b>Qui suis-je ?</b><small>Reconnais les personnages avec le moins d'indices possible.</small></span></button>
        <button class="mode" data-jeu="cartes"><span class="ico">🃏</span><span><b>Cartes mémoire</b><small>Dates et personnages en répétition espacée.</small></span></button>
        ${e && suiv && ouvert(idx + 1) ? `<a class="btn second large" href="#/p/${suiv.id}">Chapitre suivant : ${esc(suiv.titre)} →</a>` : ""}`;
    }
    return `
      <a class="retour" href="#/parcours">← Parcours</a>
      <header class="entete">
        <div class="surtitre">${esc(p.ere)} · ${esc(p.sous)}</div>
        <h1>${p.emoji} ${esc(p.titre)}</h1>
      </header>
      <div class="onglets quatre" role="tablist">${onglets.map(([k, l]) => `<button role="tab" aria-selected="${k === onglet}" class="${k === onglet ? "actif" : ""}" data-onglet="${k}">${l}</button>`).join("")}</div>
      ${corps}`;
  }

  function vueJeux() {
    const n = idsOuverts().length;
    const modes = [
      ["chrono", "⏳", "Chronologie", "Place chaque événement au bon endroit de la frise. 3 vies.", S.rec.chrono ? `Record ${S.rec.chrono}` : ""],
      ["annee", "🎯", "Devine l'année", "Règle le curseur au plus près de la bonne date.", S.rec.annee ? `Record ${S.rec.annee}` : ""],
      ["qui", "🕵️", "Qui suis-je ?", "Trois indices, du plus obscur au plus évident.", S.rec.qui ? `Record ${S.rec.qui}/15` : ""],
      ["survie", "⚡", "Survie", "Questions en rafale jusqu'à la troisième erreur.", S.rec.survie ? `Record ${S.rec.survie}` : ""],
      ["rois", "👑", "Rois et présidents", "Qui succède à qui ? Toutes époques confondues.", S.rec.rois ? `Record ${S.rec.rois}/10` : ""],
      ["cartes", "🃏", "Cartes mémoire", "La révision du jour, calculée par répétition espacée.", `${maitrisees()} maîtrisées`],
    ];
    return `
      <header class="entete"><h1>Salle de jeux</h1><p>${S.opt.libre ? "Mode libre : toutes les époques sont en jeu." : `Les questions portent sur tes ${n} chapitre${n > 1 ? "s" : ""} ouvert${n > 1 ? "s" : ""}.`}</p></header>
      ${modes.map(([k, ico, t, d, rec]) => `<button class="mode" data-jeu="${k}"><span class="ico">${ico}</span><span><b>${t}</b><small>${d}</small></span><span class="rec">${rec}</span></button>`).join("")}`;
  }

  function vueFrise(onglet = "frise") {
    let corps;
    if (onglet === "frise") {
      corps = `<input class="recherche" id="filtre" type="search" placeholder="Rechercher une date, un mot…" aria-label="Rechercher dans la frise">
        <div id="frise">${P.map((p) => `
          <section data-bloc>
            <div class="frise-titre">${p.emoji} ${esc(p.titre)} <small>${esc(p.sous)}</small></div>
            ${p.ev.map((e) => `<div class="date-ligne" data-txt="${esc((an(e[0]) + " " + e[1] + " " + e[2]).toLowerCase())}"><span class="an">${e[3] ? "vers " : ""}${an(e[0])}</span><div><b>${esc(e[1])}</b><p>${esc(e[2])}</p></div></div>`).join("")}
          </section>`).join("")}</div>
        <p class="muted" id="vide" hidden>Aucun événement ne correspond.</p>`;
    } else {
      let regime = "";
      corps = `<section class="carte">` + ROIS.map((r) => {
        const titre = r[3] !== regime ? ((regime = r[3]), `<div class="surtitre" style="margin-top:14px">${esc(r[3])}</div>`) : "";
        return `${titre}<div class="roi"><b>${esc(r[0])}</b><span>${r[1] === r[2] ? r[1] : `${r[1]} – ${r[2] ?? "…"}`}</span></div>`;
      }).join("") + `</section><p class="muted"><small>Liste simplifiée : tous les rois mérovingiens et carolingiens ne sont pas mentionnés, non plus que les chefs des gouvernements provisoires.</small></p>`;
    }
    return `
      <header class="entete"><h1>La grande frise</h1><p>${EV.length} dates et ${ROIS.length} chefs d'État, pour s'y retrouver d'un coup d'œil.</p></header>
      <div class="onglets"><button class="${onglet === "frise" ? "actif" : ""}" data-frise="frise">📜 Événements</button><button class="${onglet === "rois" ? "actif" : ""}" data-frise="rois">👑 Rois et présidents</button></div>
      ${corps}`;
  }

  function vueProfil() {
    const n = niveau(S.xp);
    const taux = S.stats.rep ? Math.round((S.stats.ok / S.stats.rep) * 100) : 0;
    return `
      <header class="entete"><h1>Profil</h1><p>${RANGS[n - 1][1]} ${RANGS[n - 1][0]} · ${S.xp} XP</p></header>
      <div class="compteurs">
        <div class="compteur"><b>${S.stats.parties}</b><span>parties jouées</span></div>
        <div class="compteur"><b>${S.stats.ok}</b><span>bonnes réponses</span></div>
        <div class="compteur"><b>${taux} %</b><span>de réussite</span></div>
      </div>
      <h2 style="margin:18px 0 10px">Badges <small>${Object.keys(S.badges).length} / ${BADGES.length}</small></h2>
      <div class="badges">${BADGES.map((b) => `<div class="badge ${S.badges[b[0]] ? "" : "off"}"><span class="ico">${b[1]}</span><b>${b[2]}</b>${b[3]}</div>`).join("")}</div>

      <h2 style="margin:22px 0 10px">Réglages</h2>
      <section class="carte">
        <label class="option"><span><b>Sons et vibrations</b></span><input type="checkbox" id="o-son" ${S.opt.son ? "checked" : ""}></label>
        <label class="option"><span><b>Mode libre</b><br><small>Ouvre tous les chapitres sans passer les épreuves.</small></span><input type="checkbox" id="o-libre" ${S.opt.libre ? "checked" : ""}></label>
        <label class="option"><span><b>Apparence</b></span>
          <select id="o-theme">${[["auto", "Automatique"], ["light", "Claire"], ["dark", "Sombre"]].map(([v, l]) => `<option value="${v}" ${S.opt.theme === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        </label>
      </section>
      <section class="carte">
        <p class="muted" style="margin-bottom:12px"><small>Ta progression est enregistrée uniquement sur cet appareil. Exporte-la pour la transférer ou la mettre à l'abri.</small></p>
        <div class="rangee">
          <button class="btn second" id="exporter">Exporter</button>
          <button class="btn second" id="importer">Importer</button>
          <button class="btn second" id="raz" style="color:var(--rouge)">Tout effacer</button>
        </div>
        <input type="file" id="fichier" accept="application/json,.json" hidden>
      </section>
      ${invite ? `<button class="btn large" id="installer">📲 Installer l'application</button>` : ""}
      <p class="muted" style="text-align:center;margin-top:18px"><small>Chroniques de France · fonctionne hors ligne</small></p>`;
  }

  /* ============================================================
     Routeur et branchements
     ============================================================ */
  let ongletFrise = "frise";
  function rendre() {
    if (document.body.classList.contains("en-jeu")) return;
    const [, route = "", a, b] = location.hash.split("/");
    let html, tab;
    if (route === "parcours") { html = vueParcours(); tab = "parcours"; }
    else if (route === "p" && PAR_ID[a]) { html = vuePeriode(a, b || "lecon"); tab = "parcours"; }
    else if (route === "jeux") { html = vueJeux(); tab = "jeux"; }
    else if (route === "frise") { html = vueFrise(ongletFrise); tab = "frise"; }
    else if (route === "profil") { html = vueProfil(); tab = "profil"; }
    else { html = vueAccueil(); tab = "accueil"; }
    app.innerHTML = html;
    $$("#nav a").forEach((l) => { const actif = l.dataset.tab === tab; l.classList.toggle("actif", actif); actif ? l.setAttribute("aria-current", "page") : l.removeAttribute("aria-current"); });
    brancher(route, a);
  }

  function lancer(jeu, pid) {
    const pids = pid ? [pid] : idsOuverts();
    ({
      defi: defiDuJour,
      epreuve: () => epreuve(pid),
      chrono: () => chronologie(pids),
      annee: () => devineAnnee(pids),
      qui: () => quiSuisJe(pids),
      survie,
      rois: successions,
      cartes: () => cartesMemoire(pids),
    })[jeu]();
  }

  function brancher(route, a) {
    const pid = route === "p" ? a : null;
    $$("[data-jeu]").forEach((b) => (b.onclick = () => lancer(b.dataset.jeu, pid)));
    $$("[data-verrou]").forEach((b) => (b.onclick = () => toast(`Décroche une étoile dans « ${b.dataset.verrou} » pour ouvrir ce chapitre.`)));
    $$("[data-onglet]").forEach((b) => (b.onclick = () => { history.replaceState(null, "", `#/p/${pid}/${b.dataset.onglet}`); rendre(); }));
    $$("[data-frise]").forEach((b) => (b.onclick = () => { ongletFrise = b.dataset.frise; rendre(); }));

    const lu = $("#lu");
    if (lu) lu.onclick = () => {
      S.lus[pid] = 1; S.xp += 15; marquerJour();
      const b = nouveauxBadges(); sauver();
      toast(b.length ? `+15 XP · Badge : ${b[0][2]} ${b[0][1]}` : "+15 XP · Place aux jeux !");
      location.hash = `#/p/${pid}/jouer`;
    };

    const filtre = $("#filtre");
    if (filtre) filtre.oninput = () => {
      const q = filtre.value.trim().toLowerCase();
      let n = 0;
      $$("[data-bloc]").forEach((bloc) => {
        let vus = 0;
        $$("[data-txt]", bloc).forEach((l) => { const ok = !q || l.dataset.txt.includes(q); l.hidden = !ok; if (ok) vus++; });
        bloc.hidden = !vus; n += vus;
      });
      $("#vide").hidden = n > 0;
    };

    const inst = $("#installer");
    if (inst) inst.onclick = async () => { if (!invite) return; invite.prompt(); await invite.userChoice; invite = null; rendre(); };

    if (route === "profil") {
      $("#o-son").onchange = (e) => { S.opt.son = e.target.checked; sauver(); if (S.opt.son) sonOk(); };
      $("#o-libre").onchange = (e) => { S.opt.libre = e.target.checked; sauver(); toast(S.opt.libre ? "Tous les chapitres sont ouverts." : "Progression par étapes rétablie."); };
      $("#o-theme").onchange = (e) => { S.opt.theme = e.target.value; sauver(); appliquerTheme(); };
      $("#exporter").onclick = () => {
        const lien = document.createElement("a");
        lien.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" }));
        lien.download = "chroniques-de-france-sauvegarde.json";
        lien.click();
        setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
      };
      $("#importer").onclick = () => $("#fichier").click();
      $("#fichier").onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const d = JSON.parse(await f.text());
          if (typeof d.xp !== "number" || typeof d.etoiles !== "object") throw new Error("format");
          if (!confirm("Remplacer la progression actuelle par celle du fichier ?")) return;
          localStorage.setItem(CLE, JSON.stringify(d));
          charger(); appliquerTheme(); rendre(); toast("Progression importée.");
        } catch (err) { toast("Ce fichier n'est pas une sauvegarde valide."); }
      };
      $("#raz").onclick = () => {
        if (!confirm("Effacer toute la progression ? Cette action est définitive.")) return;
        S = VIDE(); sauver(); appliquerTheme(); rendre(); toast("Progression effacée.");
      };
    }
  }

  window.addEventListener("hashchange", () => { document.body.classList.remove("en-jeu"); rendre(); window.scrollTo(0, 0); });
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); invite = e; rendre(); });
  window.addEventListener("appinstalled", () => { invite = null; rendre(); toast("Application installée !"); });

  charger();
  appliquerTheme();
  rendre();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
