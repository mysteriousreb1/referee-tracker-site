/* Referee Tracker — formulaire d'inscription (vanilla JS, aucun framework). */
(function () {
  "use strict";

  const SUPABASE_URL = "https://jlstedchnmdteazuqbly.supabase.co";
  const SUPABASE_KEY = "sb_publishable_B1w244FrkzbIn-SZ-T_z8w_4HVg9stb"; // clé publique (publishable) : pas un secret
  const FN_INSCRIPTION = SUPABASE_URL + "/functions/v1/inscription";
  const MAX_FICHIER = 20 * 1024 * 1024;
  const MAX_FICHIERS = 300;

  // Page anglaise (signup.html) : messages en anglais ; rien ne change dans ce qui est envoyé au serveur.
  const EN = document.documentElement.lang === "en";
  const t = (fr, en) => (EN ? en : fr);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const form = $("#form");
  if (!form) return;

  const panels = $$(".step-panel");
  const progressItems = $$("#progress li");
  const bar = $("#bar");
  const progressBar = $("#progress .bar");
  let etape = 1;
  let fichiers = []; // File[]
  let dernierEnvoi = null; // { inscription_id, uploads }

  /* ---------- Navigation ---------- */
  function afficher(n) {
    etape = n;
    panels.forEach((p) => { p.hidden = Number(p.dataset.panel) !== n; });
    progressItems.forEach((li) => {
      const s = Number(li.dataset.step);
      li.classList.toggle("active", s === n);
      li.classList.toggle("done", s < n);
    });
    const pct = Math.min(n, 4) / 4 * 100;
    bar.style.width = pct + "%";
    progressBar.setAttribute("aria-valuenow", String(Math.min(n, 4)));
    progressBar.setAttribute("aria-label", t("Étape ", "Step ") + Math.min(n, 4) + t(" sur 4", " of 4"));
    if (n === 5) $("#progress").hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
    const h = $("[data-panel='" + n + "'] h2");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  $$("[data-next]").forEach((b) => b.addEventListener("click", () => {
    if (valider(etape)) { if (etape === 3) remplirRecap(); afficher(etape + 1); }
  }));
  $$("[data-prev]").forEach((b) => b.addEventListener("click", () => afficher(etape - 1)));

  /* ---------- Validation ---------- */
  const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const RE_TEL = /^(\+33|0)[1-9](\s?\d{2}){4}$/;

  function erreur(id, msg) {
    const el = $("#" + id), e = $("#err-" + id);
    if (e) { e.textContent = msg || ""; e.classList.toggle("show", !!msg); }
    if (el) { if (msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); }
    return !msg;
  }
  const val = (id) => ($("#" + id).value || "").trim();

  function valider(n) {
    let ok = true, premier = null;
    const test = (id, cond, msg) => { if (!erreur(id, cond ? "" : msg)) { ok = false; premier = premier || $("#" + id); } };
    if (n === 1) {
      test("prenom", val("prenom").length >= 2, t("Indique ton prénom.", "Enter your first name."));
      const nom = val("nom_ffbb");
      test("nom_ffbb", nom.split(/\s+/).filter(Boolean).length >= 2, t("Indique ton NOM puis ton prénom, comme sur les convocations (ex. MARTIN JULIE).", "Enter your LAST NAME then your first name, as on your appointments (e.g. MARTIN JULIE)."));
      test("email_connexion", RE_EMAIL.test(val("email_connexion")), t("Adresse e-mail invalide.", "Invalid e-mail address."));
      const tel = val("telephone").replace(/[.\-]/g, "");
      { const em = val("emarque_v2").replace(/\s+/g, ""); test("emarque_v2", !em || /^[A-Za-z0-9]{6,40}$/.test(em), t("Clé e-Marque : lettres et chiffres uniquement (6 à 40).", "e-Marque key: letters and numbers only (6 to 40).")); }
      test("telephone", !!tel && RE_TEL.test(tel), tel ? t("Numéro de téléphone invalide (ex. 06 12 34 56 78).", "Invalid phone number (e.g. 06 12 34 56 78).") : t("Indique ton numéro de téléphone.", "Enter your phone number."));
    }
    if (n === 2) {
      test("email_ffbb", RE_EMAIL.test(val("email_ffbb")), t("Adresse e-mail invalide.", "Invalid e-mail address."));
      test("fournisseur_mail", !!val("fournisseur_mail"), t("Choisis le fournisseur de ta messagerie.", "Choose your e-mail provider."));
      test("niveau", !!val("niveau"), t("Choisis ton niveau.", "Choose your level."));
      test("cd", !!val("cd"), t("Choisis ton comité départemental.", "Choose your county committee."));
      if (val("cd") === "AUTRE") test("cd_autre", val("cd_autre").length >= 2, t("Précise ton comité.", "Specify your committee."));
      if (!$("#f-parcours").hidden) test("parcours", !!val("parcours"), t("Choisis ton parcours (ou « Aucun »).", "Choose your pathway (or \"None\")."));
      test("ligue", !!val("ligue"), t("Choisis ta ligue.", "Choose your regional league."));
    }
    if (n === 3) {
      test("adresse", val("adresse").length >= 3, t("Indique ton adresse de départ.", "Enter your starting address."));
      if (val("adresse").length >= 3 && ADR.service && ADR.proposee && !ADR.choisie) test("adresse", false, t("Clique sur ton adresse dans la liste juste en dessous du champ.", "Click your address in the list just below the field."));
      test("code_postal", /^\d{5}$/.test(val("code_postal")), t("Code postal à 5 chiffres.", "5-digit postcode."));
      test("ville", val("ville").length >= 2, t("Indique ta ville.", "Enter your town."));
      const conso = val("vehicule_conso"), cv = val("vehicule_cv");
      test("vehicule_modele", val("vehicule_modele").length >= 2, t("Indique le modèle de ton véhicule.", "Enter your car model."));
      test("vehicule_conso", !!conso && Number(conso) >= 1 && Number(conso) <= 30, t("Consommation entre 1 et 30 L/100.", "Fuel consumption between 1 and 30 L/100 km."));
      test("vehicule_cv", !!cv && Number.isInteger(Number(cv)) && Number(cv) >= 1 && Number(cv) <= 30, t("CV fiscaux entre 1 et 30.", "Fiscal horsepower between 1 and 30."));
      test("fichiers", fichiers.length <= MAX_FICHIERS, t("Maximum ", "Maximum ") + MAX_FICHIERS + t(" fichiers.", " files."));
    }
    if (n === 4) {
      test("consent_age", $("#consent_age").checked, t("Referee Tracker est réservé aux arbitres de 15 ans et plus.", "Referee Tracker is for referees aged 15 and over."));
      test("consent_cgu", $("#consent_cgu").checked, t("Tu dois accepter les conditions pour continuer.", "You must accept the terms to continue."));
      test("consent_donnees", $("#consent_donnees").checked, t("Ce consentement est nécessaire pour traiter tes convocations.", "This consent is required to process your appointments."));
    }
    if (premier) premier.focus();
    return ok;
  }

  // Effacer l'erreur dès que l'utilisateur corrige
  form.addEventListener("input", (e) => { if (e.target.id) erreur(e.target.id, ""); });
  form.addEventListener("change", (e) => { if (e.target.id) erreur(e.target.id, ""); });

  // NOM officiel : forcer les majuscules
  $("#nom_ffbb").addEventListener("blur", (e) => { e.target.value = e.target.value.toUpperCase().replace(/\s+/g, " ").trim(); });
  // Comité « Autre » : champ libre
  // b95 — la ligue se remplit d'après le comité (département → ligue régionale) ; l'arbitre peut toujours la changer.
  const LIGUE_DE = {}; Object.entries({
    ARA: "01 03 07 15 26 38 42 43 63 69 73 74", BFC: "21 25 39 58 70 71 89 90", BRE: "22 29 35 56", CVL: "18 28 36 37 41 45", COR: "2A 2B 20",
    LRGEB: "08 10 51 52 54 55 57 67 68 88", HDF: "02 59 60 62 80", IDF: "75 77 78 91 92 93 94 95", NOR: "14 27 50 61 76",
    NAQ: "16 17 19 23 24 33 40 47 64 79 86 87", OCC: "09 11 12 30 31 32 34 46 48 65 66 81 82", PDL: "44 49 53 72 85", PACA: "04 05 06 13 83 84" })
    .forEach(([lg, deps]) => deps.split(" ").forEach((d) => { LIGUE_DE[d] = lg; }));
  const ligueAuto = () => {
    const brut = val("cd") === "AUTRE" ? val("cd_autre") : val("cd"), m = String(brut || "").toUpperCase().match(/(2A|2B|\d{1,2})/);
    const lg = m ? LIGUE_DE[m[1].length === 1 ? "0" + m[1] : m[1]] : "";
    if (lg) { $("#ligue").value = lg; erreur("ligue", ""); }
  };
  $("#cd").addEventListener("change", (e) => { $("#f-cd-autre").hidden = e.target.value !== "AUTRE"; ligueAuto(); });
  $("#cd_autre").addEventListener("change", ligueAuto);
  // Pré-remplir l'e-mail convocations avec l'e-mail de connexion
  $("#email_connexion").addEventListener("blur", (e) => { const f = $("#email_ffbb"); if (!f.value) f.value = e.target.value.trim(); });

  /* ---------- Fichiers ---------- */
  const drop = $("#drop"), inputFichiers = $("#fichiers"), listeUl = $("#files"), compteur = $("#files-count");

  function ajouterFichiers(liste) {
    const refus = [];
    Array.from(liste).forEach((f) => {
      const estPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (!estPdf) return refus.push(f.name + t(" (pas un PDF)", " (not a PDF)"));
      if (f.size > MAX_FICHIER) return refus.push(f.name + t(" (plus de 20 Mo)", " (over 20 MB)"));
      if (fichiers.some((x) => x.name === f.name && x.size === f.size)) return; // doublon
      if (fichiers.length >= MAX_FICHIERS) return refus.push(f.name + t(" (limite de ", " (limit of ") + MAX_FICHIERS + t(" atteinte)", " reached)"));
      fichiers.push(f);
    });
    erreur("fichiers", refus.length ? t("Ignoré : ", "Skipped: ") + refus.slice(0, 5).join(", ") + (refus.length > 5 ? "…" : "") : "");
    rendreFichiers();
  }

  function taille(o) { return o < 1024 * 1024 ? Math.max(1, Math.round(o / 1024)) + t(" Ko", " KB") : (o / 1024 / 1024).toFixed(1).replace(".", t(",", ".")) + t(" Mo", " MB"); }

  function rendreFichiers() {
    listeUl.innerHTML = "";
    fichiers.forEach((f, i) => {
      const li = document.createElement("li");
      const n = document.createElement("span"); n.className = "n"; n.textContent = f.name; n.title = f.name;
      const s = document.createElement("span"); s.className = "s"; s.textContent = taille(f.size);
      const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.textContent = "×";
      x.setAttribute("aria-label", t("Retirer ", "Remove ") + f.name);
      x.addEventListener("click", () => { fichiers.splice(i, 1); rendreFichiers(); });
      li.append(n, s, x); listeUl.appendChild(li);
    });
    const total = fichiers.reduce((a, f) => a + f.size, 0);
    compteur.innerHTML = fichiers.length
      ? fichiers.length + t(" fichier", " file") + (fichiers.length > 1 ? "s" : "") + " <span class='muted'>· " + taille(total) + "</span>"
      : t("<span class='muted'>Aucun fichier pour l'instant.</span>", "<span class='muted'>No files yet.</span>");
  }
  rendreFichiers();

  inputFichiers.addEventListener("change", (e) => { ajouterFichiers(e.target.files); e.target.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) ajouterFichiers(e.dataTransfer.files); });

  /* ---------- Récapitulatif ---------- */
  /* b93 — filière arbitre FFBB (Ligue Grand Est 2026-2027) : chaque grade donne un plafond ; CF coché d'office quand le grade ou le parcours y mène. */
  const PLAFONDS = EN ? { club: "Your club's games (no official appointment).", dep3: "Up to DM4, DM3, DF2 + youth.", dep2: "Up to DM2, DF1 + youth.", dep1: "Up to PRM + youth.",
    ear: "Regional youth + RF2 (RM2 mainly on exam day).", reg_j: "Regional youth championships.", reg3: "R3 of your regional league (does not exist in Grand Est).", reg2: "R2 men's and women's.", reg1: "PNM, PNF.",
    fed_bleu: "NF3, U18, U15 France (NM3 as reserve or on exam day).", fed_rouge: "NM3, NF2, U18 France (1st referee).", nat_bleu: "Espoirs, NF1, U18 (NM2 as reserve or on exam day).", nat_rouge: "NM2, LF2, U18.",
    hn: "Betclic Élite, Pro B, LFB, NM1 (HNO appointments).", fiba: "FIBA competitions, European cups." } : { club: "Matchs de ton club (pas de désignation officielle).", dep3: "Jusqu'à DM4, DM3, DF2 + jeunes.", dep2: "Jusqu'à DM2, DF1 + jeunes.", dep1: "Jusqu'à PRM + jeunes.",
    ear: "Jeunes région + RF2 (RM2 surtout le jour d'examen).", reg_j: "Championnats jeunes région.", reg3: "R3 de ta ligue (n'existe pas dans le Grand Est).", reg2: "R2 masculin et féminin.", reg1: "PNM, PNF.",
    fed_bleu: "NF3, U18, U15 France (NM3 en réserviste ou le jour d'examen).", fed_rouge: "NM3, NF2, U18 France (1er arbitre).", nat_bleu: "Espoirs, NF1, U18 (NM2 en réserviste ou le jour d'examen).", nat_rouge: "NM2, LF2, U18.",
    hn: "Betclic Élite, Pro B, LFB, NM1 (désignations HNO).", fiba: "Compétitions FIBA, coupes d'Europe." };
  const PARCOURS = EN ? { potentiel_dep: "Weekend training, appointments unchanged.", jpr_bleu: "2nd referee U15 France on Sunday + Regional shadowing on Saturday.", jpr_rouge: "2nd referee NF3, U18 and U15 France on Sunday + PN shadowing on Saturday." } : { potentiel_dep: "Formations le week-end, désignations inchangées.", jpr_bleu: "2e arbitre U15 France le dimanche + doublage Région le samedi.", jpr_rouge: "2e arbitre NF3, U18 et U15 France le dimanche + doublage PN le samedi." };
  const CF_AUTO = /^(fed_|nat_|hn|fiba)/;
  // b93b — parcours affiché seulement quand il existe : groupe potentiel pour le départemental, JPR pour la région.
  const OPT_PARCOURS = { dep: [["", t("Choisir…", "Choose…")], ["aucun", t("Aucun", "None")], ["potentiel_dep", t("Groupe potentiel départemental", "County potential group")]], reg: [["", t("Choisir…", "Choose…")], ["aucun", t("Aucun", "None")], ["jpr_bleu", t("JPR Bleu", "JPR Blue")], ["jpr_rouge", t("JPR Rouge", "JPR Red")]] };
  let familleParcours = "";
  function majNiveau(e) {
    const n = val("niveau"), sel = $("#parcours"), box = $("#f-parcours"), pl = $("#niveau-plafond"), pp = $("#parcours-plafond");
    const fam = /^dep/.test(n) ? "dep" : /^reg/.test(n) ? "reg" : "";
    if (fam !== familleParcours) {
      familleParcours = fam; box.hidden = !fam;
      sel.innerHTML = fam ? OPT_PARCOURS[fam].map(([v, t]) => '<option value="' + v + '">' + t + "</option>").join("") : "";
      $("#parcours-label").textContent = fam === "reg" ? t("Es-tu Jeune Potentiel Régional (JPR) ?", "Are you a Regional Young Potential (JPR)?") : t("Fais-tu partie du groupe potentiel départemental ?", "Are you in the county potential group?");
    }
    if (pl) pl.textContent = PLAFONDS[n] ? t("Plafond : ", "Highest level: ") + PLAFONDS[n] + t(" Toujours désignable en dessous.", " You can still be appointed below it.") : "";
    if (pp) pp.textContent = PARCOURS[val("parcours")] || "";
  }
  ["niveau", "parcours"].forEach((id) => { const e = $("#" + id); if (e) e.addEventListener("change", majNiveau); });
  const enCF = () => CF_AUTO.test(val("niveau")) || /^jpr_/.test(val("parcours"));
  /* b94 — adresse de départ proposée et vérifiée par la Base Adresse Nationale (API Géoplateforme de l'IGN, service public,
     gratuit, sans clé). Seul le texte tapé dans ce champ est envoyé, rien d'autre. Si le service ne répond pas, la saisie libre reste possible. */
  const ADR = { service: true, proposee: false, choisie: null, t: null, items: [], i: -1 };
  (function () {
    const inp = $("#adresse"), liste = $("#adr-liste"), etat = $("#adr-etat"); if (!inp || !liste) return;
    const fermer = () => { liste.hidden = true; inp.setAttribute("aria-expanded", "false"); ADR.i = -1; };
    const choisir = (it) => {
      ADR.choisie = it; inp.value = it.adresse; $("#code_postal").value = it.cp; $("#ville").value = it.ville;
      ["adresse", "code_postal", "ville"].forEach((id) => erreur(id, "")); etat.textContent = t("✓ Adresse vérifiée : ", "✓ Address verified: ") + it.label; fermer();
    };
    const afficher = () => {
      liste.innerHTML = ADR.items.map((it, k) => '<li role="option" id="adr-o' + k + '" data-k="' + k + '"' + (k === ADR.i ? ' aria-selected="true"' : "") + "><b>" + it.adresse.replace(/[<>&]/g, "") + "</b><span>" + (it.cp + " " + it.ville).replace(/[<>&]/g, "") + "</span></li>").join("");
      liste.hidden = !ADR.items.length; inp.setAttribute("aria-expanded", String(!!ADR.items.length));
    };
    const chercher = async (q) => {
      try {
        const r = await fetch("https://data.geopf.fr/geocodage/search?index=address&autocomplete=1&limit=6&q=" + encodeURIComponent(q), { cache: "no-store" });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json(); ADR.service = true;
        if (val("adresse") !== q) return;   // l'utilisateur a continué de taper
        ADR.items = (j.features || []).map((f) => { const p = f.properties || {}, c = (f.geometry || {}).coordinates || [];
          return { label: p.label, adresse: p.type === "municipality" ? "" : (p.name || p.label), cp: p.postcode || "", ville: p.city || "", lat: c[1], lon: c[0] }; }).filter((x) => x.cp && x.ville);
        ADR.i = -1; if (ADR.items.length) ADR.proposee = true; afficher();
        etat.textContent = ADR.items.length ? t("Clique sur ton adresse dans la liste.", "Click your address in the list.") : t("Aucune adresse trouvée : vérifie le numéro et la rue, puis ajoute la ville.", "No address found: check the number and street, then add the town.");
      } catch (e) { ADR.service = false; ADR.items = []; fermer(); etat.textContent = t("Vérification d'adresse indisponible : saisis ton adresse, ton code postal et ta ville.", "Address check unavailable: type your address, postcode and town."); }
    };
    inp.addEventListener("input", () => {
      ADR.choisie = null; clearTimeout(ADR.t); const q = val("adresse");
      if (q.length < 4) { ADR.items = []; fermer(); etat.textContent = ""; return; }
      ADR.t = setTimeout(() => chercher(q), 250);
    });
    inp.addEventListener("keydown", (e) => {
      if (liste.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); ADR.i = (ADR.i + (e.key === "ArrowDown" ? 1 : -1) + ADR.items.length) % ADR.items.length; afficher(); inp.setAttribute("aria-activedescendant", "adr-o" + ADR.i); }
      else if (e.key === "Enter" && ADR.i >= 0) { e.preventDefault(); choisir(ADR.items[ADR.i]); }
      else if (e.key === "Escape") fermer();
    });

    // b95 — la liste est dans le flux de la page (elle pousse le reste vers le bas) : rien ne passe devant ou derrière
    liste.addEventListener("click", (e) => { const li = e.target.closest("[data-k]"); if (li) choisir(ADR.items[Number(li.dataset.k)]); });
    ["code_postal", "ville"].forEach((id) => { const el = $("#" + id); if (el) el.addEventListener("input", () => { if (ADR.choisie) { ADR.choisie = null; etat.textContent = t("Code postal ou ville modifié : choisis à nouveau ton adresse dans la liste.", "Postcode or town changed: pick your address from the list again."); } }); });
  })();
  function libelle(id) { const s = $("#" + id); return s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : ""; }
  function remplirRecap() {
    const lignes = [
      [t("Prénom", "First name"), val("prenom")],
      [t("Nom officiel", "Official name"), val("nom_ffbb")],
      [t("E-mail de connexion", "Login e-mail"), val("email_connexion")],
      [t("E-mail convocations", "Appointments e-mail"), val("email_ffbb") + " (" + libelle("fournisseur_mail") + ")"],
      [t("Niveau", "Level"), libelle("niveau") + (/^(potentiel|jpr)/.test(val("parcours")) ? " · " + libelle("parcours") : "")],
      [t("Comité", "Committee"), val("cd") === "AUTRE" && val("cd_autre") ? val("cd_autre") : libelle("cd")],
      [t("Ligue", "Regional league"), libelle("ligue")],
      [t("Championnat de France", "National championships"), enCF() ? t("Oui (d'après ton niveau)", "Yes (based on your level)") : t("Non", "No")],
      [t("Départ", "Starting point"), val("adresse") + ", " + val("code_postal") + " " + val("ville")],
      [t("Convocations passées", "Past appointments"), fichiers.length ? fichiers.length + " PDF" : t("aucune", "none")],
    ];
    const dl = $("#recap"); dl.innerHTML = "";
    lignes.forEach(([k, v]) => {
      const d = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = k; dd.textContent = v; d.append(dt, dd); dl.appendChild(d);
    });
  }

  /* ---------- Envoi ---------- */
  const btnEnvoyer = $("#btn-envoyer"), alerte = $("#alert-global");
  const upWrap = $("#upload-progress"), upBar = $("#upload-bar"), upText = $("#upload-text");

  function montrerAlerte(msg) { alerte.textContent = msg; alerte.hidden = !msg; }

  function payload() {
    return {
      prenom: val("prenom"),
      nom_ffbb: val("nom_ffbb").toUpperCase(),
      email_connexion: val("email_connexion").toLowerCase(),
      telephone: val("telephone"),
      numero_licence: val("numero_licence"),
      emarque_v2: val("emarque_v2").replace(/\s+/g, "").toUpperCase(),   // b103 — facultatif, rangé à part côté serveur
      email_ffbb: val("email_ffbb").toLowerCase(),
      fournisseur_mail: val("fournisseur_mail"),
      niveau: val("niveau"),
      parcours: val("parcours") === "aucun" ? "" : val("parcours"),
      zones: { cd: val("cd"), cd_autre: val("cd") === "AUTRE" ? val("cd_autre") : "", ligue: val("ligue"), cf: enCF() },
      adresse: { adresse: val("adresse"), code_postal: val("code_postal"), ville: val("ville"), lat: ADR.choisie ? ADR.choisie.lat : null, lon: ADR.choisie ? ADR.choisie.lon : null, verifiee: !!ADR.choisie },
      vehicule: { modele: val("vehicule_modele"), conso: val("vehicule_conso") ? Number(val("vehicule_conso")) : null, cv: val("vehicule_cv") ? Number(val("vehicule_cv")) : null },
      consentements: { cgu: $("#consent_cgu").checked, donnees: $("#consent_donnees").checked, age15: $("#consent_age").checked },
      communications: (() => { const refus = !!($("#comm_refus") && $("#comm_refus").checked); return { offres: !refus, whatsapp: !refus }; })(),   // b78d : droit d'opposition proposé à la collecte (art. L34-5 CPCE, services analogues)
      fichiers: fichiers.map((f) => ({ nom: f.name, taille: f.size })),
      origine: location.hostname,
    };
  }

  async function appelFonction(corps) {
    const r = await fetch(FN_INSCRIPTION, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify(corps),
    });
    let data = null;
    try { data = await r.json(); } catch (_) { /* réponse vide */ }
    if (!r.ok || !data || data.ok === false) {
      const code = (data && data.error) || ("HTTP_" + r.status);
      throw new Error(code);
    }
    return data;
  }

  // PUT du fichier sur l'URL signée Supabase Storage, avec progression (XHR)
  function envoyerFichier(fichier, up, onProgress) {
    return new Promise((resolve, reject) => {
      const url = up.url || (SUPABASE_URL + "/storage/v1/object/upload/sign/" + up.chemin + "?token=" + encodeURIComponent(up.token));
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      xhr.setRequestHeader("apikey", SUPABASE_KEY);
      xhr.setRequestHeader("Content-Type", "application/pdf");
      xhr.setRequestHeader("x-upsert", "true");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error("HTTP_" + xhr.status));
      xhr.onerror = () => reject(new Error("RESEAU"));
      xhr.timeout = 120000; xhr.ontimeout = () => reject(new Error("TIMEOUT"));
      xhr.send(fichier);
    });
  }

  async function envoyerTousLesFichiers(uploads, cibles) {
    // cibles : File[] à envoyer (tous, ou seulement ceux en échec)
    const total = cibles.reduce((a, f) => a + f.size, 0) || 1;
    let fait = 0, echecs = [];
    upWrap.hidden = false; upBar.style.width = "0%";
    for (let i = 0; i < cibles.length; i++) {
      const f = cibles[i];
      const up = uploads.find((u) => u.nom === f.name);
      upText.textContent = t("Envoi des convocations… ", "Uploading appointments… ") + (i + 1) + " / " + cibles.length;
      if (!up) { echecs.push(f); continue; }
      let base = fait;
      try {
        await envoyerFichier(f, up, (loaded) => { upBar.style.width = Math.round((base + loaded) / total * 100) + "%"; });
      } catch (_) { echecs.push(f); }
      fait += f.size;
      upBar.style.width = Math.round(fait / total * 100) + "%";
    }
    upText.textContent = echecs.length ? echecs.length + t(" fichier(s) en échec.", " file(s) failed.") : t("Fichiers envoyés.", "Files uploaded.");
    return echecs;
  }

  function afficherEchecs(echecs) {
    const bloc = $("#done-fail"), ul = $("#done-fail-list");
    ul.innerHTML = "";
    echecs.forEach((f) => { const li = document.createElement("li"); li.textContent = f.name; ul.appendChild(li); });
    bloc.hidden = echecs.length === 0;
    $("#btn-retry").dataset.restants = String(echecs.length);
  }

  let echecsCourants = [];

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!valider(4)) return;
    montrerAlerte("");
    btnEnvoyer.disabled = true;
    const texteBouton = btnEnvoyer.textContent;
    btnEnvoyer.innerHTML = '<span class="spinner" aria-hidden="true"></span> ' + t("Envoi…", "Sending…");
    try {
      const rep = await appelFonction(payload());
      dernierEnvoi = { inscription_id: rep.inscription_id, jeton: rep.jeton || "", uploads: rep.uploads || [] };
      // b70 — places limitées : réponse « attente » → message liste d'attente, pas d'upload.
      if (rep.attente) {
        $("#h-5").textContent = t("Demande bien reçue", "Request received");
        $("#h-5").nextElementSibling.innerHTML = t("Les accès sont ouverts progressivement. <strong>On te prévient par e-mail</strong> dès que ton accès est prêt : rien à refaire de ton côté.", "Access is opened gradually. <strong>We'll let you know by e-mail</strong> as soon as your access is ready: nothing else to do on your side.");
        $("#done-mail").textContent = t("Confirmation envoyée à ", "Confirmation sent to ") + val("email_connexion") + ".";
        afficher(5);
        return;
      }
      $("#done-mail").textContent = t("E-mail de confirmation envoyé à ", "Confirmation e-mail sent to ") + val("email_connexion") + ".";
      if (fichiers.length && dernierEnvoi.uploads.length) {
        echecsCourants = await envoyerTousLesFichiers(dernierEnvoi.uploads, fichiers);
        if (echecsCourants.length === 0) { try { await appelFonction({ action: "fichiers_ok", inscription_id: dernierEnvoi.inscription_id, jeton: dernierEnvoi.jeton }); } catch (_) { /* non bloquant */ } }
      } else { echecsCourants = []; }
      afficher(5);
      afficherEchecs(echecsCourants);
    } catch (err) {
      const code = String(err && err.message || "");
      const msgs = {
        TROP_TOT: t("Une demande a déjà été envoyée récemment (même e-mail ou même connexion). Si tu n'as rien reçu, écris-nous à contact@referee-tracker.fr.", "A request was already sent recently (same e-mail or same connection). If you haven't received anything, write to us at contact@referee-tracker.fr."),
        VALIDATION: t("Certaines informations sont invalides. Vérifie les étapes précédentes.", "Some information is invalid. Check the previous steps."),
        TROP_DE_FICHIERS: t("Trop de fichiers : 300 maximum.", "Too many files: 300 maximum."),
      };
      montrerAlerte(msgs[code] || t("L'envoi a échoué. Vérifie ta connexion et réessaie ; si le problème persiste, écris à contact@referee-tracker.fr.", "Sending failed. Check your connection and try again; if the problem persists, write to contact@referee-tracker.fr."));
      upWrap.hidden = true;
    } finally {
      btnEnvoyer.disabled = false; btnEnvoyer.textContent = texteBouton;
    }
  });

  $("#btn-retry").addEventListener("click", async (e) => {
    if (!dernierEnvoi || !echecsCourants.length) return;
    const b = e.currentTarget; b.disabled = true;
    // La barre de progression vit dans le panneau 4 : on la réaffiche temporairement dans l'écran final.
    $("[data-panel='5']").insertBefore(upWrap, $("#done-fail"));
    echecsCourants = await envoyerTousLesFichiers(dernierEnvoi.uploads, echecsCourants);
    afficherEchecs(echecsCourants);
    if (!echecsCourants.length) { try { await appelFonction({ action: "fichiers_ok", inscription_id: dernierEnvoi.inscription_id, jeton: dernierEnvoi.jeton }); } catch (_) { /* non bloquant */ } }
    b.disabled = false;
  });

  // Empêcher la perte du formulaire par un rechargement accidentel
  window.addEventListener("beforeunload", (e) => {
    if (etape > 1 && etape < 5) { e.preventDefault(); e.returnValue = ""; }
  });
})();
