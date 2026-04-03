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

  const getThemeColors = () => {
    const isBlack = body.dataset.theme === "black";
    return isBlack
      ? [hexToRgb("#F0B43F"), hexToRgb("#E08830"), hexToRgb("#D4A040"), hexToRgb("#C87020")]
      : [hexToRgb("#c4b550"), hexToRgb("#8a9a3e"), hexToRgb("#a0a848"), hexToRgb("#7d8a30")];
  };

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

  const stored = localStorage.getItem("portfolio-theme");
  const setTheme = (theme) => {
    const isBlack = theme === "black";
    themeStylesheet.setAttribute(
      "href",
      isBlack
        ? "./styles/blacksteam/blacksteam.css"
        : "./styles/greensteam/greensteam.css"
    );
    body.dataset.theme = isBlack ? "black" : "green";
    themeToggle.setAttribute("aria-pressed", String(isBlack));
    themeToggle.setAttribute(
      "aria-label",
      isBlack ? "Switch to green theme" : "Switch to dark theme"
    );
    localStorage.setItem("portfolio-theme", isBlack ? "black" : "green");
  };

  setTheme(stored === "black" ? "black" : "green");

  themeToggle.addEventListener("click", () => {
    const nextTheme = body.dataset.theme === "black" ? "green" : "black";
    setTheme(nextTheme);
  });
};

const initProjectScroller = () => {
  const track = document.querySelector("#projectsTrack");
  const prev = document.querySelector("#projectsPrev");
  const next = document.querySelector("#projectsNext");

  if (!track || !prev || !next) return;

  const amount = 320;
  prev.addEventListener("click", () => {
    track.scrollBy({ left: -amount, behavior: "smooth" });
  });
  next.addEventListener("click", () => {
    track.scrollBy({ left: amount, behavior: "smooth" });
  });
};

const initMarquee = () => {
  const track = document.querySelector("[data-marquee]");
  if (!track) return;

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

  gsap.utils.toArray(".window, .window-row").forEach((el) => {
    if (el.id === "top") return;
    gsap.from(el, {
      y: 20,
      opacity: 0,
      duration: 0.6,
      scrollTrigger: {
        trigger: el,
        start: "top 84%",
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

splitText("[data-split]");
initThemeToggle();
initProjectScroller();
initMarquee();
initAnimations();
initActiveNav();
