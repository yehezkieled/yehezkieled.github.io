/*
  Shared renderer: turns window.SITE (content.js) into HTML for one section.
  Used by the room page (dialog panels) and the plain page (full sections).
  No dependencies. Exposes window.PA.
*/
(function () {
  "use strict";

  var SITE = window.SITE || {};

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- pixel icons (12x12 grids; a/b/c = palette slots) ---------- */
  var ICONS = {
    pad: [
      "............",
      "............",
      "..aaaaaaaa..",
      ".aabbbbbbaa.",
      ".abcbbbbcba.",
      ".acccbbbbba.",
      ".abcbbbccba.",
      ".aabbbbbbaa.",
      "..aaa..aaa..",
      "............",
      "............",
      "............",
    ],
    coin: [
      "....aaaa....",
      "..aabbbbaa..",
      ".abbbbbbbba.",
      ".abbbbcbbba.",
      "abbbbcccbbba",
      "abbbcbbbbbba",
      "abbbbcccbbba",
      "abbbbbbbcbba",
      ".abbbcccbba.",
      ".abbbbcbbba.",
      "..aabbbbaa..",
      "....aaaa....",
    ],
    board: [
      "............",
      ".aaaaaaaaaa.",
      ".abbbbbbbba.",
      ".aaaaaaaaaa.",
      ".acccbacbba.",
      ".acccbacbba.",
      ".abbbbacbba.",
      ".acccbabbba.",
      ".acccbabbba.",
      ".abbbbabbba.",
      ".aaaaaaaaaa.",
      "............",
    ],
    hex: [
      "............",
      "....aaaa....",
      "...abbbba...",
      "..abbbbbba..",
      ".abbbccbbba.",
      ".abbccccbba.",
      ".abbccccbba.",
      ".abbbccbbba.",
      "..abbbbbba..",
      "...abbbba...",
      "....aaaa....",
      "............",
    ],
    boat: [
      "............",
      "......a.....",
      "......ab....",
      "......abb...",
      "......abbb..",
      "......abbbb.",
      "......abbbbb",
      "......a.....",
      ".aaaaaaaaaa.",
      "..acccccca..",
      "...aaaaaa...",
      "............",
    ],
    mail: [
      "............",
      "............",
      ".aaaaaaaaaa.",
      ".abbbbbbbba.",
      ".abcbbbbcba.",
      ".abbcbbcbba.",
      ".abbbccbbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".aaaaaaaaaa.",
      "............",
      "............",
    ],
    bars: [
      "............",
      "............",
      "..........c.",
      ".......c..c.",
      ".......c..c.",
      "....c..c..c.",
      "....c..c..c.",
      ".c..c..c..c.",
      ".c..c..c..c.",
      ".c..c..c..c.",
      "aaaaaaaaaaaa",
      "............",
    ],
    face: [
      "...aaaaaa...",
      "..aaaaaaaa..",
      ".aabbbbbbaa.",
      ".abbbbbbbba.",
      ".abbcbbcbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".abbbccbbba.",
      "..abbbbbba..",
      "...aaaaaa...",
      "..aaddddaa..",
      ".aaddddddaa.",
    ],
    badge: [
      "............",
      "....aaaa....",
      "..aabbbbaa..",
      ".abbbccbbba.",
      ".abbccccbba.",
      "abbccccccbba",
      ".abbccccbba.",
      ".abbbccbbba.",
      "..aabbbbaa..",
      "....aaaa....",
      "....a..a....",
      "...aa..aa...",
    ],
    link: [
      "............",
      "............",
      "..aaa.......",
      ".abbba......",
      ".abbbaaaa...",
      "..aaabbbba..",
      "....abbbba..",
      "....abbba...",
      "....aaaa....",
      "............",
      "............",
      "............",
    ],
    note: [
      "............",
      ".aaaaaaaa...",
      ".abbbbbbaa..",
      ".abbbbbbaba.",
      ".abbbbbbaaa.",
      ".abcccbbbba.",
      ".abbbbbbbba.",
      ".abcccccbba.",
      ".abbbbbbbba.",
      ".abccccbbba.",
      ".aaaaaaaaaa.",
      "............",
    ],
  };

  var PALETTES = {
    pad: { a: "currentColor", b: "#ececf4", c: "#ff6b57" },
    coin: { a: "#7a5a12", b: "#ffd24d", c: "#7a5a12" },
    board: { a: "currentColor", b: "#fff8ee", c: "#4fd1c5" },
    hex: { a: "#7a4a12", b: "#ffb347", c: "#fff2c7" },
    boat: { a: "currentColor", b: "#ff6b57", c: "#4fd1c5" },
    mail: { a: "currentColor", b: "#fff8ee", c: "#ff6b57" },
    bars: { a: "currentColor", b: "#4fd1c5", c: "#4fd1c5" },
    face: { a: "currentColor", b: "#ffcf9e", c: "#2b2640", d: "#ff6b57" },
    badge: { a: "currentColor", b: "#ffd24d", c: "#ff6b57" },
    link: { a: "currentColor", b: "#4fd1c5" },
    note: { a: "currentColor", b: "#fff8ee", c: "#4fd1c5" },
  };

  function icon(name, size) {
    var rows = ICONS[name] || ICONS.board;
    var pal = PALETTES[name] || PALETTES.board;
    var px = size || 48;
    var out =
      '<svg class="px-icon" width="' + px + '" height="' + px +
      '" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true" focusable="false">';
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y];
      var x = 0;
      while (x < row.length) {
        var ch = row[x];
        if (ch === ".") { x++; continue; }
        var start = x;
        while (x < row.length && row[x] === ch) x++;
        out += '<rect x="' + start + '" y="' + y + '" width="' + (x - start) +
          '" height="1" fill="' + (pal[ch] || "#000") + '"/>';
      }
    }
    return out + "</svg>";
  }

  /* ---------- section renderers ---------- */
  function tbd(flag) {
    return flag ? '<span class="pill pill-tbd" title="Placeholder, to be filled in">TBD</span>' : "";
  }

  function chips(list) {
    if (!list || !list.length) return "";
    return '<ul class="chips">' + list.map(function (t) {
      return "<li>" + esc(t) + "</li>";
    }).join("") + "</ul>";
  }

  function renderAbout() {
    var a = SITE.about || {};
    return (
      '<div class="profile">' +
        '<div class="profile-avatar">' + icon("face", 72) + "</div>" +
        '<div class="profile-body">' +
          '<p class="profile-name">' + esc(SITE.fullName || SITE.name) + " " + tbd(a.placeholder) + "</p>" +
          (a.location ? '<p class="profile-loc">' + esc(a.location) + "</p>" : "") +
          (a.paragraphs || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
          chips(a.tags) +
        "</div>" +
      "</div>"
    );
  }

  function renderSkills() {
    var sk = SITE.skills || {};
    return (
      '<dl class="skills">' +
      (sk.groups || []).map(function (g) {
        return "<dt>" + esc(g.label) + "</dt><dd>" + chips(g.items) + "</dd>";
      }).join("") +
      (sk.certs && sk.certs.length ? "<dt>Certs</dt><dd>" + chips(sk.certs) + "</dd>" : "") +
      "</dl>"
    );
  }

  function renderEducation() {
    var e = SITE.education || {};
    return (
      '<ul class="log">' +
      (e.items || []).map(function (it) {
        return (
          '<li class="log-row">' +
            '<div class="row-head"><strong>' + esc(it.school) + "</strong>" +
            '<span class="period">' + esc(it.period) + "</span></div>" +
            "<p>" + esc(it.degree) + "</p>" +
          "</li>"
        );
      }).join("") +
      "</ul>"
    );
  }

  function renderPublications() {
    var p = SITE.publications || {};
    return (
      '<ul class="log">' +
      (p.items || []).map(function (it) {
        var t = it.url ? '<a href="' + esc(it.url) + '">' + esc(it.title) + "</a>" : esc(it.title);
        return (
          '<li class="log-row">' +
            '<div class="row-head"><strong class="pub">' + t + "</strong>" +
            '<span class="period">' + esc(it.year) + "</span></div>" +
          "</li>"
        );
      }).join("") +
      "</ul>"
    );
  }

  /* The room's About panel carries skills, education and publications too. */
  function renderAboutFull() {
    function sub(key) {
      var d = SECTIONS[key];
      return '<h3 class="dlg-sub-title">' + esc(d.title()) + "</h3>" + d.render();
    }
    return renderAbout() + sub("skills") + sub("education") + sub("publications");
  }

  function renderWork() {
    var w = SITE.work || {};
    return (
      '<ol class="badges">' +
      (w.roles || []).map(function (r, i) {
        return (
          '<li class="badge-row">' +
            '<div class="badge-icon" data-n="' + (i + 1) + '">' + icon("badge", 40) + "</div>" +
            '<div class="badge-body">' +
              '<div class="row-head"><strong>' + esc(r.company) + "</strong>" +
              '<span class="period">' + esc(r.period) + "</span></div>" +
              '<div class="role">' + esc(r.role) + (r.place ? " · " + esc(r.place) : "") + " " + tbd(w.placeholder) + "</div>" +
              "<p>" + esc(r.summary) + "</p>" +
            "</div>" +
          "</li>"
        );
      }).join("") +
      "</ol>"
    );
  }

  function renderProjects() {
    var p = SITE.projects || {};
    return (
      '<ul class="roster">' +
      (p.items || []).map(function (it) {
        var link = it.repo
          ? '<a class="btn" href="' + esc(it.repo) + '" target="_blank" rel="noopener">View repo <span aria-hidden="true">↗</span></a>'
          : '<span class="pill pill-private" title="Source is private">Private build</span>';
        return (
          '<li class="card" id="project-' + esc(it.id) + '">' +
            '<div class="card-icon">' + icon(it.icon, 48) + "</div>" +
            '<div class="card-body">' +
              '<div class="row-head"><strong>' + esc(it.name) + "</strong>" +
              '<span class="pill">' + esc(it.status) + "</span></div>" +
              "<p>" + esc(it.blurb) + "</p>" +
              chips(it.tags) +
              '<div class="card-actions">' + link + "</div>" +
            "</div>" +
          "</li>"
        );
      }).join("") +
      "</ul>"
    );
  }

  function renderPosts() {
    var p = SITE.posts || {};
    return (
      '<ul class="log">' +
      (p.items || []).map(function (it) {
        var title = it.url
          ? '<a href="' + esc(it.url) + '">' + esc(it.title) + "</a>"
          : esc(it.title);
        return (
          '<li class="log-row">' +
            '<div class="row-head"><strong>' + title + "</strong> " + tbd(p.placeholder) +
            '<span class="period">' + esc(it.date) + "</span></div>" +
            "<p>" + esc(it.blurb) + "</p>" +
          "</li>"
        );
      }).join("") +
      "</ul>"
    );
  }

  function renderOnline() {
    var o = SITE.online || {};
    return (
      '<ul class="links">' +
      (o.links || []).map(function (l) {
        var body = l.url
          ? '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' <span aria-hidden="true">↗</span></a>'
          : "<span>" + esc(l.label) + " " + tbd(true) + "</span>";
        return '<li class="link-row">' + icon("link", 24) + body +
          '<span class="period">' + esc(l.note) + "</span></li>";
      }).join("") +
      "</ul>"
    );
  }

  var SECTIONS = {
    about: { label: "About", title: function () { return SITE.about.heading; }, render: renderAbout, full: renderAboutFull, hint: "the PC" },
    skills: { label: "Skills", title: function () { return SITE.skills.heading; }, render: renderSkills },
    education: { label: "Education", title: function () { return SITE.education.heading; }, render: renderEducation },
    publications: { label: "Publications", title: function () { return SITE.publications.heading; }, render: renderPublications },
    work: { label: "Work", title: function () { return SITE.work.heading; }, render: renderWork, hint: "the badge case" },
    projects: { label: "Projects", title: function () { return SITE.projects.heading; }, render: renderProjects, hint: "the TV and console" },
    posts: { label: "Posts", title: function () { return SITE.posts.heading; }, render: renderPosts, hint: "the red handheld" },
    online: { label: "Online", title: function () { return SITE.online.heading; }, render: renderOnline, hint: "the phone" },
  };
  var ORDER = ["about", "work", "projects", "posts", "online"];

  window.PA = {
    esc: esc,
    icon: icon,
    order: ORDER,
    sections: SECTIONS,
    render: function (key, full) {
      var s = SECTIONS[key];
      if (!s) return "";
      return full && s.full ? s.full() : s.render();
    },
  };
})();
