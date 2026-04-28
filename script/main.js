const body = document.body;
body.classList.add("has-js");

const initBgCanvas = () => {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const CELL = 7;
  const GAP = 3;
  const STEP = CELL + GAP;
  const ISO_H = 3;
  let cols, rows, grid, next, fade, ripple, age;
  let mouseX = -1, mouseY = -1;
  let time = 0;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(window.innerWidth / STEP) + 4;
    rows = Math.ceil(window.innerHeight / STEP) + 4;
    const len = cols * rows;
    grid = new Uint8Array(len);
    next = new Uint8Array(len);
    fade = new Float32Array(len);
    ripple = new Float32Array(len);
    age = new Float32Array(len);
    seed();
  };

  const seed = () => {
    for (let i = 0; i < grid.length; i++) {
      grid[i] = Math.random() < 0.12 ? 1 : 0;
      fade[i] = grid[i] ? 1.0 : 0;
      ripple[i] = 0;
      age[i] = 0;
    }
  };

  const PATTERNS = [
    { name: "glider", cells: [[0,1],[1,2],[2,0],[2,1],[2,2]] },
    { name: "lwss", cells: [[0,1],[0,3],[1,4],[2,0],[2,4],[3,1],[3,2],[3,3],[3,4]] },
    { name: "rpentomino", cells: [[0,1],[0,2],[1,0],[1,1],[2,1]] },
    { name: "pulsar_seed", cells: [[0,0],[0,1],[0,2],[1,0],[2,0],[2,1],[2,2]] },
  ];

  const spawnPattern = () => {
    const pat = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    const ox = Math.floor(Math.random() * (cols - 10)) + 3;
    const oy = Math.floor(Math.random() * (rows - 10)) + 3;
    for (const [dy, dx] of pat.cells) {
      const i = (oy + dy) * cols + (ox + dx);
      if (i >= 0 && i < grid.length) {
        grid[i] = 1;
        fade[i] = 0.3;
        ripple[i] = 1.0;
      }
    }
  };

  const neighbors = (x, y) => {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + cols) % cols;
        const ny = (y + dy + rows) % rows;
        if (grid[ny * cols + nx]) count++;
      }
    }
    return count;
  };

  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const easeIn = (t) => t * t * t;

  const step = () => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const n = neighbors(x, y);
        const alive = grid[i];
        if (alive) {
          next[i] = (n === 2 || n === 3) ? 1 : 0;
        } else {
          next[i] = (n === 3) ? 1 : 0;
        }
        if (next[i]) {
          fade[i] = Math.min(fade[i] + 0.12, 1.0);
          if (!alive) {
            ripple[i] = 1.0;
            age[i] = 0;
          }
          age[i] += 0.02;
        } else {
          fade[i] = Math.max(fade[i] - 0.025, 0);
        }
        ripple[i] *= 0.85;
      }
    }
    // ripple propagation
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const i = y * cols + x;
        if (ripple[i] > 0.3) {
          const spread = ripple[i] * 0.15;
          ripple[i - 1] = Math.max(ripple[i - 1], spread);
          ripple[i + 1] = Math.max(ripple[i + 1], spread);
          ripple[i - cols] = Math.max(ripple[i - cols], spread);
          ripple[i + cols] = Math.max(ripple[i + cols], spread);
        }
      }
    }
    [grid, next] = [next, grid];
  };

  const hexToRgb = (hex) => {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };

  const lerpColor = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];

  const THEME_PALETTES = {
    black: [hexToRgb("#F0B43F"), hexToRgb("#E08830"), hexToRgb("#D4A040"), hexToRgb("#C87020")],
    moonlight: [hexToRgb("#d9d1b3"), hexToRgb("#87909b"), hexToRgb("#c0a56d"), hexToRgb("#4f6574")],
    green: [hexToRgb("#c4b550"), hexToRgb("#8a9a3e"), hexToRgb("#a0a848"), hexToRgb("#7d8a30")],
  };
  let cachedColors = THEME_PALETTES[body.dataset.theme] || THEME_PALETTES.green;
  let cachedTheme = body.dataset.theme;

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const colors = getThemeColors();
    // mouse glow radius
    const driftX = Math.sin(time * 0.0003) * 4;
    const driftY = Math.cos(time * 0.0002) * 3;
    const MOUSE_R = 120;
    const MOUSE_R2 = MOUSE_R * MOUSE_R;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const f = fade[i];
        const r = ripple[i];
        if (f <= 0.005 && r <= 0.005) continue;

        const px = x * STEP + driftX;
        const py = y * STEP + driftY;

        // mouse proximity boost
        let mouseBright = 0;
        if (mouseX >= 0) {
          const mdx = px - mouseX;
          const mdy = py - mouseY;
          const md2 = mdx * mdx + mdy * mdy;
          if (md2 < MOUSE_R2) {
            mouseBright = (1 - md2 / MOUSE_R2) * 0.4;
          }
        }

        // color shimmer: cycle through palette over time
        const shimmer = (time * 0.0006 + x * 0.05 + y * 0.03) % colors.length;
        const ci = Math.floor(shimmer);
        const cf = shimmer - ci;
        const smoothT = cf * cf * (3 - 2 * cf); // smoothstep
        const colA = colors[ci % colors.length];
        const colB = colors[(ci + 1) % colors.length];
        const col = lerpColor(colA, colB, smoothT);

        // eased alpha
        const easedFade = easeOut(Math.min(f, 1));
        const alpha = Math.min(easedFade + r * 0.3 + mouseBright, 1);

        if (alpha < 0.01) continue;

        // height based on fade + ripple
        const h = (easedFade + r * 0.5) * ISO_H;
        const bright = 1.0 + r * 0.25 + mouseBright;

        ctx.globalAlpha = alpha;

        // shadow
        if (h > 0.5) {
          ctx.fillStyle = `rgba(0,0,0,0.18)`;
          ctx.fillRect(px + 1, py + 1, CELL, CELL);
        }

        // top face (brightest)
        const tr = Math.min(col[0] * bright, 255) | 0;
        const tg = Math.min(col[1] * bright, 255) | 0;
        const tb = Math.min(col[2] * bright, 255) | 0;
        ctx.fillStyle = `rgb(${tr},${tg},${tb})`;
        ctx.fillRect(px, py - h, CELL, CELL);

        // right face (darker)
        if (h > 0.5) {
          const dr = (col[0] * 0.65) | 0;
          const dg = (col[1] * 0.65) | 0;
          const db = (col[2] * 0.65) | 0;
          ctx.fillStyle = `rgb(${dr},${dg},${db})`;
          ctx.fillRect(px, py - h + CELL, CELL, Math.ceil(h));
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  let frameCount = 0;
  let spawnTimer = 0;

  const loop = (ts) => {
    time = ts || 0;
    frameCount++;
    if (frameCount % 6 === 0) {
      step();
      spawnTimer++;
      if (spawnTimer % 30 === 0) spawnPattern();
    }
    draw();
    requestAnimationFrame(loop);
  };

  canvas.parentElement.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  canvas.parentElement.addEventListener("mouseleave", () => {
    mouseX = -1;
    mouseY = -1;
  });
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);
};

