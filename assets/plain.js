/* Plain page: fill sections from content.js and handle the theme switch. */
(function () {
  "use strict";
  var SITE = window.SITE || {};
  var PA = window.PA;

  document.title = (SITE.name || "Site") + " · Plain";

  document.querySelectorAll("[data-site]").forEach(function (el) {
    var v = SITE[el.getAttribute("data-site")];
    if (v != null) el.textContent = v;
  });

  document.querySelectorAll("[data-section]").forEach(function (sec) {
    var key = sec.getAttribute("data-section");
    var def = PA.sections[key];
    var title = sec.querySelector(".dlg-title");
    if (def && title) {
      title.textContent = def.title();
      if (def.label !== def.title()) {
        var sub = document.createElement("span");
        sub.className = "dlg-sub";
        sub.textContent = def.label;
        title.appendChild(sub);
      }
    }
    sec.querySelector(".body").innerHTML = PA.render(key);
  });

  /* theme */
  var root = document.documentElement;
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    try {
      if (t === "auto") localStorage.removeItem("pa-theme");
      else localStorage.setItem("pa-theme", t);
    } catch (e) {}
    document.querySelectorAll("[data-theme-pick]").forEach(function (b) {
      var on = b.getAttribute("data-theme-pick") === t;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  applyTheme(root.getAttribute("data-theme") || "auto");
  document.querySelectorAll("[data-theme-pick]").forEach(function (b) {
    b.addEventListener("click", function () {
      applyTheme(b.getAttribute("data-theme-pick"));
    });
  });
})();
