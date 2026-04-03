const body = document.body;
body.classList.add("has-js");

const initBgCanvas = () => {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const CELL = 6;
  const GAP = 2;
  const STEP = CELL + GAP;
  let cols, rows, grid, next, fade;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(window.innerWidth / STEP) + 2;
    rows = Math.ceil(window.innerHeight / STEP) + 2;
    grid = new Uint8Array(cols * rows);
    next = new Uint8Array(cols * rows);
    fade = new Float32Array(cols * rows);
    seed();
  };

  const seed = () => {
    for (let i = 0; i < grid.length; i++) {
      grid[i] = Math.random() < 0.12 ? 1 : 0;
      fade[i] = grid[i] ? 1.0 : 0;
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
          fade[i] = Math.min(fade[i] + 0.15, 1.0);
        } else {
          fade[i] = Math.max(fade[i] - 0.04, 0);
        }
      }
    }
    [grid, next] = [next, grid];
  };

  const getColors = () => {
    const isBlack = body.dataset.theme === "black";
    return isBlack
      ? ["#F0B43F", "#E08830", "#D4A040"]
      : ["#c4b550", "#8a9a3e", "#a0a848"];
  };

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const colors = getColors();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (fade[i] <= 0.01) continue;
        const color = colors[(x * 7 + y * 13) % colors.length];
        ctx.globalAlpha = fade[i];
        ctx.fillStyle = color;
        ctx.fillRect(x * STEP, y * STEP, CELL, CELL);
      }
    }
    ctx.globalAlpha = 1;
  };

  let frameCount = 0;
  const loop = () => {
    frameCount++;
    if (frameCount % 6 === 0) step();
    draw();
    requestAnimationFrame(loop);
  };

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