initBgCanvas();

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const splitText = (selector) => {
  document.querySelectorAll(selector).forEach((el) => {
    const text = el.textContent ?? "";
    const chars = [...text];
    el.innerHTML = "";
    chars.forEach((char) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = char === " " ? "\u00A0" : char;
      el.appendChild(span);
    });
  });
};

const initThemeToggle = () => {
  const themeToggle = document.querySelector("#themeToggle");
  const themeStylesheet = document.querySelector("#themeStylesheet");
  if (!themeToggle || !themeStylesheet) return;

  const THEMES = ["moonlight", "green", "black"];
  const THEME_CSS = {
    moonlight: "./styles/greensteam/greensteam.css",
    green: "./styles/greensteam/greensteam.css",
    black: "./styles/blacksteam/blacksteam.css",
  };
  const THEME_LABELS = {
    moonlight: "Switch to green theme",
    green: "Switch to dark theme",
    black: "Switch to moonlight theme",
  };

  const stored = localStorage.getItem("portfolio-theme");
  const setTheme = (theme) => {
    if (!THEMES.includes(theme)) theme = "green";
    themeStylesheet.setAttribute("href", THEME_CSS[theme]);
    body.dataset.theme = theme;
    themeToggle.setAttribute("aria-pressed", String(theme !== "green"));
    themeToggle.setAttribute("aria-label", THEME_LABELS[theme]);
    localStorage.setItem("portfolio-theme", theme);
  };

  setTheme(THEMES.includes(stored) ? stored : "green");

  themeToggle.addEventListener("click", () => {
    const current = body.dataset.theme;
    const idx = THEMES.indexOf(current);
    const nextTheme = THEMES[(idx + 1) % THEMES.length];
    setTheme(nextTheme);
  });
};


