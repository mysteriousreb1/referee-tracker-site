/* Referee Tracker — formulaire d'inscription (vanilla JS, aucun framework). */
(function () {
  "use strict";

  const SUPABASE_URL = "https://jlstedchnmdteazuqbly.supabase.co";
  const SUPABASE_KEY = "sb_publishable_B1w244FrkzbIn-SZ-T_z8w_4HVg9stb"; // clé publique (publishable) : pas un secret
  const FN_INSCRIPTION = SUPABASE_URL + "/functions/v1/inscription";
  const MAX_FICHIER = 20 * 1024 * 1024;
  const MAX_FICHIERS = 300;

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
    progressBar.setAttribute("aria-label", "Étape " + Math.min(n, 4) + " sur 4");
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
      test("prenom", val("prenom").length >= 2, "Indique ton prénom.");
      const nom = val("nom_ffbb");
      test("nom_ffbb", nom.split(/\s+/).filter(Boolean).length >= 2, "Indique ton NOM puis ton prénom, comme sur les convocations (ex. MARTIN JULIE).");
      test("email_connexion", RE_EMAIL.test(val("email_connexion")), "Adresse e-mail invalide.");
      const tel = val("telephone").replace(/[.\-]/g, "");
      test("telephone", !tel || RE_TEL.test(tel), "Numéro de téléphone invalide (ex. 06 12 34 56 78).");
    }
    if (n === 2) {
      test("email_ffbb", RE_EMAIL.test(val("email_ffbb")), "Adresse e-mail invalide.");
      test("fournisseur_mail", !!val("fournisseur_mail"), "Choisis le fournisseur de ta messagerie.");
      test("niveau", !!val("niveau"), "Choisis ton niveau.");
      test("cd", !!val("cd"), "Choisis ton comité départemental.");
      test("ligue", !!val("ligue"), "Choisis ta ligue.");
    }
    if (n === 3) {
      test("adresse", val("adresse").length >= 3, "Indique ton adresse de départ.");
      test("code_postal", /^\d{5}$/.test(val("code_postal")), "Code postal à 5 chiffres.");
      test("ville", val("ville").length >= 2, "Indique ta ville.");
      const conso = val("vehicule_conso"), cv = val("vehicule_cv");
      test("vehicule_conso", !conso || (Number(conso) >= 1 && Number(conso) <= 30), "Consommation entre 1 et 30 L/100.");
      test("vehicule_cv", !cv || (Number.isInteger(Number(cv)) && Number(cv) >= 1 && Number(cv) <= 30), "CV fiscaux entre 1 et 30.");
      test("fichiers", fichiers.length <= MAX_FICHIERS, "Maximum " + MAX_FICHIERS + " fichiers.");
    }
    if (n === 4) {
      test("consent_cgu", $("#consent_cgu").checked, "Tu dois accepter les conditions pour continuer.");
      test("consent_donnees", $("#consent_donnees").checked, "Ce consentement est nécessaire pour traiter tes convocations.");
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
  $("#cd").addEventListener("change", (e) => { $("#f-cd-autre").hidden = e.target.value !== "AUTRE"; });
  // Pré-remplir l'e-mail convocations avec l'e-mail de connexion
  $("#email_connexion").addEventListener("blur", (e) => { const f = $("#email_ffbb"); if (!f.value) f.value = e.target.value.trim(); });

  /* ---------- Fichiers ---------- */
  const drop = $("#drop"), inputFichiers = $("#fichiers"), listeUl = $("#files"), compteur = $("#files-count");

  function ajouterFichiers(liste) {
    const refus = [];
    Array.from(liste).forEach((f) => {
      const estPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (!estPdf) return refus.push(f.name + " (pas un PDF)");
      if (f.size > MAX_FICHIER) return refus.push(f.name + " (plus de 20 Mo)");
      if (fichiers.some((x) => x.name === f.name && x.size === f.size)) return; // doublon
      if (fichiers.length >= MAX_FICHIERS) return refus.push(f.name + " (limite de " + MAX_FICHIERS + " atteinte)");
      fichiers.push(f);
    });
    erreur("fichiers", refus.length ? "Ignoré : " + refus.slice(0, 5).join(", ") + (refus.length > 5 ? "…" : "") : "");
    rendreFichiers();
  }

  function taille(o) { return o < 1024 * 1024 ? Math.max(1, Math.round(o / 1024)) + " Ko" : (o / 1024 / 1024).toFixed(1).replace(".", ",") + " Mo"; }

  function rendreFichiers() {
    listeUl.innerHTML = "";
    fichiers.forEach((f, i) => {
      const li = document.createElement("li");
      const n = document.createElement("span"); n.className = "n"; n.textContent = f.name; n.title = f.name;
      const s = document.createElement("span"); s.className = "s"; s.textContent = taille(f.size);
      const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.textContent = "×";
      x.setAttribute("aria-label", "Retirer " + f.name);
      x.addEventListener("click", () => { fichiers.splice(i, 1); rendreFichiers(); });
      li.append(n, s, x); listeUl.appendChild(li);
    });
    const total = fichiers.reduce((a, f) => a + f.size, 0);
    compteur.innerHTML = fichiers.length
      ? fichiers.length + " fichier" + (fichiers.length > 1 ? "s" : "") + " <span class='muted'>· " + taille(total) + "</span>"
      : "<span class='muted'>Aucun fichier pour l'instant.</span>";
  }
  rendreFichiers();

  inputFichiers.addEventListener("change", (e) => { ajouterFichiers(e.target.files); e.target.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) ajouterFichiers(e.dataTransfer.files); });

  /* ---------- Récapitulatif ---------- */
  function libelle(id) { const s = $("#" + id); return s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : ""; }
  function remplirRecap() {
    const lignes = [
      ["Prénom", val("prenom")],
      ["Nom officiel", val("nom_ffbb")],
      ["E-mail de connexion", val("email_connexion")],
      ["E-mail convocations", val("email_ffbb") + " (" + libelle("fournisseur_mail") + ")"],
      ["Niveau", libelle("niveau")],
      ["Comité", val("cd") === "AUTRE" && val("cd_autre") ? val("cd_autre") : libelle("cd")],
      ["Ligue", libelle("ligue")],
      ["Championnat de France", $("#cf").checked ? "Oui" : "Non"],
      ["Départ", val("adresse") + ", " + val("code_postal") + " " + val("ville")],
      ["Convocations passées", fichiers.length ? fichiers.length + " PDF" : "aucune"],
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
      email_ffbb: val("email_ffbb").toLowerCase(),
      fournisseur_mail: val("fournisseur_mail"),
      niveau: val("niveau"),
      zones: { cd: val("cd"), cd_autre: val("cd") === "AUTRE" ? val("cd_autre") : "", ligue: val("ligue"), cf: $("#cf").checked },
      adresse: { adresse: val("adresse"), code_postal: val("code_postal"), ville: val("ville") },
      vehicule: { modele: val("vehicule_modele"), conso: val("vehicule_conso") ? Number(val("vehicule_conso")) : null, cv: val("vehicule_cv") ? Number(val("vehicule_cv")) : null },
      consentements: { cgu: $("#consent_cgu").checked, donnees: $("#consent_donnees").checked },
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
      upText.textContent = "Envoi des convocations… " + (i + 1) + " / " + cibles.length;
      if (!up) { echecs.push(f); continue; }
      let base = fait;
      try {
        await envoyerFichier(f, up, (loaded) => { upBar.style.width = Math.round((base + loaded) / total * 100) + "%"; });
      } catch (_) { echecs.push(f); }
      fait += f.size;
      upBar.style.width = Math.round(fait / total * 100) + "%";
    }
    upText.textContent = echecs.length ? echecs.length + " fichier(s) en échec." : "Fichiers envoyés.";
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
    btnEnvoyer.innerHTML = '<span class="spinner" aria-hidden="true"></span> Envoi…';
    try {
      const rep = await appelFonction(payload());
      dernierEnvoi = { inscription_id: rep.inscription_id, jeton: rep.jeton || "", uploads: rep.uploads || [] };
      // b70 — places limitées : réponse « attente » → message liste d'attente, pas d'upload.
      if (rep.attente) {
        $("#h-5").textContent = "Tu es sur la liste d'attente";
        $("#h-5").nextElementSibling.innerHTML = "Toutes les places de cette première vague sont prises. <strong>On te prévient par e-mail</strong> dès qu'une place se libère : rien à refaire de ton côté.";
        $("#done-mail").textContent = "Confirmation envoyée à " + val("email_connexion") + ".";
        afficher(5);
        return;
      }
      $("#done-mail").textContent = "E-mail de confirmation envoyé à " + val("email_connexion") + ".";
      if (fichiers.length && dernierEnvoi.uploads.length) {
        echecsCourants = await envoyerTousLesFichiers(dernierEnvoi.uploads, fichiers);
        if (echecsCourants.length === 0) { try { await appelFonction({ action: "fichiers_ok", inscription_id: dernierEnvoi.inscription_id, jeton: dernierEnvoi.jeton }); } catch (_) { /* non bloquant */ } }
      } else { echecsCourants = []; }
      afficher(5);
      afficherEchecs(echecsCourants);
    } catch (err) {
      const code = String(err && err.message || "");
      const msgs = {
        TROP_TOT: "Une demande a déjà été envoyée récemment (même e-mail ou même connexion). Si tu n'as rien reçu, écris-nous à contact@referee-tracker.fr.",
        VALIDATION: "Certaines informations sont invalides. Vérifie les étapes précédentes.",
        TROP_DE_FICHIERS: "Trop de fichiers : 300 maximum.",
      };
      montrerAlerte(msgs[code] || "L'envoi a échoué. Vérifie ta connexion et réessaie ; si le problème persiste, écris à contact@referee-tracker.fr.");
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
