(function () {
  "use strict";

  // ---- theme ----
  var root = document.documentElement;
  var themeBtn = document.getElementById("themeBtn");
  var themeLabel = document.getElementById("themeLabel");
  function getStored() { try { return localStorage.getItem("mg-theme"); } catch (e) { return null; } }
  function setStored(v) { try { localStorage.setItem("mg-theme", v); } catch (e) {} }
  function systemTheme() {
    return window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function currentTheme() {
    return root.getAttribute("data-theme") || systemTheme();
  }
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    if (themeLabel) themeLabel.textContent = t;
  }
  applyTheme(getStored() || systemTheme());
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      setStored(next);
    });
  }

  // ---- copy email ----
  var copyBtn = document.getElementById("copyBtn");
  var copyLabel = document.getElementById("copyLabel");
  function copyEmail() {
    var email = "mginzbur1@stevens.edu";
    function done(ok) {
      if (!copyLabel) return;
      copyLabel.textContent = ok ? "copied" : "copy";
      if (ok) setTimeout(function () { copyLabel.textContent = "copy"; }, 1800);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(function () { done(true); }).catch(function () { done(false); });
      } else { done(false); }
    } catch (e) { done(false); }
  }
  if (copyBtn) copyBtn.addEventListener("click", copyEmail);

  // ---- nodes, rail, connectors ----
  var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-node]"));
  var rail = document.getElementById("rail");
  var wrap = document.getElementById("wrap");
  var svg = document.getElementById("connectors");
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  nodes.forEach(function () {
    var d = document.createElement("div");
    d.className = "dot";
    rail.appendChild(d);
  });
  var dots = Array.prototype.slice.call(rail.children);

  function zigzagPath(x1, y1, x2, y2) {
    var segments = 6;
    var dx = x2 - x1, dy = y2 - y1;
    var jitter = Math.max(16, Math.min(42, Math.abs(dy) * 0.14 + 14));
    var pts = [[x1, y1]];
    for (var s = 1; s < segments; s++) {
      var t = s / segments;
      var baseX = x1 + dx * t;
      var baseY = y1 + dy * t;
      var sign = (s % 2 === 0) ? 1 : -1;
      var falloff = Math.sin(Math.PI * t);
      pts.push([baseX + sign * jitter * falloff, baseY]);
    }
    pts.push([x2, y2]);
    var d = "M " + pts[0][0] + " " + pts[0][1];
    for (var k = 1; k < pts.length; k++) d += " L " + pts[k][0] + " " + pts[k][1];
    return d;
  }

  var revealed = [];

  function drawConnectors() {
    if (!wrap || !svg) return;
    var wrapRect = wrap.getBoundingClientRect();
    svg.innerHTML = "";
    svg.setAttribute("height", wrap.scrollHeight);
    for (var i = 0; i < nodes.length - 1; i++) {
      var aCard = nodes[i].querySelector(".card") || nodes[i];
      var bCard = nodes[i + 1].querySelector(".card") || nodes[i + 1];
      var a = aCard.getBoundingClientRect();
      var b = bCard.getBoundingClientRect();
      var x1 = a.left - wrapRect.left + a.width / 2;
      var y1 = a.bottom - wrapRect.top;
      var x2 = b.left - wrapRect.left + b.width / 2;
      var y2 = b.top - wrapRect.top;
      var pathId = "conn-" + i;
      var d = zigzagPath(x1, y1, x2, y2);
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("id", pathId);
      path.dataset.index = i;
      if (revealed[i + 1]) path.classList.add("go", "settled");
      svg.appendChild(path);
      var c1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c1.setAttribute("cx", x1); c1.setAttribute("cy", y1); c1.setAttribute("r", 3);
      svg.appendChild(c1);
      var c2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c2.setAttribute("cx", x2); c2.setAttribute("cy", y2); c2.setAttribute("r", 3);
      c2.dataset.endFor = i + 1;
      svg.appendChild(c2);
      if (!reduceMotion) {
        var len = path.getTotalLength();
        var seg = Math.max(24, Math.min(70, len * 0.28));
        var current = document.createElementNS("http://www.w3.org/2000/svg", "path");
        current.setAttribute("d", d);
        current.setAttribute("class", "current-line");
        current.setAttribute("stroke-dasharray", seg.toFixed(1) + " " + len.toFixed(1));
        svg.appendChild(current);
        var anim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
        anim.setAttribute("attributeName", "stroke-dashoffset");
        anim.setAttribute("from", (seg + len).toFixed(1));
        anim.setAttribute("to", "0");
        anim.setAttribute("dur", (2.6 + (i % 3) * 0.5).toFixed(1) + "s");
        anim.setAttribute("repeatCount", "indefinite");
        anim.setAttribute("begin", (i * 0.4).toFixed(1) + "s");
        current.appendChild(anim);
      }
    }
    if (reduceMotion) {
      Array.prototype.forEach.call(svg.querySelectorAll("path"), function (p) { p.classList.add("go"); });
    }
  }
  var redrawTimer = null;
  function scheduleRedraw(delay) {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(function () { drawConnectors(); setActive(activeIndex); }, delay || 0);
  }
  drawConnectors();
  window.addEventListener("resize", function () { scheduleRedraw(80); });
  window.addEventListener("load", function () { scheduleRedraw(0); });

  var activeIndex = 0;
  function setActive(i) {
    activeIndex = i;
    dots.forEach(function (d, idx) { d.classList.toggle("active", idx === i); });
    Array.prototype.forEach.call(svg.querySelectorAll("circle"), function (c) {
      c.classList.toggle("active", c.dataset.endFor == i);
    });
  }
  setActive(0);

  if (!reduceMotion && "IntersectionObserver" in window) {
    var pathObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var idx = nodes.indexOf(e.target);
          if (revealed[idx]) return;
          revealed[idx] = true;
          if (idx > 0) {
            var p = svg.querySelector('path[data-index="' + (idx - 1) + '"]');
            if (p) p.classList.add("go");
          }
          var card = e.target.querySelector(".card");
          if (card) card.classList.add("in");
          // cards slide 14px while revealing; re-measure wires once they settle
          scheduleRedraw(600);
        }
      });
    }, { threshold: 0.15 });
    nodes.forEach(function (n) { pathObs.observe(n); });
  } else {
    nodes.forEach(function (n, idx) {
      revealed[idx] = true;
      var card = n.querySelector(".card");
      if (card) card.classList.add("in");
    });
  }

  var navObs = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) setActive(nodes.indexOf(e.target));
    });
  }, { threshold: 0.5 }) : null;
  if (navObs) nodes.forEach(function (n) { navObs.observe(n); });

  // ---- keyboard: J/K step, T theme, C copy ----
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === "j" || k === "k") {
      var next = k === "j" ? Math.min(activeIndex + 1, nodes.length - 1) : Math.max(activeIndex - 1, 0);
      nodes[next].scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      setActive(next);
    } else if (k === "t") {
      var nextTheme = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(nextTheme); setStored(nextTheme);
    } else if (k === "c") {
      copyEmail();
    }
    dismissHint();
  });

  // ---- first-visit keyboard hint ----
  var HINT_KEY = "mg-hint-seen";
  var hintEl = null;
  var hintTimer = null;
  function dismissHint() {
    if (!hintEl) return;
    hintEl.classList.remove("show");
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    try { localStorage.setItem(HINT_KEY, "1"); } catch (e) {}
  }
  function showHint() {
    // keyboard shortcuts mean nothing on a touch screen
    if (window.matchMedia && matchMedia("(hover: none)").matches) return;
    var seen = false;
    try { seen = !!localStorage.getItem(HINT_KEY); } catch (e) {}
    if (seen) return;
    hintEl = document.createElement("div");
    hintEl.className = "hint-toast";
    hintEl.setAttribute("role", "status");
    hintEl.innerHTML =
      'press <kbd>J</kbd><kbd>K</kbd> to step · <kbd>T</kbd> theme · <kbd>C</kbd> copy email' +
      '<button type="button" aria-label="Dismiss">×</button>';
    document.body.appendChild(hintEl);
    hintEl.querySelector("button").addEventListener("click", dismissHint);
    requestAnimationFrame(function () { hintEl.classList.add("show"); });
    hintTimer = setTimeout(dismissHint, 6000);
  }
  setTimeout(showHint, 1200);
})();