const initMarquee = () => {
  const track = document.querySelector("[data-marquee]");
  if (!track) return;

  // inject dynamic info spans
  const timeSpan = document.createElement("span");
  timeSpan.className = "marquee-dynamic";
  const updateTime = () => {
    const now = new Date();
    timeSpan.textContent = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };
  updateTime();
  setInterval(updateTime, 60000);

  const locSpan = document.createElement("span");
  locSpan.textContent = "New Brunswick, NJ";

  const coordSpan = document.createElement("span");
  coordSpan.textContent = "40.4862\u00b0 N, 74.4518\u00b0 W";

  const tempSpan = document.createElement("span");
  tempSpan.textContent = "Loading...";

  fetch("https://api.open-meteo.com/v1/forecast?latitude=40.4862&longitude=-74.4518&current_weather=true&temperature_unit=fahrenheit")
    .then((r) => r.json())
    .then((data) => {
      if (data.current_weather) {
        tempSpan.textContent = `${Math.round(data.current_weather.temperature)}\u00b0F`;
      }
    })
    .catch(() => { tempSpan.textContent = "--\u00b0F"; });

  // insert dynamic spans among the tech skills
  const children = [...track.children];
  const insertAt = Math.min(3, children.length);
  track.insertBefore(tempSpan, children[insertAt] || null);
  track.insertBefore(coordSpan, tempSpan);
  track.insertBefore(locSpan, coordSpan);
  track.insertBefore(timeSpan, locSpan);

  const clone = track.innerHTML;
  track.insertAdjacentHTML("beforeend", clone);

  if (prefersReducedMotion) return;
  let x = 0;
  const step = () => {
    x -= 0.35;
    if (Math.abs(x) > track.scrollWidth / 2) x = 0;
    track.style.transform = `translate3d(${x}px,0,0)`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const initAnimations = () => {
  if (!window.gsap) {
    document.querySelectorAll(".reveal").forEach((el) => {
      el.style.opacity = "1";
    });
    return;
  }

  const gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  if (prefersReducedMotion) {
    gsap.set(".reveal", { opacity: 1 });
    return;
  }

  gsap.set(".reveal", { opacity: 1 });

  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  intro
    .from("nav li", {
      y: -18,
      opacity: 0,
      duration: 0.45,
      stagger: 0.05,
    })
    .from(
      ".hero-avatar",
      {
        y: 24,
        opacity: 0,
        duration: 0.5,
      },
      "-=0.2"
    )
    .from(
      ".hero-copy [data-split] .char",
      {
        y: 22,
        opacity: 0,
        stagger: 0.015,
        duration: 0.7,
      },
      "-=0.3"
    )
    .from(
      ".hero-copy p, .hero-copy .button-link",
      {
        y: 10,
        opacity: 0,
        duration: 0.4,
        stagger: 0.05,
      },
      "-=0.45"
    );

  gsap.utils.toArray(".window").forEach((el) => {
    if (el.id === "top") return;
    gsap.from(el, {
      y: 20,
      opacity: 0,
      duration: 0.6,
      scrollTrigger: {
        trigger: el,
        start: "top 95%",
      },
    });
  });
};

const initActiveNav = () => {
  const links = [...document.querySelectorAll("nav a[href^='#']")];
  const byId = new Map(
    links.map((link) => [link.getAttribute("href")?.slice(1), link])
  );
  const sections = [...byId.keys()]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.remove("active-link"));
        const target = byId.get(entry.target.id);
        if (target) target.classList.add("active-link");
      });
    },
    { threshold: 0.45 }
  );

  sections.forEach((section) => observer.observe(section));
};

