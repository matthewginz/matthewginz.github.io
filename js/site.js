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

  // ---- off the clock: ski skyline <-> legend ----
  var ski = document.getElementById("ski");
  if (ski) initSki(ski);

  function initSki(tile) {
    var map = document.getElementById("skiMap");
    var readout = document.getElementById("skiReadout");
    var items = Array.prototype.slice.call(tile.querySelectorAll("li[data-peak]"));
    var tour = ["shawnee", "tremblant", "killington", "dolomites", "matterhorn"];
    var tourIdx = 0, tourTimer = null;

    function setPeak(name) {
      Array.prototype.forEach.call(tile.querySelectorAll("[data-peak]"), function (el) {
        el.classList.toggle("on", el.getAttribute("data-peak") === name);
      });
      map.classList.toggle("has-on", !!name);
      var li = tile.querySelector('li[data-peak="' + name + '"]');
      readout.textContent = li ? li.getAttribute("data-label") : "hover a mountain";
    }
    function startTour() {
      if (reduceMotion || tourTimer) return;
      tourTimer = setInterval(function () {
        tourIdx = (tourIdx + 1) % tour.length;
        setPeak(tour[tourIdx]);
      }, 2600);
    }
    function stopTour() { clearInterval(tourTimer); tourTimer = null; }

    Array.prototype.forEach.call(tile.querySelectorAll("[data-peak]"), function (el) {
      var name = el.getAttribute("data-peak");
      el.addEventListener("mouseenter", function () { stopTour(); setPeak(name); tourIdx = tour.indexOf(name); });
      el.addEventListener("focus", function () { stopTour(); setPeak(name); tourIdx = tour.indexOf(name); });
      el.addEventListener("click", function () { stopTour(); setPeak(name); tourIdx = tour.indexOf(name); });
    });
    tile.addEventListener("mouseleave", startTour);
    items.forEach(function (li) { li.addEventListener("blur", startTour); });

    setPeak(tour[tour.length - 1]);
    tourIdx = tour.length - 1;
    startTour();

    if (!reduceMotion) {
      var snow = tile.querySelector(".snow");
      for (var f = 0; f < 28; f++) {
        var flake = document.createElement("i");
        var size = 1.5 + Math.random() * 2.2;
        var dur = 7 + Math.random() * 8;
        flake.style.left = (Math.random() * 100).toFixed(1) + "%";
        flake.style.width = flake.style.height = size.toFixed(1) + "px";
        flake.style.animationDuration = dur.toFixed(1) + "s";
        flake.style.animationDelay = (-Math.random() * dur).toFixed(1) + "s";
        snow.appendChild(flake);
      }
    }
  }

  // ---- off the clock: pass-and-score plays ----
  // Players pass MIN_PASSES..MAX_PASSES times, then someone shoots and scores
  // and their name flashes. Hover (or tap) a player to see who it is.
  var MIN_PASSES = 3, MAX_PASSES = 10;
  var SVG_NS = "http://www.w3.org/2000/svg";
  Array.prototype.forEach.call(document.querySelectorAll("svg.play"), initPlay);

  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(el);
    return el;
  }
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function randIn(lo, hi) { return lo + Math.random() * (hi - lo); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function initPlay(svg) {
    var hoops = svg.getAttribute("data-mode") === "hoops";
    var goal = { x: +svg.getAttribute("data-goal-x"), y: +svg.getAttribute("data-goal-y") };
    var target = svg.querySelector(hoops ? ".hoop" : ".goal");
    var drift = hoops ? 2 : 4;
    var passMs = hoops ? 420 : 540;
    var shotMs = hoops ? 900 : 460;

    var players = Array.prototype.map.call(svg.querySelectorAll(".player"), function (g) {
      var p = { g: g, name: g.getAttribute("data-name"), hx: +g.getAttribute("data-x"), hy: +g.getAttribute("data-y"), nextMove: 0 };
      p.x = p.tx = p.hx;
      p.y = p.ty = p.hy;
      svgEl("circle", { "class": "hit", r: 9 }, g);
      svgEl("circle", { "class": "body", r: 4.4 }, g);
      return p;
    });
    if (!players.length) return;

    var ball = svgEl("circle", { "class": "ball", r: hoops ? 3.3 : 2.4 }, svg);
    var tag = svgEl("text", { "class": "ptag", "text-anchor": "middle" }, svg);
    var flash = svgEl("text", {
      "class": "pflash", "text-anchor": "middle",
      x: svg.getAttribute("data-flash-x"), y: svg.getAttribute("data-flash-y")
    }, svg);

    // ---- hover / tap labels ----
    var hovered = null;
    players.forEach(function (p) {
      function show() { hovered = p; tag.textContent = p.name; tag.classList.add("on"); placeTag(); }
      function hide() { if (hovered === p) { hovered = null; tag.classList.remove("on"); } }
      p.g.addEventListener("mouseenter", show);
      p.g.addEventListener("mouseleave", hide);
      p.g.addEventListener("click", show);
    });
    function placeTag() {
      if (!hovered) return;
      tag.setAttribute("x", hovered.x.toFixed(1));
      tag.setAttribute("y", Math.max(7, hovered.y - 8).toFixed(1));
    }

    // ---- play state ----
    var holder = players[randInt(0, players.length - 1)];
    var passesLeft = randInt(MIN_PASSES, MAX_PASSES);
    var action = { kind: "hold", until: 0 };

    function heldSpot(p) { return { x: p.x + 3, y: p.y + (hoops ? -3 : 2) }; }

    function nextAction(now) {
      var from = heldSpot(holder);
      if (passesLeft > 0) {
        var others = players.filter(function (p) { return p !== holder; });
        action = { kind: "pass", to: others[randInt(0, others.length - 1)], t0: now, sx: from.x, sy: from.y };
        passesLeft--;
        return;
      }
      var ey = goal.y + (hoops ? 0 : randIn(-5, 5));
      action = {
        kind: "shot", shooter: holder, t0: now, sx: from.x, sy: from.y, ex: goal.x, ey: ey,
        cy: Math.min(from.y, ey) - 38
      };
    }

    function score(name) {
      flash.textContent = name;
      flash.classList.remove("go");
      target.classList.remove("score");
      void flash.getBoundingClientRect();
      flash.classList.add("go");
      target.classList.add("score");
      setTimeout(function () { target.classList.remove("score"); }, 450);
    }

    function step(now) {
      players.forEach(function (p) {
        if (now > p.nextMove) {
          p.tx = p.hx + randIn(-drift, drift);
          p.ty = p.hy + randIn(-drift * 0.75, drift * 0.75);
          p.nextMove = now + randIn(900, 1800);
        }
        p.x += (p.tx - p.x) * 0.04;
        p.y += (p.ty - p.y) * 0.04;
        p.g.setAttribute("transform", "translate(" + p.x.toFixed(2) + " " + p.y.toFixed(2) + ")");
      });

      var bx, by;
      if (action.kind === "hold") {
        var spot = heldSpot(holder);
        bx = spot.x; by = spot.y;
        if (now >= action.until) nextAction(now);
      } else if (action.kind === "pass") {
        var t = Math.min(1, (now - action.t0) / passMs);
        var end = heldSpot(action.to);
        var e = easeInOut(t);
        bx = action.sx + (end.x - action.sx) * e;
        by = action.sy + (end.y - action.sy) * e;
        if (t >= 1) { holder = action.to; action = { kind: "hold", until: now + randIn(220, 600) }; }
      } else if (action.kind === "shot") {
        var ts = Math.min(1, (now - action.t0) / shotMs);
        if (hoops) {
          // quadratic arc up and into the rim
          var mx = (action.sx + action.ex) / 2, u = 1 - ts;
          bx = u * u * action.sx + 2 * u * ts * mx + ts * ts * action.ex;
          by = u * u * action.sy + 2 * u * ts * action.cy + ts * ts * action.ey;
        } else {
          bx = action.sx + (action.ex - action.sx) * ts;
          by = action.sy + (action.ey - action.sy) * ts;
        }
        if (ts >= 1) { score(action.shooter.name); action = { kind: "scored", until: now + 1500, x: bx, y: by }; }
      } else {
        bx = action.x; by = action.y;
        if (now >= action.until) {
          holder = players[randInt(0, players.length - 1)];
          passesLeft = randInt(MIN_PASSES, MAX_PASSES);
          action = { kind: "hold", until: now + 500 };
        }
      }
      ball.setAttribute("cx", bx.toFixed(2));
      ball.setAttribute("cy", by.toFixed(2));
      placeTag();
    }

    // draw once so the static (reduced-motion / off-screen) state looks right
    step(0);
    if (reduceMotion) return;

    // only animate while the tile is on screen and the tab is visible
    var visible = false, raf = null;
    function loop(now) { step(now); raf = requestAnimationFrame(loop); }
    function sync() {
      var shouldRun = visible && !document.hidden;
      if (shouldRun && raf === null) {
        action = { kind: "hold", until: performance.now() + 400 };
        raf = requestAnimationFrame(loop);
      } else if (!shouldRun && raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        sync();
      }).observe(svg);
    } else {
      visible = true;
    }
    document.addEventListener("visibilitychange", sync);
    sync();
  }

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
