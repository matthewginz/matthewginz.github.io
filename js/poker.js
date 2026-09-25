// Poker table for the "Off the clock" panel. Five players (shoulders, head,
// two hands) play Texas Hold'em by the rules at a slow, readable pace: blinds,
// hole cards dealt from the small blind, one action at a time, a burn before
// each street, showdown with no winner. Between actions, idle players do real
// chip tricks:
//   riffle       split the stack in two, middle finger lifts the inner edges
//                while the outside fingers squeeze, stacks merge alternating
//   thumb flip   thumb pushes the top chip up and flips it back over
//   knuckle roll chip walks index -> middle -> ring -> pinky, then back under
//                the hand to the thumb
//   peek         lift the corners of the hole cards
(function () {
  "use strict";

  var A = window.MGAnim;
  var table = document.getElementById("pokerTable");
  if (!A || !table) return;
  var svgEl = A.svgEl, randInt = A.randInt, randIn = A.randIn, easeInOut = A.easeInOut;

  var ACTION_MS = 5000;          // one player action every five seconds
  var DEAL_GAP_MS = 450;
  var STREET_PAUSE_MS = 2500;
  var SHOWDOWN_HOLD_MS = 8000;
  var TRICK_GAP_MS = [1400, 3000];
  var MAX_TRICKS_AT_ONCE = 2;

  var SUITS = ["♠", "♥", "♦", "♣"];
  var RED_SUITS = ["♥", "♦"];
  var RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
  var DECK_POS = { x: 138, y: 70 };
  var BURN_POS = { x: 138, y: 95 };
  var POT_POS = { x: 200, y: 98 };
  var MUCK_POS = { x: 200, y: 46 };
  var BOARD_X = [170, 185, 200, 215, 230];
  var BOARD_Y = 70;
  var TABLE_CENTER = { x: 200, y: 78 };
  var SEAT_POS = [{ x: 30, y: 78 }, { x: 118, y: 15 }, { x: 282, y: 15 }, { x: 370, y: 78 }, { x: 200, y: 141 }];
  // which side of each seat the chip stack sits on (+1/-1 along the seat's perpendicular),
  // mirrored left/right so every stack lands on the felt
  var SEAT_SIDE = [1, 1, -1, -1, 1];
  var SHIRTS = ["#3b6ea5", "#8c4a8c", "#3f8c63", "#a5703b", "#6a6a9c"];
  var HAIR = ["#2b1d14", "#5a3a22", "#1c1c1c", "#8a5a2b", "#3d2b1f"];
  var STACK_COLORS = [["c1", "c2"], ["c3", "c0"], ["c1", "c0"], ["c3", "c2"], ["c0", "c1"]];
  var CHIPS_PER_COLOR = 3;
  var CHIP_GAP = 1.5;
  var KNUCKLES = [-2.25, -0.75, 0.75, 2.25]; // index, middle, ring, pinky (hand-local y)
  var LABELS = { fold: "Fold", check: "Check", call: "Call", bet: "Bet", raise: "Raise", sb: "Small blind", bb: "Big blind" };
  var CHIPS_FOR = { call: 2, bet: 3, raise: 3, sb: 1, bb: 2 };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
  function along(pos, dir, perp, a, b) { return { x: pos.x + dir.x * a + perp.x * b, y: pos.y + dir.y * a + perp.y * b }; }
  function stackSpot(base, k) { return { x: base.x, y: base.y - k * CHIP_GAP }; }
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

  // ---- timeline: a clock that only runs while the table is animating ----
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
  // run steps one after another; each step gets a `next` callback
  function chain(steps, done) {
    var i = 0;
    (function next() {
      if (i >= steps.length) { if (done) done(); return; }
      steps[i++](next);
    })();
  }

  // ---- table and players ----
  function PokerTable(svg) {
    this.svg = svg;
    this.tl = new Timeline();
    this.seatLayer = svg.querySelector(".pk-seats");
    this.potLayer = svg.querySelector(".pk-pot");
    this.cardLayer = svg.querySelector(".pk-cards");
    this.handLayer = svgEl("g", { "class": "pk-hands" }, svg);
    this.floatLayer = svgEl("g", { "class": "pk-float" }, svg);
    this.labelLayer = svgEl("g", { "class": "pk-labels" }, svg);
    this.button = svg.querySelector(".pk-button");
    this.halves = svg.querySelectorAll(".pk-deck .pk-half");
    this.streets = Array.prototype.slice.call(document.querySelectorAll("#pokerStreets li"));
    this.dealer = randInt(0, SEAT_POS.length - 1);
    this.cards = [];
    this.potChips = [];
    this.showdownOn = false;
    this.seats = SEAT_POS.map(this.makeSeat, this);
    Array.prototype.forEach.call(this.halves, function (h) { place(h, DECK_POS.x, DECK_POS.y); });
  }

  PokerTable.prototype.makeSeat = function (pos, i) {
    var dx = TABLE_CENTER.x - pos.x, dy = TABLE_CENTER.y - pos.y, len = Math.hypot(dx, dy);
    var dir = { x: dx / len, y: dy / len }, perp = { x: -dir.y, y: dir.x };
    var angle = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
    var side = SEAT_SIDE[i]; // chips on this side; cards and the dealer button on the other
    var seat = { i: i, pos: pos, dir: dir, perp: perp, side: side, angle: angle, hole: [], folded: false, busy: false };
    seat.stackAt = along(pos, dir, perp, 13, 15 * side);
    seat.chipHome = along(pos, dir, perp, 10, 8 * side);
    seat.cardHome = along(pos, dir, perp, 13, -8 * side);
    seat.player = this.makePlayer(seat);
    seat.stackG = svgEl("g", { "class": "pk-stack" }, this.seatLayer);
    seat.stack = [];
    STACK_COLORS[i].forEach(function (color) {
      for (var k = 0; k < CHIPS_PER_COLOR; k++) {
        var chip = svgEl("ellipse", { "class": "pk-chip " + color, rx: 4, ry: 1.8 }, seat.stackG);
        chip.col = color;
        seat.stack.push(chip);
      }
    });
    this.layStack(seat);
    seat.hands = { chip: this.makeHand(angle, side), card: this.makeHand(angle, -side) };
    this.placeHand(seat.hands.chip, seat.chipHome.x, seat.chipHome.y);
    this.placeHand(seat.hands.card, seat.cardHome.x, seat.cardHome.y);
    var labelX = pos.y < 40 ? pos.x + (pos.x < TABLE_CENTER.x ? -24 : 24) : pos.x;
    var labelY = pos.y < 40 ? pos.y + 2 : pos.y - 11;
    seat.label = svgEl("text", { "class": "pk-say", "text-anchor": "middle", x: labelX, y: labelY }, this.labelLayer);
    seat.cardAt = function (k) {
      var off = k ? 5 : -5;
      return { x: pos.x + dir.x * 25 + perp.x * off, y: pos.y + dir.y * 25 + perp.y * off, rot: k ? 7 : -7 };
    };
    return seat;
  };

  // top-down player: shoulders, hair, a bit of face toward the table, and a turn ring
  PokerTable.prototype.makePlayer = function (seat) {
    var g = svgEl("g", { "class": "pk-player" }, this.seatLayer);
    var body = svgEl("ellipse", { "class": "pk-body", rx: 11, ry: 5, style: "fill:" + SHIRTS[seat.i] }, g);
    place(body, seat.pos.x - seat.dir.x * 5, seat.pos.y - seat.dir.y * 5, seat.angle + 90);
    svgEl("circle", { "class": "pk-ring", cx: seat.pos.x, cy: seat.pos.y, r: 7.6 }, g);
    svgEl("circle", { "class": "pk-hair", cx: seat.pos.x, cy: seat.pos.y, r: 6, style: "fill:" + HAIR[seat.i] }, g);
    svgEl("circle", { "class": "pk-face", cx: seat.pos.x + seat.dir.x * 1.8, cy: seat.pos.y + seat.dir.y * 1.8, r: 4.6 }, g);
    return g;
  };

  // a hand seen from above: palm, four fingers pointing at the table, thumb to one side
  PokerTable.prototype.makeHand = function (angle, mirror) {
    var g = svgEl("g", { "class": "pk-hand" }, this.handLayer);
    svgEl("ellipse", { "class": "palm", rx: 4.2, ry: 3.4 }, g);
    KNUCKLES.forEach(function (fy) { svgEl("ellipse", { "class": "finger", cx: 4.4, cy: fy, rx: 1.7, ry: 0.72 }, g); });
    svgEl("ellipse", { "class": "thumb", cx: 1.2, cy: -3.6, rx: 1.9, ry: 0.85 }, g);
    return { g: g, x: 0, y: 0, angle: angle, mirror: mirror };
  };
  PokerTable.prototype.placeHand = function (h, x, y, squeeze) {
    h.x = x;
    h.y = y;
    place(h.g, x, y, h.angle, 1, h.mirror * (squeeze || 1));
  };
  PokerTable.prototype.handPoint = function (h, lx, ly) {
    var a = h.angle * Math.PI / 180, y = ly * h.mirror;
    return { x: h.x + lx * Math.cos(a) - y * Math.sin(a), y: h.y + lx * Math.sin(a) + y * Math.cos(a) };
  };
  PokerTable.prototype.moveHand = function (h, to, ms, done) {
    var self = this, from = { x: h.x, y: h.y };
    this.tl.tween(ms, function (t) {
      var p = mix(from, to, easeInOut(t));
      self.placeHand(h, p.x, p.y);
    }, done);
  };
  PokerTable.prototype.layStack = function (seat) {
    seat.stack.forEach(function (chip, k) {
      var p = stackSpot(seat.stackAt, k);
      place(chip, p.x, p.y);
      seat.stackG.appendChild(chip);
    });
  };
  PokerTable.prototype.say = function (seat, text) {
    if (this.tl.instant) return;
    seat.label.textContent = text;
    seat.label.classList.remove("show");
    void seat.label.getBoundingClientRect();
    seat.label.classList.add("show");
  };

  // ---- cards ----
  PokerTable.prototype.newCard = function (from) {
    var g = svgEl("g", { "class": "pk-card back" }, this.cardLayer);
    svgEl("rect", { x: -6.5, y: -9, width: 13, height: 18, rx: 1.6 }, g);
    var start = from || DECK_POS;
    var card = { g: g, label: svgEl("text", { "text-anchor": "middle", y: 2.2 }, g), x: start.x, y: start.y, rot: 0, sx: 1 };
    this.cards.push(card);
    this.drawCard(card);
    return card;
  };
  PokerTable.prototype.drawCard = function (c, lift) {
    place(c.g, c.x, c.y - (lift || 0) * 1.6, c.rot, c.sx, 1 - (lift || 0) * 0.35);
  };
  PokerTable.prototype.slide = function (c, to, ms, done) {
    var from = { x: c.x, y: c.y, rot: c.rot }, self = this;
    this.tl.tween(ms, function (t) {
      var e = easeInOut(t);
      c.x = lerp(from.x, to.x, e);
      c.y = lerp(from.y, to.y, e);
      c.rot = lerp(from.rot, to.rot || 0, e);
      self.drawCard(c);
    }, done);
  };
  PokerTable.prototype.reveal = function (c, face, done) {
    var self = this, shown = false;
    this.tl.tween(500, function (t) {
      if (t >= 0.5 && !shown) {
        shown = true;
        c.g.classList.remove("back");
        c.g.classList.toggle("red", RED_SUITS.indexOf(face.suit) >= 0);
        c.label.textContent = face.rank + face.suit;
      }
      c.sx = Math.abs(Math.cos(Math.PI * t));
      self.drawCard(c);
    }, done);
  };
  PokerTable.prototype.riffle = function (done) {
    var halves = this.halves;
    this.tl.tween(2400, function (t) {
      var off = Math.abs(Math.sin(Math.PI * 3 * t)) * 8;
      place(halves[0], DECK_POS.x - off, DECK_POS.y, -off * 1.5);
      place(halves[1], DECK_POS.x + off, DECK_POS.y, off * 1.5);
    }, done);
  };
  PokerTable.prototype.dealHole = function (done) {
    var self = this, n = this.seats.length, steps = [];
    for (var round = 0; round < 2; round++) {
      for (var k = 0; k < n; k++) {
        steps.push(this.dealOne.bind(this, this.seats[(this.dealer + 1 + k) % n], round));
      }
    }
    chain(steps, function () { self.tl.after(STREET_PAUSE_MS, done); });
  };
  PokerTable.prototype.dealOne = function (seat, round, next) {
    var c = this.newCard();
    c.face = this.deck.pop();
    seat.hole.push(c);
    this.slide(c, seat.cardAt(round), 700);
    this.tl.after(DEAL_GAP_MS, next);
  };
  PokerTable.prototype.dealBoard = function (slots, name, done) {
    var self = this, steps = [];
    this.setStreet(name);
    // burn one face down before every street, like a real dealer
    steps.push(function (next) {
      self.deck.pop();
      var burn = self.newCard();
      self.slide(burn, { x: BURN_POS.x + randIn(-1, 1), y: BURN_POS.y, rot: randIn(-8, 8) }, 700, next);
    });
    slots.forEach(function (slot) {
      steps.push(function (next) {
        var c = self.newCard();
        self.slide(c, { x: BOARD_X[slot], y: BOARD_Y, rot: 0 }, 800, function () { self.reveal(c, self.deck.pop(), next); });
      });
    });
    chain(steps, function () { self.tl.after(STREET_PAUSE_MS, done); });
  };
  PokerTable.prototype.showdown = function (done) {
    var self = this, steps = [];
    this.setStreet("showdown");
    this.showdownOn = true;
    this.seats.filter(function (s) { return !s.folded; }).forEach(function (seat) {
      steps.push(function (next) {
        self.reveal(seat.hole[0], seat.hole[0].face);
        self.reveal(seat.hole[1], seat.hole[1].face, function () { self.tl.after(900, next); });
      });
    });
    chain(steps, done);
  };
  PokerTable.prototype.collect = function (done) {
    var self = this;
    this.cards.forEach(function (c) {
      self.slide(c, { x: DECK_POS.x, y: DECK_POS.y, rot: 0 }, 900, function () { c.g.remove(); });
    });
    this.potChips.forEach(function (chip) {
      self.tl.tween(700, function (t) { chip.style.opacity = String(1 - t); }, function () { chip.remove(); });
    });
    this.cards = [];
    this.potChips = [];
    this.setStreet(null);
    this.tl.after(1200, done);
  };
  PokerTable.prototype.reset = function () {
    this.cards.forEach(function (c) { c.g.remove(); });
    this.potChips.forEach(function (chip) { chip.remove(); });
    this.cards = [];
    this.potChips = [];
    this.showdownOn = false;
    this.seats.forEach(function (s) { s.folded = false; s.hole = []; s.player.classList.remove("folded"); });
  };
  PokerTable.prototype.moveButton = function () {
    var self = this, btn = this.button;
    this.dealer = (this.dealer + 1) % this.seats.length;
    var s = this.seats[this.dealer];
    var to = along(s.pos, s.dir, s.perp, 19, -17 * s.side);
    var from = this.buttonAt || to;
    this.tl.tween(1000, function (t) {
      var p = mix(from, to, easeInOut(t));
      place(btn, p.x, p.y);
    }, function () { self.buttonAt = to; });
  };
  PokerTable.prototype.setStreet = function (name) {
    this.streets.forEach(function (li) { li.classList.toggle("on", li.getAttribute("data-street") === name); });
  };

  // ---- one hand, by the rules ----
  PokerTable.prototype.playHand = function (loop) {
    var self = this, n = this.seats.length;
    this.reset();
    this.deck = shuffledDeck();
    this.moveButton();
    this.setStreet("preflop");
    var sb = this.seats[(this.dealer + 1) % n];
    this.bb = this.seats[(this.dealer + 2) % n];
    chain([
      function (next) { self.riffle(next); },
      function (next) { self.act(sb, "sb", next); },
      function (next) { self.act(self.bb, "bb", next); },
      function (next) { self.dealHole(next); },
      this.bettingRound((this.dealer + 3) % n, true),       // preflop: left of the big blind
      function (next) { self.dealBoard([0, 1, 2], "flop", next); },
      this.bettingRound((this.dealer + 1) % n, false),      // after the flop: left of the button
      function (next) { self.dealBoard([3], "turn", next); },
      this.bettingRound((this.dealer + 1) % n, false),
      function (next) { self.dealBoard([4], "river", next); },
      this.bettingRound((this.dealer + 1) % n, false),
      function (next) { self.showdown(next); }
    ], function () {
      if (!loop) return;
      self.tl.after(SHOWDOWN_HOLD_MS, function () {
        self.collect(function () { self.playHand(true); });
      });
    });
  };

  // One round: everyone acts once in order; if someone bets, the players
  // before them get to call or fold. One bet per round, no re-raises.
  PokerTable.prototype.bettingRound = function (first, preflop) {
    var self = this;
    return function (next) {
      var n = self.seats.length, order = [];
      for (var k = 0; k < n; k++) order.push(self.seats[(first + k) % n]);
      var queue = order.slice(), bettor = null;
      (function step() {
        var seat = queue.shift();
        if (!seat) { self.tl.after(STREET_PAUSE_MS, next); return; }
        if (seat.folded || seat === bettor) { step(); return; }
        var kind = self.chooseAction(seat, preflop, bettor);
        if (kind === "bet" || kind === "raise") {
          bettor = seat;
          queue = queue.concat(order.slice(0, order.indexOf(seat)));
        }
        self.act(seat, kind, step);
      })();
    };
  };
  PokerTable.prototype.chooseAction = function (seat, preflop, bettor) {
    var live = this.seats.filter(function (s) { return !s.folded; }).length;
    var facing = preflop || bettor !== null;
    var r = Math.random();
    if (live > 2 && r < (facing ? 0.18 : 0.06)) return "fold";
    if (bettor === null && r < 0.38) return preflop ? "raise" : "bet";
    if (preflop && bettor === null && seat === this.bb) return "check";   // big blind's option
    return facing ? "call" : "check";
  };
  PokerTable.prototype.act = function (seat, kind, next) {
    var self = this;
    if (seat.busy) { this.tl.after(250, function () { self.act(seat, kind, next); }); return; }
    seat.busy = true;
    seat.player.classList.add("acting");
    this.say(seat, LABELS[kind]);
    var finish = function () { seat.busy = false; seat.player.classList.remove("acting"); };
    if (kind === "fold") this.fold(seat, finish);
    else if (kind === "check") this.knock(seat, finish);
    else this.pushChips(seat, CHIPS_FOR[kind], finish);
    this.tl.after(ACTION_MS, next);
  };

  // ---- what the hands do for each action ----
  PokerTable.prototype.knock = function (seat, done) {
    var self = this, h = seat.hands.card, home = seat.cardHome, d = seat.dir;
    this.tl.tween(1200, function (t) {
      var tap = Math.abs(Math.sin(Math.PI * 2 * t)) * 2.4;
      self.placeHand(h, home.x + d.x * tap, home.y + d.y * tap, 1 - tap * 0.06);
    }, function () { self.placeHand(h, home.x, home.y); done(); });
  };
  PokerTable.prototype.pushChips = function (seat, count, done) {
    var self = this, h = seat.hands.chip, top = stackSpot(seat.stackAt, seat.stack.length);
    var color = seat.stack[seat.stack.length - 1].col;
    var grab = along(seat.stackAt, seat.dir, seat.perp, -3, 0);
    var reach = mix(seat.stackAt, POT_POS, 0.45);
    var chips = [], froms = [], targets = [];
    for (var i = 0; i < count; i++) {
      var chip = svgEl("ellipse", { "class": "pk-chip " + color, rx: 4, ry: 1.8 }, this.potLayer);
      froms.push({ x: top.x, y: top.y - i * CHIP_GAP });
      targets.push({ x: POT_POS.x + randIn(-13, 13), y: POT_POS.y + randIn(-3, 3) });
      place(chip, froms[i].x, froms[i].y);
      chip.style.opacity = "0";
      chips.push(chip);
      this.potChips.push(chip);
    }
    chain([
      function (next) { self.moveHand(h, grab, 600, next); },
      function (next) {
        chips.forEach(function (c) { c.style.opacity = ""; });
        self.tl.tween(1500, function (t) {
          var e = easeInOut(t), hp = mix(grab, reach, e);
          self.placeHand(h, hp.x, hp.y);
          chips.forEach(function (c, k) {
            var p = mix(froms[k], targets[k], e);
            place(c, p.x, p.y - Math.sin(Math.PI * t) * 2);
          });
        }, next);
      },
      function (next) { self.moveHand(h, seat.chipHome, 900, next); }
    ], done);
  };
  PokerTable.prototype.fold = function (seat, done) {
    var self = this, h = seat.hands.card, cards = seat.hole;
    var at = along(mix(cards[0], cards[1], 0.5), seat.dir, seat.perp, -3, 0);
    var toward = mix(at, MUCK_POS, 0.4);
    chain([
      function (next) { self.moveHand(h, at, 700, next); },
      function (next) {
        cards.forEach(function (c) {
          var to = { x: MUCK_POS.x + randIn(-7, 7), y: MUCK_POS.y + randIn(-2, 2), rot: randIn(-35, 35) };
          self.slide(c, to, 1300, function () { c.g.classList.add("mucked"); });
        });
        self.moveHand(h, toward, 800, next);
      },
      function (next) {
        seat.folded = true;
        seat.player.classList.add("folded");
        self.moveHand(h, seat.cardHome, 900, next);
      }
    ], done);
  };

  // ---- tricks ----
  PokerTable.prototype.trick = function () {
    var tricking = this.seats.filter(function (s) { return s.tricking; }).length;
    if (tricking >= MAX_TRICKS_AT_ONCE) return;
    var idle = this.seats.filter(function (s) { return !s.busy; });
    if (!idle.length) return;
    var seat = idle[randInt(0, idle.length - 1)];
    var canPeek = seat.hole.length === 2 && !seat.folded && !this.showdownOn;
    var pick = Math.random();
    var run = pick < 0.35 ? this.chipRiffle : pick < 0.6 ? this.knuckleRoll : pick < 0.85 || !canPeek ? this.thumbFlip : this.peekCards;
    seat.busy = seat.tricking = true;
    run.call(this, seat, function () { seat.busy = seat.tricking = false; });
  };

  PokerTable.prototype.chipRiffle = function (seat, done) {
    var self = this, h = seat.hands.chip, base = seat.stackAt, p = seat.perp;
    var colA = seat.stack[0].col;
    var left = seat.stack.filter(function (c) { return c.col === colA; });
    var right = seat.stack.filter(function (c) { return c.col !== colA; });
    var L = along(base, seat.dir, p, 0, -4.4), R = along(base, seat.dir, p, 0, 4.4);
    var hover = along(base, seat.dir, p, -4, 0);
    function splitSpot(c) {
      return left.indexOf(c) >= 0 ? stackSpot(L, left.indexOf(c)) : stackSpot(R, right.indexOf(c));
    }
    var merged = [];
    left.forEach(function (c, k) { merged.push(c); if (right[k]) merged.push(right[k]); });
    chain([
      function (next) { self.moveHand(h, hover, 600, next); },
      // 1. split the stack into two equal stacks
      function (next) {
        var from = seat.stack.map(function (c, k) { return stackSpot(base, k); });
        var to = seat.stack.map(splitSpot);
        self.tl.tween(1000, function (t) {
          var e = easeInOut(t);
          seat.stack.forEach(function (c, k) { var q = mix(from[k], to[k], e); place(c, q.x, q.y - Math.sin(Math.PI * t) * 2); });
        }, next);
      },
      // 2. middle finger lifts the inner edges, outside fingers squeeze: the stacks shimmy into one
      function (next) {
        var from = merged.map(splitSpot), to = merged.map(function (c, k) { return stackSpot(base, k); });
        merged.forEach(function (c) { seat.stackG.appendChild(c); });
        self.tl.tween(1600, function (t) {
          var e = easeInOut(t), wobble = Math.sin(Math.PI * 6 * t) * 0.8 * (1 - t), lift = Math.sin(Math.PI * t);
          merged.forEach(function (c, k) {
            var q = mix(from[k], to[k], e);
            place(c, q.x + p.x * wobble, q.y + p.y * wobble - lift * 1.2, 0, 1, 1 - 0.25 * lift);
          });
          self.placeHand(h, hover.x, hover.y + lift * 1.2, 1 - 0.22 * lift);
        }, function () { seat.stack = merged; self.layStack(seat); next(); });
      },
      function (next) { self.moveHand(h, seat.chipHome, 700, next); }
    ], done);
  };

  PokerTable.prototype.thumbFlip = function (seat, done) {
    var self = this, h = seat.hands.chip, k = seat.stack.length - 1, chip = seat.stack[k];
    var at = stackSpot(seat.stackAt, k), near = along(seat.stackAt, seat.dir, seat.perp, -3, 0);
    near.y -= 4;
    chain([
      function (next) { self.moveHand(h, near, 600, next); },
      function (next) {
        self.floatLayer.appendChild(chip);
        self.tl.tween(2000, function (t) {
          var f = (t * 2) % 1; // two flips
          place(chip, at.x, at.y - Math.sin(Math.PI * f) * 5, 0, 1, Math.cos(Math.PI * 2 * f));
          self.placeHand(h, near.x, near.y - Math.sin(Math.PI * f) * 0.9);
        }, function () { self.layStack(seat); next(); });
      },
      function (next) { self.moveHand(h, seat.chipHome, 600, next); }
    ], done);
  };

  PokerTable.prototype.knuckleRoll = function (seat, done) {
    var self = this, h = seat.hands.chip, k = seat.stack.length - 1, chip = seat.stack[k];
    var at = stackSpot(seat.stackAt, k);
    var spot = along(seat.stackAt, seat.dir, seat.perp, -4, 10 * seat.side);
    spot.y -= 5;
    function chipTo(a, b, ms, next) {
      self.tl.tween(ms, function (t) {
        var q = mix(a, b, easeInOut(t));
        place(chip, q.x, q.y - Math.sin(Math.PI * t) * 2, h.angle);
      }, next);
    }
    chain([
      function (next) { self.moveHand(h, spot, 600, next); },
      // thumb pushes the chip up onto the index finger
      function (next) { self.floatLayer.appendChild(chip); chipTo(at, self.handPoint(h, 3.4, KNUCKLES[0]), 600, next); },
      // each finger lifts, catches the edge and flips it over to the next knuckle
      function (next) {
        var pts = KNUCKLES.map(function (fy) { return self.handPoint(h, 3.4, fy); });
        self.tl.tween(2700, function (t) {
          var seg = Math.min(2.999, t * 3), i = Math.floor(seg), f = seg - i;
          var q = mix(pts[i], pts[i + 1], f);
          place(chip, q.x, q.y - Math.sin(Math.PI * f) * 1.8, h.angle, Math.cos(Math.PI * f), 0.8);
        }, next);
      },
      // pinky tips it under the hand and back to the thumb
      function (next) {
        chip.style.opacity = "0.35";
        chipTo(self.handPoint(h, 3.4, KNUCKLES[3]), self.handPoint(h, 1.2, -3.6), 700, function () { chip.style.opacity = ""; next(); });
      },
      function (next) { chipTo(self.handPoint(h, 1.2, -3.6), at, 600, function () { self.layStack(seat); next(); }); },
      function (next) { self.moveHand(h, seat.chipHome, 600, next); }
    ], done);
  };

  PokerTable.prototype.peekCards = function (seat, done) {
    var self = this, h = seat.hands.card, cards = seat.hole;
    var over = along(mix(cards[0], cards[1], 0.5), seat.dir, seat.perp, -4, 0);
    chain([
      function (next) { self.moveHand(h, over, 700, next); },
      function (next) {
        self.tl.tween(1600, function (t) {
          var lift = Math.sin(Math.PI * t);
          cards.forEach(function (c) { self.drawCard(c, lift); });
        }, next);
      },
      function (next) { self.moveHand(h, seat.cardHome, 700, next); }
    ], done);
  };

  // ---- start ----
  var poker = new PokerTable(table);
  // static first frame: a full hand at showdown (also the reduced-motion view)
  poker.tl.instant = true;
  poker.playHand(false);
  poker.tl.instant = false;
  if (A.reduceMotion) return;
  var started = false;
  A.animateWhileVisible(table, function (now, dt) { poker.tl.tick(dt); }, function () {
    if (started) return;
    started = true;
    poker.playHand(true);
    (function tricks() {
      poker.trick();
      poker.tl.after(randIn(TRICK_GAP_MS[0], TRICK_GAP_MS[1]), tricks);
    })();
  });
})();