const initWindowButtons = () => {
  const windows = document.querySelectorAll(".window:not(.headless)");
  const minimized = new Map();

  windows.forEach((win) => {
    if (win.id === "alt-hero") return;

    win.addEventListener("click", (e) => {
      const rect = win.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const style = getComputedStyle(win);
      const padTop = parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
      const padRight = parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth);

      // only clicks in the titlebar region (::before is 18px tall)
      if (y < padTop || y > padTop + 18) return;

      // x offset from right edge of the ::before element
      const fromRight = rect.width - padRight - x;

      // close button: 0-18px from right of ::before
      if (fromRight >= 0 && fromRight <= 18) {
        e.preventDefault();
        if (win.id === "top") {
          const altHero = document.getElementById("alt-hero");
          if (altHero) {
            win.style.display = "none";
            altHero.style.display = "";
            splitText("#alt-hero [data-split]");
          }
        } else {
          win.style.display = "none";
        }
        return;
      }

      // minimize button: 20-38px from right of ::before
      if (fromRight >= 20 && fromRight <= 38) {
        e.preventDefault();
        const content = [...win.children];
        if (minimized.has(win)) {
          const heights = minimized.get(win);
          content.forEach((child, i) => {
            child.style.display = heights[i];
          });
          minimized.delete(win);
        } else {
          const heights = content.map((child) => child.style.display);
          minimized.set(win, heights);
          content.forEach((child) => {
            child.style.display = "none";
          });
        }
        return;
      }
    });
  });
};

