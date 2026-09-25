// "Off the clock" hobbies panel: ski skyline and the Chelsea / Knicks plays.
// Also exposes the shared animation helpers that js/poker.js uses.
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Run onFrame(now, dt) every frame, but only while `el` is on screen and the
  // tab is visible; onResume(now) fires each time the animation (re)starts.
  function animateWhileVisible(el, onFrame, onResume) {
    var hasIO = "IntersectionObserver" in window;
    var visible = !hasIO, raf = null, last = 0;
    function loop(now) {
      onFrame(now, Math.max(0, Math.min(50, now - last)));
      last = now;
      raf = requestAnimationFrame(loop);
    }
    function sync() {
      var run = visible && !document.hidden;
      if (run && raf === null) {
        last = performance.now();
        if (onResume) onResume(last);
        raf = requestAnimationFrame(loop);
      } else if (!run && raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    }
    if (hasIO) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }).observe(el);
    }
    document.addEventListener("visibilitychange", sync);
    sync();
  }

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
      svgEl("circle", { "class": "body", r: 5.4 }, g);
      svgEl("text", { "class": "pnum", "text-anchor": "middle", y: 1.6 }, g).textContent = g.getAttribute("data-num") || "";
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
      tag.setAttribute("y", Math.max(7, hovered.y - 9).toFixed(1));
    }

    // ---- play state ----
    var holder = players[randInt(0, players.length - 1)];
    var passesLeft = randInt(MIN_PASSES, MAX_PASSES);
    var action = { kind: "hold", until: 0 };

    function heldSpot(p) { return { x: p.x + 4.5, y: p.y + (hoops ? -4 : 3) }; }

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

    animateWhileVisible(svg, step, function (now) { action = { kind: "hold", until: now + 400 }; });
  }

  // shared with js/poker.js
  window.MGAnim = {
    svgEl: svgEl, randInt: randInt, randIn: randIn, easeInOut: easeInOut,
    animateWhileVisible: animateWhileVisible, reduceMotion: reduceMotion
  };
})();
