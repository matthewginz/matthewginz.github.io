// "Off the clock" hobbies panel: ski skyline, Chelsea / Knicks plays, poker table.
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

  // ---- off the clock: poker table ----
  // A Hold'em hand dealt by the rules: riffle, two hole cards each starting
  // left of the button, bet/fold rounds, burn + flop/turn/river, showdown.
  // No winner is declared. Idle players do chip tricks between actions.
  var SUITS = ["♠", "♥", "♦", "♣"];
  var RED_SUITS = ["♥", "♦"];
  var RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
  var DECK_POS = { x: 138, y: 70 };
  var POT_POS = { x: 200, y: 98 };
  var MUCK_POS = { x: 200, y: 46 };
  var BOARD_X = [170, 185, 200, 215, 230];
  var BOARD_Y = 70;
  var TABLE_CENTER = { x: 200, y: 78 };
  var SEAT_POS = [{ x: 30, y: 78 }, { x: 118, y: 15 }, { x: 282, y: 15 }, { x: 370, y: 78 }, { x: 200, y: 141 }];
  var CHIP_COLORS = ["c0", "c1", "c2", "c3"];
  var HAND_MS = 12000;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function place(el, x, y, rot, sx, sy) {
    el.setAttribute("transform",
      "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") rotate(" + (rot || 0).toFixed(1) + ") scale(" +
      (sx == null ? 1 : sx).toFixed(3) + " " + (sy == null ? 1 : sy).toFixed(3) + ")");
  }
  function shuffledDeck() {
    var deck = [];
    SUITS.forEach(function (s) { RANKS.forEach(function (r) { deck.push({ rank: r, suit: s }); }); });
    for (var i = deck.length - 1; i > 0; i--) {
      var j = randInt(0, i), tmp = deck[i];
      deck[i] = deck[j]; deck[j] = tmp;
    }
    return deck;
  }

  // A tiny clock that only advances while the table is animating, so pausing
  // off-screen freezes every timer and tween together.
  function Timeline() { this.clock = 0; this.timers = []; this.tweens = []; this.instant = false; }
  Timeline.prototype.after = function (ms, fn) {
    if (this.instant) fn(); else this.timers.push({ at: this.clock + ms, fn: fn });
  };
  Timeline.prototype.tween = function (ms, fn, done) {
    if (this.instant) { fn(1); if (done) done(); return; }
    this.tweens.push({ t0: this.clock, ms: ms, fn: fn, done: done });
  };
  Timeline.prototype.tick = function (dt) {
    var now = (this.clock += dt);
    var due = this.timers.filter(function (tm) { return tm.at <= now; });
    this.timers = this.timers.filter(function (tm) { return tm.at > now; });
    due.forEach(function (tm) { tm.fn(); });
    var live = this.tweens;
    this.tweens = [];
    live.forEach(function (tw) {
      var t = Math.min(1, (now - tw.t0) / tw.ms);
      tw.fn(t);
      if (t < 1) this.tweens.push(tw); else if (tw.done) tw.done();
    }, this);
  };

  function PokerTable(svg) {
    this.svg = svg;
    this.tl = new Timeline();
    this.cardLayer = svg.querySelector(".pk-cards");
    this.potLayer = svg.querySelector(".pk-pot");
    this.seatLayer = svg.querySelector(".pk-seats");
    this.button = svg.querySelector(".pk-button");
    this.halves = svg.querySelectorAll(".pk-deck .pk-half");
    this.streets = Array.prototype.slice.call(document.querySelectorAll("#pokerStreets li"));
    this.dealer = randInt(0, SEAT_POS.length - 1);
    this.cards = [];
    this.potChips = [];
    this.seats = SEAT_POS.map(this.makeSeat, this);
    Array.prototype.forEach.call(this.halves, function (h) { place(h, DECK_POS.x, DECK_POS.y); });
  }

  PokerTable.prototype.makeSeat = function (pos) {
    var dx = TABLE_CENTER.x - pos.x, dy = TABLE_CENTER.y - pos.y, len = Math.hypot(dx, dy);
    var dir = { x: dx / len, y: dy / len }, perp = { x: -dy / len, y: dx / len };
    // chips go on whichever side of the seat is closer to the table; the dealer button uses the other side
    var side = Math.hypot(pos.x + perp.x * 15 - TABLE_CENTER.x, pos.y + perp.y * 15 - TABLE_CENTER.y) <
               Math.hypot(pos.x - perp.x * 15 - TABLE_CENTER.x, pos.y - perp.y * 15 - TABLE_CENTER.y) ? 1 : -1;
    var seat = { pos: pos, dir: dir, perp: perp, side: side, hole: [], folded: false, busy: false };
    seat.body = svgEl("circle", { "class": "pk-seat", cx: pos.x, cy: pos.y, r: 7.5 }, this.seatLayer);
    seat.stackAt = { x: pos.x + dir.x * 13 + perp.x * 15 * side, y: pos.y + dir.y * 13 + perp.y * 15 * side };
    var stack = svgEl("g", { "class": "pk-stack" }, this.seatLayer);
    seat.chips = CHIP_COLORS.map(function (color, i) {
      var chip = svgEl("ellipse", { "class": "pk-chip " + color, rx: 4, ry: 1.8 }, stack);
      chip.baseY = seat.stackAt.y - i * 1.7;
      place(chip, seat.stackAt.x, chip.baseY);
      return chip;
    });
    seat.cardAt = function (i) {
      var side = i ? 5 : -5;
      return { x: pos.x + dir.x * 25 + perp.x * side, y: pos.y + dir.y * 25 + perp.y * side, rot: i ? 7 : -7 };
    };
    return seat;
  };

  // ---- cards ----
  PokerTable.prototype.newCard = function () {
    var g = svgEl("g", { "class": "pk-card back" }, this.cardLayer);
    svgEl("rect", { x: -6.5, y: -9, width: 13, height: 18, rx: 1.6 }, g);
    var card = { g: g, label: svgEl("text", { "text-anchor": "middle", y: 2.2 }, g), x: DECK_POS.x, y: DECK_POS.y, rot: 0, sx: 1 };
    this.cards.push(card);
    this.draw(card);
    return card;
  };
  PokerTable.prototype.draw = function (c) { place(c.g, c.x, c.y, c.rot, c.sx, 1); };
  PokerTable.prototype.slide = function (c, to, ms, done) {
    var from = { x: c.x, y: c.y, rot: c.rot }, self = this;
    this.tl.tween(ms, function (t) {
      var e = easeInOut(t);
      c.x = lerp(from.x, to.x, e);
      c.y = lerp(from.y, to.y, e);
      c.rot = lerp(from.rot, to.rot || 0, e);
      self.draw(c);
    }, done);
  };
  PokerTable.prototype.reveal = function (c, face) {
    var self = this, shown = false;
    this.tl.tween(280, function (t) {
      if (t >= 0.5 && !shown) {
        shown = true;
        c.g.classList.remove("back");
        c.g.classList.toggle("red", RED_SUITS.indexOf(face.suit) >= 0);
        c.label.textContent = face.rank + face.suit;
      }
      c.sx = Math.abs(Math.cos(Math.PI * t));
      self.draw(c);
    });
  };

  // ---- one hand, street by street ----
  PokerTable.prototype.playHand = function (loop) {
    var self = this, tl = this.tl;
    this.reset();
    this.deck = shuffledDeck();
    this.moveButton();
    this.setStreet("preflop");
    this.riffle();
    tl.after(900, function () { self.dealHole(); });
    [[2300, "bet"], [3200, "flop"], [4100, "bet"], [4900, "turn"], [5500, "bet"],
     [6300, "river"], [6900, "bet"], [7800, "showdown"]].forEach(function (step) {
      tl.after(step[0], function () { self.street(step[1]); });
    });
    if (!loop) return;
    tl.after(HAND_MS - 1200, function () { self.collect(); });
    tl.after(HAND_MS, function () { self.playHand(true); });
  };
  PokerTable.prototype.street = function (name) {
    if (name === "bet") this.betRound();
    else if (name === "flop") this.dealBoard([0, 1, 2], name);
    else if (name === "turn") this.dealBoard([3], name);
    else if (name === "river") this.dealBoard([4], name);
    else this.showdown();
  };
  PokerTable.prototype.dealHole = function () {
    var self = this, n = this.seats.length;
    function dealTo(seat, i) {
      var c = self.newCard();
      c.face = self.deck.pop();
      seat.hole.push(c);
      self.slide(c, seat.cardAt(i), 260);
    }
    for (var round = 0; round < 2; round++) {
      for (var k = 0; k < n; k++) {
        this.tl.after((round * n + k) * 110, dealTo.bind(null, this.seats[(this.dealer + 1 + k) % n], round));
      }
    }
  };
  PokerTable.prototype.dealBoard = function (slots, name) {
    var self = this;
    this.setStreet(name);
    this.deck.pop(); // burn one, like a real dealer
    slots.forEach(function (slot, k) {
      self.tl.after(k * 160, function () {
        var c = self.newCard();
        self.slide(c, { x: BOARD_X[slot], y: BOARD_Y, rot: 0 }, 300, function () { self.reveal(c, self.deck.pop()); });
      });
    });
  };
  PokerTable.prototype.betRound = function () {
    var self = this;
    var live = this.seats.filter(function (s) { return !s.folded; });
    var remaining = live.length, acted = 0;
    live.forEach(function (seat, k) {
      var r = Math.random();
      if (remaining > 2 && r < 0.1) {
        remaining--; acted++;
        self.tl.after(k * 150, function () { self.fold(seat); });
      } else if (r < 0.55) {
        acted++;
        self.tl.after(k * 150, function () { self.bet(seat); });
      }
    });
    if (!acted) this.bet(live[randInt(0, live.length - 1)]);
  };
  PokerTable.prototype.bet = function (seat) {
    var chip = svgEl("ellipse", { "class": "pk-chip " + CHIP_COLORS[randInt(0, 3)], rx: 4, ry: 1.8 }, this.potLayer);
    var from = seat.stackAt, to = { x: POT_POS.x + randIn(-10, 10), y: POT_POS.y + randIn(-3, 3) };
    this.potChips.push(chip);
    this.tl.tween(420, function (t) {
      var e = easeInOut(t);
      place(chip, lerp(from.x, to.x, e), lerp(from.y, to.y, e) - Math.sin(Math.PI * t) * 4);
    });
  };
  PokerTable.prototype.fold = function (seat) {
    var self = this;
    seat.folded = true;
    seat.body.classList.add("folded");
    seat.hole.forEach(function (c) {
      var to = { x: MUCK_POS.x + randIn(-7, 7), y: MUCK_POS.y + randIn(-2, 2), rot: randIn(-35, 35) };
      self.slide(c, to, 380, function () { c.g.classList.add("mucked"); });
    });
  };
  PokerTable.prototype.showdown = function () {
    var self = this;
    this.setStreet("showdown");
    this.seats.filter(function (s) { return !s.folded; }).forEach(function (seat, k) {
      seat.hole.forEach(function (c, i) {
        self.tl.after(k * 200 + i * 90, function () { self.reveal(c, c.face); });
      });
    });
  };
  PokerTable.prototype.collect = function () {
    var self = this;
    this.cards.forEach(function (c) {
      self.slide(c, { x: DECK_POS.x, y: DECK_POS.y, rot: 0 }, 420, function () { c.g.remove(); });
    });
    this.potChips.forEach(function (chip) {
      self.tl.tween(400, function (t) { chip.style.opacity = String(1 - t); }, function () { chip.remove(); });
    });
    this.cards = [];
    this.potChips = [];
    this.setStreet(null);
  };
  PokerTable.prototype.reset = function () {
    this.cards.forEach(function (c) { c.g.remove(); });
    this.potChips.forEach(function (chip) { chip.remove(); });
    this.cards = [];
    this.potChips = [];
    this.seats.forEach(function (s) { s.folded = false; s.hole = []; s.body.classList.remove("folded"); });
  };
  PokerTable.prototype.moveButton = function () {
    var self = this, btn = this.button;
    this.dealer = (this.dealer + 1) % this.seats.length;
    var s = this.seats[this.dealer];
    var to = { x: s.pos.x + s.dir.x * 13 - s.perp.x * 15 * s.side, y: s.pos.y + s.dir.y * 13 - s.perp.y * 15 * s.side };
    var from = this.buttonAt || to;
    this.tl.tween(500, function (t) {
      var e = easeInOut(t);
      place(btn, lerp(from.x, to.x, e), lerp(from.y, to.y, e));
    }, function () { self.buttonAt = to; });
  };
  PokerTable.prototype.riffle = function () {
    var halves = this.halves;
    this.tl.tween(850, function (t) {
      var off = Math.abs(Math.sin(Math.PI * 2 * t)) * 8;
      place(halves[0], DECK_POS.x - off, DECK_POS.y, -off * 1.5);
      place(halves[1], DECK_POS.x + off, DECK_POS.y, off * 1.5);
    });
  };
  PokerTable.prototype.setStreet = function (name) {
    this.streets.forEach(function (li) { li.classList.toggle("on", li.getAttribute("data-street") === name); });
  };

  // ---- chip and card tricks while players wait ----
  PokerTable.prototype.trick = function () {
    var idle = this.seats.filter(function (s) { return !s.busy; });
    if (!idle.length) return;
    var seat = idle[randInt(0, idle.length - 1)];
    var tricks = [this.chipFlip, this.knuckleRoll, this.chipRiffle];
    if (seat.hole.length === 2 && !seat.folded) tricks.push(this.cardSpin);
    seat.busy = true;
    tricks[randInt(0, tricks.length - 1)].call(this, seat, function () { seat.busy = false; });
  };
  PokerTable.prototype.chipFlip = function (seat, done) {
    var chip = seat.chips[3], at = seat.stackAt;
    this.tl.tween(700, function (t) {
      place(chip, at.x, chip.baseY - Math.sin(Math.PI * t) * 12, 0, 1, Math.cos(Math.PI * 4 * t));
    }, done);
  };
  PokerTable.prototype.knuckleRoll = function (seat, done) {
    var chip = seat.chips[3], at = seat.stackAt, p = seat.perp;
    this.tl.tween(1200, function (t) {
      var reach = t < 0.5 ? t * 2 : 2 - t * 2;
      var hop = Math.abs(Math.sin(Math.PI * 8 * t)) * 3;
      place(chip, at.x + p.x * 13 * reach, chip.baseY + p.y * 13 * reach - hop, 0, Math.cos(Math.PI * 8 * t), 1);
    }, done);
  };
  PokerTable.prototype.chipRiffle = function (seat, done) {
    var at = seat.stackAt, p = seat.perp, chips = seat.chips;
    this.tl.tween(900, function (t) {
      var off = Math.sin(Math.PI * t) * 5;
      chips.forEach(function (chip, i) {
        var side = i % 2 ? 1 : -1;
        place(chip, at.x + p.x * off * side, chip.baseY + p.y * off * side);
      });
    }, done);
  };
  PokerTable.prototype.cardSpin = function (seat, done) {
    var c = seat.hole[1], base = c.rot, self = this;
    this.tl.tween(800, function (t) {
      c.rot = base + 360 * easeInOut(t);
      self.draw(c);
    }, function () { c.rot = base; self.draw(c); done(); });
  };

  var pokerSvg = document.getElementById("pokerTable");
  if (pokerSvg) initPoker(pokerSvg);

  function initPoker(svg) {
    var table = new PokerTable(svg);
    // static first frame: a full hand at showdown (also the reduced-motion view)
    table.tl.instant = true;
    table.playHand(false);
    table.tl.instant = false;
    if (reduceMotion) return;
    var started = false;
    animateWhileVisible(svg, function (now, dt) { table.tl.tick(dt); }, function () {
      if (started) return;
      started = true;
      table.playHand(true);
      (function tricks() {
        table.trick();
        table.tl.after(randIn(600, 1400), tricks);
      })();
    });
  }

})();