const initEasterEgg = () => {
  const restoreBtn = document.querySelector("#restore-hero");
  const heroWindow = document.querySelector("#top");
  const altHero = document.querySelector("#alt-hero");
  const marqueeShell = document.querySelector(".marquee-shell");
  if (!restoreBtn || !heroWindow || !altHero || !marqueeShell) return;

  const SEQUENCES = [
    ["F","J","F"],
    ["J","F","J"],
    ["F","F","J"],
    ["J","J","F"],
  ];

  const NOTE_SPACING = 110;
  const SPEED = 3.2;
  const HIT_X = 55;
  const HIT_WINDOW = 45;
  const NOTE_R = 16;
  const CANVAS_H = 100;
  const RED = "#c0392b";
  const BLUE = "#2980b9";
  const RED_DIM = "#7a2118";
  const BLUE_DIM = "#1a5276";

  let active = false;
  let animId = null;
  let canvas = null;
  let ctx = null;
  let taikoEl = null;
  let notes = [];
  let statusText = "";
  let statusColor = "";
  let statusTimer = 0;
  let hits = 0;
  let totalNotes = 0;
  let flashTime = 0;
  let flashColor = "";

  const startTaiko = () => {
    const seq = SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
    totalNotes = seq.length;
    hits = 0;
    active = true;
    statusText = "";
    statusTimer = 0;
    flashTime = 0;

    // build notes array — each note starts off-screen right
    const wrap = marqueeShell.querySelector(".marquee-wrap") || marqueeShell.querySelector(".inset");
    const wrapWidth = wrap.getBoundingClientRect().width || 600;
    notes = seq.map((key, i) => ({
      key,
      x: wrapWidth + 60 + i * NOTE_SPACING,
      hit: false,
      missed: false,
    }));

    // set up UI
    const titlebar = marqueeShell.querySelector(".titlebar");
    if (titlebar) titlebar.textContent = "Taiko Challenge";

    const track = wrap.querySelector(".marquee-track");
    if (track) track.style.display = "none";

    taikoEl = document.createElement("div");
    taikoEl.className = "taiko-game";
    taikoEl.innerHTML = `
      <p class="taiko-hint"><span class="taiko-key taiko-red">F</span> = Don (red) &nbsp; <span class="taiko-key taiko-blue">J</span> = Ka (blue)</p>
      <canvas class="taiko-canvas" height="${CANVAS_H}"></canvas>
      <p class="taiko-status"></p>
    `;
    wrap.style.overflow = "hidden";
    wrap.style.padding = "0";
    wrap.appendChild(taikoEl);

    canvas = taikoEl.querySelector(".taiko-canvas");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    marqueeShell.scrollIntoView({ behavior: "smooth", block: "center" });
    window.addEventListener("keydown", onKey);
    animId = requestAnimationFrame(tick);
  };

  const tick = () => {
    if (!active) return;
    const w = canvas.offsetWidth;
    const h = CANVAS_H;
    const cy = h / 2;

    // move notes
    for (const n of notes) {
      if (!n.hit) n.x -= SPEED;
      // missed: passed the hit zone
      if (!n.hit && !n.missed && n.x < HIT_X - HIT_WINDOW * 3) {
        n.missed = true;
        onMiss();
        return; // reset happens in onMiss
      }
    }

    // draw
    ctx.clearRect(0, 0, w, h);

    // lane line
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // hit target
    const pulseR = NOTE_R + 4 + Math.sin(Date.now() * 0.005) * 2;
    ctx.beginPath();
    ctx.arc(HIT_X, cy, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // hit window guide
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(HIT_X - HIT_WINDOW, 0, HIT_WINDOW * 2, h);

    // flash feedback
    if (flashTime > 0) {
      flashTime -= 0.05;
      ctx.beginPath();
      ctx.arc(HIT_X, cy, NOTE_R + 10, 0, Math.PI * 2);
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = flashTime * 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // notes
    for (const n of notes) {
      if (n.hit) continue;
      const isRed = n.key === "F";
      ctx.beginPath();
      ctx.arc(n.x, cy, NOTE_R, 0, Math.PI * 2);
      ctx.fillStyle = isRed ? RED : BLUE;
      ctx.fill();
      // letter
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.key, n.x, cy);
    }

    // status text
    const statusEl = taikoEl.querySelector(".taiko-status");
    if (statusEl) {
      statusEl.textContent = statusText;
      statusEl.style.color = statusColor;
    }

    // check completion
    if (hits >= totalNotes) {
      statusText = "Perfect!";
      statusColor = "var(--gd-accent)";
      if (statusEl) {
        statusEl.textContent = statusText;
        statusEl.style.color = statusColor;
      }
      active = false;
      window.removeEventListener("keydown", onKey);
      setTimeout(() => endTaiko(true), 800);
      return;
    }

    animId = requestAnimationFrame(tick);
  };

  const onKey = (e) => {
    if (!active) return;
    const key = e.key.toUpperCase();
    if (key !== "F" && key !== "J") return;
    e.preventDefault();

    // find the closest unhit note within the hit window
    let best = null;
    let bestDist = Infinity;
    for (const n of notes) {
      if (n.hit || n.missed) continue;
      const dist = Math.abs(n.x - HIT_X);
      if (dist < HIT_WINDOW && dist < bestDist) {
        best = n;
        bestDist = dist;
      }
    }

    if (!best) return; // no note in range

    if (best.key === key) {
      best.hit = true;
      hits++;
      flashTime = 1;
      flashColor = best.key === "F" ? RED : BLUE;
      statusText = "";
    } else {
      onMiss();
    }
  };

  const onMiss = () => {
    statusText = "Miss! Restarting...";
    statusColor = "#e05050";
    flashTime = 1;
    flashColor = "#e05050";
    active = false;
    window.removeEventListener("keydown", onKey);
    if (animId) cancelAnimationFrame(animId);

    setTimeout(() => {
      // restart
      if (taikoEl) taikoEl.remove();
      taikoEl = null;
      const wrap = marqueeShell.querySelector(".marquee-wrap") || marqueeShell.querySelector(".inset");
      wrap.style.overflow = "";
      wrap.style.padding = "";
      startTaiko();
    }, 1000);
  };

  const endTaiko = (success) => {
    if (animId) cancelAnimationFrame(animId);
    if (taikoEl) taikoEl.remove();
    taikoEl = null;
    canvas = null;
    ctx = null;

    const wrap = marqueeShell.querySelector(".marquee-wrap") || marqueeShell.querySelector(".inset");
    const track = wrap.querySelector(".marquee-track");
    if (track) track.style.display = "";
    wrap.style.overflow = "";
    wrap.style.padding = "";

    const titlebar = marqueeShell.querySelector(".titlebar");
    if (titlebar) titlebar.textContent = "Activity Feed";

    if (success) {
      altHero.style.display = "none";
      heroWindow.style.display = "";
      document.querySelectorAll(".window:not(.headless)").forEach((w) => {
        if (w.id === "alt-hero") return;
        w.style.display = "";
        [...w.children].forEach((child) => { child.style.display = ""; });
      });
      heroWindow.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  restoreBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!active) startTaiko();
  });
};

const initLightboxes = () => {
  document.querySelectorAll('.preview-modal-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dlg = document.getElementById(btn.dataset.modal);
      if (dlg && typeof dlg.showModal === 'function') {
        dlg.showModal();
      }
    });
  });

  document.querySelectorAll('dialog.media-modal').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      const rect = dlg.getBoundingClientRect();
      const insideContent =
        e.clientY >= rect.top && e.clientY <= rect.bottom &&
        e.clientX >= rect.left && e.clientX <= rect.right;
      if (!insideContent) dlg.close();
    });
    const closeBtn = dlg.querySelector('.media-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => dlg.close());
  });
};

splitText("[data-split]");
initThemeToggle();
initMarquee();
initAnimations();
initActiveNav();
initWindowButtons();
initEasterEgg();
initLightboxes();
