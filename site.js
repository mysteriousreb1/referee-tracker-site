/* Referee Tracker — site vitrine b76 : animations et démonstrations (vanilla JS, aucune dépendance, aucun traceur). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Barre du haut opaque après le héros */
  var top = $(".top");
  function majTop() { if (top) top.classList.toggle("solid", window.scrollY > 30); }
  window.addEventListener("scroll", majTop, { passive: true }); majTop();

  /* Apparition au défilement + compteurs */
  function compter(el) {
    var fin = parseFloat(el.dataset.to), dec = (el.dataset.dec | 0), suf = el.dataset.suf || "", t0 = null, d = 1600;
    function fmt(v) { return v.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
    if (calme) { el.firstChild.nodeValue = fmt(fin) + suf; return; }
    function pas(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3); el.firstChild.nodeValue = fmt(fin * e) + suf; if (p < 1) requestAnimationFrame(pas); }
    requestAnimationFrame(pas);
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("vu");
        $$("[data-to]", e.target).forEach(compter);
        if (e.target.matches("[data-to]")) compter(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.18 });
    $$(".rv, .compte").forEach(function (el) { io.observe(el); });
  } else { $$(".rv").forEach(function (el) { el.classList.add("vu"); }); }

  /* Mot qui s'écrit dans le titre */
  var typed = $(".typed");
  if (typed && !calme) {
    var mots = JSON.parse(typed.dataset.mots), i = 0, j = 0, efface = false;
    (function tape() {
      var m = mots[i];
      typed.textContent = m.slice(0, j);
      if (!efface && j < m.length) { j++; setTimeout(tape, 65); }
      else if (!efface) { efface = true; setTimeout(tape, 2100); }
      else if (j > 0) { j--; setTimeout(tape, 30); }
      else { efface = false; i = (i + 1) % mots.length; setTimeout(tape, 250); }
    })();
  }

  /* Carrousel d'écrans dans un téléphone */
  function carrousel(racine, duree, auChangement) {
    var imgs = $$("img", racine), n = imgs.length, k = 0, minuteur = null;
    if (!n) return null;
    function va(x) {
      imgs[k].classList.remove("on"); k = (x + n) % n; imgs[k].classList.add("on");
      if (imgs[k].dataset.src) { imgs[k].src = imgs[k].dataset.src; imgs[k].removeAttribute("data-src"); }
      if (auChangement) auChangement(k);
      relance();
    }
    function relance() { clearTimeout(minuteur); if (!calme) minuteur = setTimeout(function () { va(k + 1); }, duree); }
    relance();
    return { va: va, pos: function () { return k; } };
  }

  /* Héros : écrans + points + notifications */
  var heroEcran = $("#heroEcran"), pts = $$(".points button");
  if (heroEcran) {
    var c1 = carrousel(heroEcran, 3600, function (k) { pts.forEach(function (b, x) { b.classList.toggle("on", x === k); }); });
    pts.forEach(function (b, x) { b.addEventListener("click", function () { c1.va(x); }); });
  }
  var toasts = $$(".hero .toast"), tk = 0;
  if (toasts.length) {
    if (calme) toasts.forEach(function (t) { t.classList.add("on"); });
    else setInterval(function () { toasts.forEach(function (t, x) { t.classList.toggle("on", x === tk || x === (tk + 1) % toasts.length); }); tk = (tk + 1) % toasts.length; }, 2600);
    if (!calme) setTimeout(function () { toasts[0].classList.add("on"); }, 900);
  }

  /* Visite guidée : onglets synchronisés avec le téléphone */
  var visEcran = $("#visiteEcran"), onglets = $$(".onglet");
  if (visEcran && onglets.length) {
    onglets.forEach(function (o) { o.style.setProperty("--duree", "6s"); });
    var c2 = carrousel(visEcran, 6000, function (k) {
      onglets.forEach(function (o, x) { o.classList.toggle("on", x === k); o.setAttribute("aria-selected", x === k ? "true" : "false"); var b = $(".barre", o); if (b) { b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; } });
    });
    onglets.forEach(function (o, x) { o.addEventListener("click", function () { c2.va(x); }); });
  }

  /* Ordinateur */
  var pcCadre = $("#pcCadre"), pcTabs = $$(".pc-tabs button");
  if (pcCadre) {
    var c3 = carrousel(pcCadre, 5000, function (k) { pcTabs.forEach(function (b, x) { b.classList.toggle("on", x === k); }); });
    pcTabs.forEach(function (b, x) { b.addEventListener("click", function () { c3.va(x); }); });
  }

  /* Halo qui suit la souris sur les cartes */
  $$(".carte").forEach(function (c) {
    c.addEventListener("pointermove", function (e) { var r = c.getBoundingClientRect(); c.style.setProperty("--x", (e.clientX - r.left) + "px"); c.style.setProperty("--y", (e.clientY - r.top) + "px"); });
  });

  /* Calculateur d'indemnité */
  var form = $("#calc");
  if (form) {
    var eur = function (v) { return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; };
    var affiche = {};
    function anime(el, v) {
      var de = affiche[el.id] || 0; affiche[el.id] = v;
      if (calme) { el.textContent = eur(v); return; }
      var t0 = null; (function pas(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 380); el.textContent = eur(de + (v - de) * p); if (p < 1) requestAnimationFrame(pas); })(performance.now());
    }
    function calc() {
      var fixe = +form.fixe.value, km = +form.km.value, taux = +form.taux.value / 100, conso = +form.conso.value / 10, prix = +form.prix.value / 100;
      $("#oFixe").value = eur(fixe); $("#oKm").value = km + " km"; $("#oTaux").value = taux.toFixed(2).replace(".", ",") + " €/km";
      $("#oConso").value = conso.toFixed(1).replace(".", ",") + " L/100"; $("#oPrix").value = prix.toFixed(2).replace(".", ",") + " €/L";
      var ar = km * 2, ind = fixe + ar * taux, carb = ar * conso / 100 * prix;
      anime($("#rInd"), ind); anime($("#rKm"), ar * taux); anime($("#rCarb"), carb); anime($("#rNet"), ind - carb);
      $("#rAr").textContent = ar + " km aller-retour";
    }
    form.addEventListener("input", calc); calc();
  }

  /* Année du pied de page */
  var an = $("#annee"); if (an) an.textContent = new Date().getFullYear();
})();
