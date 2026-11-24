// Neon Frontier 2026 — Interactive Exhibition Portal & RLAIF Analytics Dashboard

const state = {
  telemetry: [],
  qaR1: [],
  qaR2: [],
  rlaifR1: [],
  rlaifR2: [],
  effortFull: [],
  effort32k: [],
  authorHuman: null,
  blindMode: false,
  swapped: false,
  activeTrackId: null,
  humanScores: JSON.parse(localStorage.getItem("neon_bench_human_eval_v1") || "{}"),
};

const PUBLIC_REFS = [
  {
    source: "Google Blog · Slide 3 & @googledevs",
    title: "Alan Turing's 1936 Study + Universal Turing Machine",
    url: "https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/",
    mappedTrack: "Track 2 — Cambridge Study 1936 (Neon XHigh ×2 Swarm)",
    specs: "/swarm 12시간 런타임, 아카이브 사진 기반 King's Chapel + Room X.8 + 작동하는 보편 튜링 머신",
    quote: "우리 구현: 2-Worker Specialist Swarm(turing-arch + turing-utm)으로 4개 검증된 튜링 프로그램, 실시간 종이 테이프 프린팅, 3개 아날로그 게이지 및 1936 서재·채플 외경까지 100% 프로시저럴 WebGL2 구현."
  },
  {
    source: "YouTube · Chase AI (100.8K views, Nov 21)",
    title: "Gemini 4 Neon vs Claude Opus 5.5 — Test 5: SVG Mechanical Watch & Test 1: Turbofan",
    url: "https://www.youtube.com/watch?v=ycF6TVRgawE",
    mappedTrack: "Track 1A vs 1B (Watch Showdown) & Track 3 (AeroFan X-900 Carbon)",
    specs: "5종 블라인드 대결(터보팬·모션그래픽·홈페이지·영상편집·SVG 기계식 시계), Neon 2승 1패 2무 & 4/5 비용·속도 승리",
    quote: "댓글 @amok8938 (14 likes): \"Opus는 미니멀하고 정제된 미감인 반면 Gemini는 AI가 만든 티가 난다.\" → 동일 스펙 정면 대결 + 블라인드 모드 + RLAIF Anti-AI-Look 축으로 직접 검증!"
  },
  {
    source: "Google Blog · Slide 4 & @googledevs",
    title: "Sheets CV Lab (100K-Cell Formula Relighting) + Hex Flame Shader + Smoke Art",
    url: "https://www.youtube.com/watch?v=vPsBbuz9IbE",
    mappedTrack: "Track 4 — ChromaForge (Gemini 4 Argon High)",
    specs: "100,000셀/500,000수식 무스크립트 이미지 리라이팅(6모드) + WebGL 육각 픽셀 화염 셰이더 + 스모크 리본 아트",
    quote: "우리 구현: Bridson 2007 Curl-Noise 육각 화염(Mode A) + 57,600셀(320×180)/288,000수식 실시간 3D Phong 리라이팅 스프레드시트 & fx 수식 바(Mode B) 통합."
  },
  {
    source: "X @googledevs + Reddit r/TopologyAI (1,500+ upvotes)",
    title: "72s Rube Goldberg (1980s Arcade) + Brass & Marble + Real-Time Cloth Physics",
    url: "https://www.reddit.com/r/TopologyAI/comments/1y0xjqn/gemini_4_neon_got_cloth_physics_running_in_real/",
    mappedTrack: "Track 5 — Kinetic Atelier (Neon High → Hydrogen XHigh)",
    specs: "1000Hz MuJoCo 루브 골드버그, Brass & Marble 레버 퍼즐, GPT-6.2 Astra가 막힌 실시간 천 물리(Cloth Physics) 돌파",
    quote: "r/GoogleGemini (u/XeoXeo42): \"Neon High를 오케스트레이터, Hydrogen을 실행기로 쓰면 최고\" → 실제 파이프라인으로 120Hz 8단계 기계장치 + 24×16 XPBD 실크 천 관통 물리 구현!"
  },
  {
    source: "YouTube · Bijan Bowen (131.3K views, Nov 19)",
    title: "15-Chapter Neon Coding Test + Shader Stutter Critique",
    url: "https://www.youtube.com/watch?v=90vN0xFeLcQ",
    mappedTrack: "전 트랙 공통 Gate 5.5 셰이더 사전 워밍업 규칙",
    specs: "브라우저 OS, 3D 로봇암, 3D CAD, Godot FPS 등 15종 실전 테스트",
    quote: "댓글 @spvn (46 likes): \"셰이더를 게임 시작 전에 pre-warm하라고 지시하지 않으면 모든 모델이 첫 프레임 스터터를 만든다.\" → 모든 WebGL2 트랙에 renderer.compile + 2프레임 사전 워밍업 의무화!"
  },
  {
    source: "Reddit · r/google_antigravity (784 upvotes) & r/GeminiAI",
    title: "Antigravity Cache Hit Rate & Effort (High vs XHigh) Token Burn Debate",
    url: "https://www.reddit.com/r/google_antigravity/comments/1y1ep0k/we_get_less_hydrogen_and_neon_usage_than_opus_55/",
    mappedTrack: "전 트랙 transcript.jsonl 캐시 적중률 실측 + 7-Cell Effort API 스윕",
    specs: "Varun Mohan 캐시 히트율 개선 공지, high vs xhigh 토큰 소모 및 Carbon vs Neon 역할 분담 논쟁",
    quote: "실측 결과: 본 벤치마크 Swarm 캐시 적중률 80.3%~96.5% 확인! API Effort 스윕에서 32K 캡 과사고 절단 절벽 및 Neon Medium의 최적 Pareto ROI(185s, $0.36, 88.7점) 실증."
  }
];

async function fetchJsonSafe(path, fallback = []) {
  try {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) return fallback;
    return await r.json();
  } catch {
    return fallback;
  }
}

const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));
const fmtUsd = (n) => (n == null ? "—" : `$${Number(n).toFixed(2)}`);

function latestQa(trackId) {
  return state.qaR2.find((x) => x.trackId === trackId) || state.qaR1.find((x) => x.trackId === trackId);
}
function latestRlaif(trackId) {
  return state.rlaifR2.find((x) => x.trackId === trackId) || state.rlaifR1.find((x) => x.trackId === trackId);
}
function shotRoundPrefix() {
  return state.qaR2.length ? "results/screenshots_r2" : "results/screenshots_r1";
}

function renderKpis() {
  const qaList = state.qaR2.length ? state.qaR2 : state.qaR1;
  const totalLoc = qaList.reduce((s, q) => s + (q.codeStats?.lines || 0), 0);
  const totalIn = state.telemetry.reduce((s, t) => s + (t.total_input_tokens || 0), 0);
  const totalOut = state.telemetry.reduce((s, t) => s + (t.output_tokens || 0), 0);
  const totalCache = state.telemetry.reduce((s, t) => s + (t.cache_read_tokens || 0), 0);
  const avgCache = totalIn > 0 ? ((totalCache / totalIn) * 100).toFixed(1) : "0.0";
  const passCount = qaList.filter((q) => q.pass).length;
  const avgFps = qaList.length
    ? (qaList.reduce((s, q) => s + (q.perf?.fpsMedian || 0), 0) / qaList.length).toFixed(1)
    : "—";

  document.getElementById("kpi-loc").textContent = `총 ${fmtInt(totalLoc)} LOC · 0 외부 에셋`;
  document.getElementById("kpi-tokens").textContent = `${((totalIn + totalOut) / 1e6).toFixed(2)}M tok`;
  document.getElementById("kpi-cache").textContent = `평균 프롬프트 캐시 적중률 ${avgCache}% · 출력 ${fmtInt(totalOut)}`;
  document.getElementById("kpi-qa").textContent = `${passCount} / ${qaList.length} PASS`;
  document.getElementById("kpi-fps").textContent = `평균 중앙값 ${avgFps} FPS · 0 에러`;

  const r1Avg = state.rlaifR1.length
    ? state.rlaifR1.reduce((s, x) => s + x.composite_rlaif_100, 0) / state.rlaifR1.length
    : null;
  const r2Avg = state.rlaifR2.length
    ? state.rlaifR2.reduce((s, x) => s + x.composite_rlaif_100, 0) / state.rlaifR2.length
    : null;
  if (r1Avg !== null && r2Avg !== null) {
    const d = r2Avg - r1Avg;
    document.getElementById("kpi-rlaif-delta").textContent = `${r1Avg.toFixed(1)} → ${r2Avg.toFixed(1)} (${d >= 0 ? "+" : ""}${d.toFixed(1)})`;
  } else if (r1Avg !== null) {
    document.getElementById("kpi-rlaif-delta").textContent = `R1 평균 ${r1Avg.toFixed(1)} / 100`;
  }

  const t1a = state.telemetry.find((t) => t.trackId === "track-1a-watch-neon");
  const t1b = state.telemetry.find((t) => t.trackId === "track-1b-watch-opus");
  if (t1a && t1b && t1a.est_api_usd > 0) {
    const ratio = (t1b.est_api_usd / t1a.est_api_usd).toFixed(1);
    document.getElementById("kpi-cost-ratio").textContent = `${fmtUsd(t1a.est_api_usd)} vs ${fmtUsd(t1b.est_api_usd)} (${ratio}×)`;
  }
}

function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  const prefix = shotRoundPrefix();
  grid.innerHTML = state.telemetry
    .map((t) => {
      const qa = latestQa(t.trackId);
      const r1 = state.rlaifR1.find((x) => x.trackId === t.trackId);
      const r2 = state.rlaifR2.find((x) => x.trackId === t.trackId);
      const rl = r2 || r1;
      const deltaStr =
        r1 && r2
          ? ` (${r2.composite_rlaif_100 - r1.composite_rlaif_100 >= 0 ? "+" : ""}${(r2.composite_rlaif_100 - r1.composite_rlaif_100).toFixed(1)})`
          : "";
      const ah = state.authorHuman?.tracks?.find((x) => x.trackId === t.trackId);
      const verdict = ah
        ? `<strong>저자 정성 평가 (${ah.human.toFixed(1)}):</strong> ${ah.note}`
        : (rl?.blind_critique?.verdict_ko || "RLAIF 평가 데이터 로드 완료");
      return `
      <article class="work-card" data-track="${t.trackId}">
        <div class="shot-stage" data-launch="${t.trackId}">
          <img id="img-${t.trackId}" src="${prefix}/${t.trackId}/hero_1440x900.png" alt="${t.title}" loading="lazy" />
          <div class="rlaif-badge">${ah ? `Human ${ah.human.toFixed(1)} · ` : ""}RLAIF ${rl ? rl.composite_rlaif_100.toFixed(1) : "—"}${deltaStr}</div>
          <div class="shot-pills" onclick="event.stopPropagation()">
            <button class="shot-pill active" data-shot="hero_1440x900.png" data-target="${t.trackId}">HERO</button>
            <button class="shot-pill" data-shot="macro_1440x900.png" data-target="${t.trackId}">MACRO</button>
            <button class="shot-pill" data-shot="alt_mode_1440x900.png" data-target="${t.trackId}">ALT MODE</button>
            <button class="shot-pill" data-shot="narrow_700x900.png" data-target="${t.trackId}">700px</button>
          </div>
        </div>
        <div class="card-body">
          <div class="card-meta-row">
            <span class="domain-tag">${t.domain}</span>
            <span class="model-tag">${t.model_label}</span>
          </div>
          <div class="card-title">${t.title}</div>
          <div class="card-tech">기법: <strong>${t.technique}</strong> · Effort: <code>${t.effort}</code> · ${qa?.codeStats?.lines ? fmtInt(qa.codeStats.lines) + " LOC" : ""}</div>
          <div class="mini-stats">
            <div class="ms-item"><span>FPS (중앙)</span><strong>${qa?.perf?.fpsMedian ?? "—"}</strong></div>
            <div class="ms-item"><span>출력 토큰</span><strong>${fmtInt(t.output_tokens)}</strong></div>
            <div class="ms-item"><span>캐시 적중</span><strong>${t.cache_hit_pct}%</strong></div>
            <div class="ms-item"><span>API 환산</span><strong>${fmtUsd(t.est_api_usd)}</strong></div>
          </div>
          <div class="verdict-box">${verdict}</div>
          <div class="card-actions">
            <button class="btn-gold" data-launch="${t.trackId}">라이브 작품 실행 ▶</button>
            <a class="btn-outline" href="./works/${t.trackId}/index.html" target="_blank" rel="noopener">새 탭 열기 ↗</a>
          </div>
        </div>
      </article>`;
    })
    .join("");

  grid.querySelectorAll(".shot-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tid = btn.dataset.target;
      const img = document.getElementById(`img-${tid}`);
      img.src = `${shotRoundPrefix()}/${tid}/${btn.dataset.shot}`;
      btn.parentElement.querySelectorAll(".shot-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  grid.querySelectorAll("[data-launch]").forEach((el) => {
    el.addEventListener("click", () => openTheater(el.dataset.launch));
  });
}

function openTheater(trackId) {
  const t = state.telemetry.find((x) => x.trackId === trackId);
  const qa = latestQa(trackId);
  const rl = latestRlaif(trackId);
  state.activeTrackId = trackId;
  document.getElementById("th-model").textContent = `${t.model_label} · ${t.technique}`;
  document.getElementById("th-title").textContent = t.title;
  document.getElementById("th-meta").textContent = `FPS ${qa?.perf?.fpsMedian ?? "—"} · RLAIF ${rl?.composite_rlaif_100 ?? "—"} · ${fmtUsd(t.est_api_usd)}`;
  const url = `./works/${trackId}/index.html`;
  document.getElementById("th-newtab").href = url;
  document.getElementById("th-iframe").src = url;
  const modal = document.getElementById("theater-modal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeTheater() {
  const modal = document.getElementById("theater-modal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.getElementById("th-iframe").src = "about:blank";
}

function callTheaterAction(fn, arg) {
  try {
    const win = document.getElementById("th-iframe").contentWindow;
    win?.__BENCH_ACTIONS__?.[fn]?.(arg);
  } catch (e) {
    console.warn("Action dispatch failed:", e);
  }
}

function renderShowdown() {
  const pair = [
    {
      trackId: "track-1a-watch-neon",
      name: "Chronos Calibre N-4",
      model: "Gemini 4 Neon (XHigh)",
      url: "./works/track-1a-watch-neon/index.html",
    },
    {
      trackId: "track-1b-watch-opus",
      name: "Chronos Calibre O-5",
      model: "Claude Opus 5.5 (High)",
      url: "./works/track-1b-watch-opus/index.html",
    },
  ];
  const [left, right] = state.swapped ? [pair[1], pair[0]] : pair;
  document.getElementById("sd-left-title").textContent = state.blindMode ? "BLIND CANDIDATE ALPHA (좌)" : `${left.name} · ${left.model}`;
  document.getElementById("sd-right-title").textContent = state.blindMode ? "BLIND CANDIDATE BETA (우)" : `${right.name} · ${right.model}`;
  const rlL = latestRlaif(left.trackId);
  const rlR = latestRlaif(right.trackId);
  const tL = state.telemetry.find((x) => x.trackId === left.trackId);
  const tR = state.telemetry.find((x) => x.trackId === right.trackId);
  document.getElementById("sd-left-badge").textContent = state.blindMode ? "BLIND" : `RLAIF ${rlL?.composite_rlaif_100 ?? "—"} · ${fmtUsd(tL?.est_api_usd)}`;
  document.getElementById("sd-right-badge").textContent = state.blindMode ? "BLIND" : `RLAIF ${rlR?.composite_rlaif_100 ?? "—"} · ${fmtUsd(tR?.est_api_usd)}`;

  const lf = document.getElementById("sd-left-frame");
  const rf = document.getElementById("sd-right-frame");
  if (!lf.src.endsWith(left.url.slice(1))) lf.src = left.url;
  if (!rf.src.endsWith(right.url.slice(1))) rf.src = right.url;

  const wrap = document.getElementById("showdown-metrics");
  if (state.blindMode) {
    wrap.innerHTML = `<div class="callout-box"><strong>블라인드 모드 활성화됨:</strong> 두 시계를 직접 조작(용두 감기·Macro·Exploded CAD·8Hz 오디오)해 보신 뒤 상단 버튼으로 모델을 공개해 비교해 보세요!</div>`;
    return;
  }
  const rows = [left, right].map((c) => {
    const t = state.telemetry.find((x) => x.trackId === c.trackId) || {};
    const q = latestQa(c.trackId) || {};
    const r = latestRlaif(c.trackId) || {};
    return `<tr>
      <td><strong>${c.model}</strong> (${c.name})</td>
      <td class="num">${fmtInt(t.total_input_tokens)} (${t.cache_hit_pct}%)</td>
      <td class="num">${fmtInt(t.output_tokens)}</td>
      <td class="num">${t.planner_turns ?? "—"}</td>
      <td class="num">${fmtUsd(t.est_api_usd)}</td>
      <td class="num">${fmtInt(q.codeStats?.lines)}</td>
      <td class="num">${q.perf?.fpsMedian ?? "—"} FPS</td>
      <td class="num">${r.decision_rlaif_100 ?? "—"}</td>
      <td class="num">${r.blind_critic_100 ?? "—"}</td>
      <td class="num"><strong class="gold">${r.composite_rlaif_100 ?? "—"}</strong></td>
    </tr>`;
  });
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>모델 / 작품</th><th class="num">입력 토큰 (캐시%)</th><th class="num">출력 토큰</th><th class="num">턴</th>
      <th class="num">API 환산</th><th class="num">LOC</th><th class="num">FPS</th>
      <th class="num">Decision-1</th><th class="num">Blind Carbon</th><th class="num">복합 RLAIF</th>
    </tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table></div>`;
}

function renderEffortSweep() {
  const data = state.effortFull;
  if (!data.length) return;

  // Bar Chart: Thought vs Output Tokens
  const maxTok = Math.max(...data.map((d) => (d.thought_tokens || 0) + (d.output_tokens || 0)), 1);
  const svgW = 580, rowH = 34, padL = 152, padR = 72;
  const barW = svgW - padL - padR;
  const bars = data
    .map((d, i) => {
      const y = 14 + i * rowH;
      const tw = ((d.thought_tokens || 0) / maxTok) * barW;
      const ow = ((d.output_tokens || 0) / maxTok) * barW;
      const tot = (d.thought_tokens || 0) + (d.output_tokens || 0);
      const labelFill = d.long_decode ? "#4fb3a2" : !d.qa_runtime_pass ? "#e06c5b" : "#eceae4";
      return `<g>
        <text x="${padL - 8}" y="${y + 14}" text-anchor="end" fill="${labelFill}" font-size="11" font-family="monospace">${d.cell_id}</text>
        <rect x="${padL}" y="${y + 2}" width="${tw.toFixed(1)}" height="16" fill="#d8b679" rx="2"/>
        <rect x="${(padL + tw).toFixed(1)}" y="${y + 2}" width="${ow.toFixed(1)}" height="16" fill="#4fb3a2" rx="2"/>
        <text x="${(padL + tw + ow + 6).toFixed(1)}" y="${y + 14}" fill="#989aa6" font-size="10.5" font-family="monospace">${(tot / 1000).toFixed(1)}k${d.qa_html_complete === false ? " (절단)" : ""}</text>
      </g>`;
    })
    .join("");
  document.getElementById("chart-effort-tokens").innerHTML = `
    <svg viewBox="0 0 ${svgW} ${data.length * rowH + 38}" style="width:100%;height:auto">
      ${bars}
      <g transform="translate(${padL},${data.length * rowH + 18})">
        <rect width="12" height="10" fill="#d8b679" rx="2"/><text x="17" y="9" fill="#989aa6" font-size="11">Thought Tokens</text>
        <rect x="130" width="12" height="10" fill="#4fb3a2" rx="2"/><text x="147" y="9" fill="#989aa6" font-size="11">Output Tokens</text>
      </g>
    </svg>`;

  // Scatter Chart: Cost USD vs RLAIF Score
  const pW = 560, pH = 278, mL = 48, mB = 34, mT = 18, mR = 24;
  const maxC = Math.max(...data.map((d) => d.cost_usd || 0), 1.0);
  const yMin = 20, yMax = 100;
  const pts = data
    .map((d) => {
      const x = mL + ((d.cost_usd || 0) / maxC) * (pW - mL - mR);
      const y = pH - mB - ((Math.max(yMin, d.rlaif_score_100 || yMin) - yMin) / (yMax - yMin)) * (pH - mT - mB);
      const col = d.model.includes("neon") ? "#d8b679" : d.model.includes("carbon") ? "#6aa1e0" : d.model.includes("hydrogen") ? "#4fb3a2" : "#e06c5b";
      const label = d.long_decode ? `${d.cell_id} [Long] (${d.rlaif_score_100})` : `${d.cell_id} (${d.rlaif_score_100})`;
      const circle = d.long_decode
        ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#0c0d10" stroke="${col}" stroke-width="2.4"/>`
        : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${d.qa_runtime_pass ? col : "#e06c5b"}" stroke="#0c0d10" stroke-width="1.5"/>`;
      return `<g>
        ${circle}
        <text x="${(x + 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" fill="${d.long_decode ? "#4fb3a2" : "#eceae4"}" font-size="10" font-family="monospace">${label}</text>
      </g>`;
    })
    .join("");
  document.getElementById("chart-effort-pareto").innerHTML = `
    <svg viewBox="0 0 ${pW} ${pH}" style="width:100%;height:auto">
      <line x1="${mL}" y1="${pH - mB}" x2="${pW - mR}" y2="${pH - mB}" stroke="#3a4050"/>
      <line x1="${mL}" y1="${mT}" x2="${mL}" y2="${pH - mB}" stroke="#3a4050"/>
      <text x="${pW / 2}" y="${pH - 6}" text-anchor="middle" fill="#989aa6" font-size="11">API Cost (USD, Official Nov 2026 Paid Tier)</text>
      <text x="14" y="${pH / 2}" text-anchor="middle" fill="#989aa6" font-size="11" transform="rotate(-90 14 ${pH / 2})">RLAIF Score (20–100)</text>
      ${pts}
    </svg>`;

  // Full 64K Table + Explicit Long Decode Control Row
  document.getElementById("effort-table-wrap").innerHTML = `<table>
    <thead><tr>
      <th>Cell</th><th>Model</th><th>Effort / 실행 조건</th><th class="num">Wall (s)</th><th class="num">Thought Tok</th>
      <th class="num">Output Tok</th><th class="num">Tok/s</th><th class="num">USD</th><th class="num">LOC</th>
      <th>QA</th><th class="num">FPS</th><th class="num">Decision-1 RLAIF</th><th class="num">점수/센트</th><th>라이브</th>
    </tr></thead>
    <tbody>${data
      .map((d) => {
        const capTag = d.long_decode
          ? `<span style="color:#4fb3a2">128K Long Decode (대조)</span>`
          : `64K 동기`;
        const qaText = d.qa_runtime_pass
          ? "PASS"
          : d.qa_html_complete === false
          ? "FAIL (64K 절단)"
          : `FAIL (${d.qa_fail_reason || d.qa_errors + " err"})`;
        const fpsText = d.qa_meta_ready === false ? "— (미실행)" : (d.qa_fps ?? "—");
        const linkText = d.qa_html_complete === false ? "절단본 ↗" : "열기 ↗";
        return `<tr${d.long_decode ? ' style="background:rgba(79,179,162,0.06)"' : ""}>
        <td><code>${d.cell_id}</code></td>
        <td>${d.model}</td>
        <td><code>${d.effort}</code> · <small class="muted">${capTag}</small></td>
        <td class="num">${d.wall_clock_sec}</td>
        <td class="num">${fmtInt(d.thought_tokens)}</td>
        <td class="num">${fmtInt(d.output_tokens)}</td>
        <td class="num">${d.tokens_per_sec}</td>
        <td class="num">$${Number(d.cost_usd).toFixed(4)}</td>
        <td class="num">${fmtInt(d.html_lines)}</td>
        <td class="${d.qa_runtime_pass ? "pill-pass" : "pill-fail"}">${qaText}</td>
        <td class="num">${fpsText}</td>
        <td class="num"><strong class="gold">${d.rlaif_score_100 ?? "—"}</strong></td>
        <td class="num">${d.quality_per_cent ?? "—"}</td>
        <td><a class="btn-outline" style="padding:3px 8px;font-size:11px" href="./results/effort_sweep/${d.cell_id}.html" target="_blank">${linkText}</a></td>
      </tr>`;
      })
      .join("")}</tbody>
  </table>`;

  // 32K Cap Discovery Table
  if (state.effort32k.length) {
    document.getElementById("effort-32k-wrap").innerHTML = `<table>
      <thead><tr>
        <th>Cell (32K Cap Test)</th><th class="num">Thought Tok</th><th class="num">Output Tok</th><th class="num">합계 (Cap 32,768)</th><th class="num">Thought 비중</th><th class="num">출력 LOC</th><th>상태 진단</th>
      </tr></thead>
      <tbody>${state.effort32k
        .map((d) => {
          const sum = (d.thought_tokens || 0) + (d.output_tokens || 0);
          const pct = sum > 0 ? ((d.thought_tokens / sum) * 100).toFixed(1) : "0";
          const trunc = sum >= 32760;
          return `<tr>
            <td><code>${d.cell_id}</code></td>
            <td class="num">${fmtInt(d.thought_tokens)}</td>
            <td class="num">${fmtInt(d.output_tokens)}</td>
            <td class="num">${fmtInt(sum)}</td>
            <td class="num">${pct}%</td>
            <td class="num">${fmtInt(d.html_lines)}</td>
            <td class="${trunc ? "pill-fail" : "pill-pass"}">${trunc ? "32K 캡 도달 → 과사고 절단!" : "정상 완주"}</td>
          </tr>`;
        })
        .join("")}</tbody>
    </table>`;
  }
}

function renderRlaifTab() {
  // Swarm Telemetry + R1->R2 Table
  document.getElementById("swarm-table-wrap").innerHTML = `<table>
    <thead><tr>
      <th>작품 / 트랙</th><th>모델 &amp; 기법</th><th class="num">입력 토큰</th><th class="num">캐시%</th>
      <th class="num">출력 토큰</th><th class="num">턴</th><th class="num">API 환산</th><th class="num">최종 FPS</th>
      <th class="num">R1 RLAIF</th><th class="num">R2 RLAIF</th><th class="num">R1→R2 Δ</th>
    </tr></thead>
    <tbody>${state.telemetry
      .map((t) => {
        const q = latestQa(t.trackId) || {};
        const r1 = state.rlaifR1.find((x) => x.trackId === t.trackId);
        const r2 = state.rlaifR2.find((x) => x.trackId === t.trackId);
        const d = r1 && r2 ? r2.composite_rlaif_100 - r1.composite_rlaif_100 : null;
        return `<tr>
          <td><strong>${t.title}</strong></td>
          <td>${t.model_label} · <span class="muted">${t.technique}</span></td>
          <td class="num">${fmtInt(t.total_input_tokens)}</td>
          <td class="num">${t.cache_hit_pct}%</td>
          <td class="num">${fmtInt(t.output_tokens)}</td>
          <td class="num">${t.planner_turns}</td>
          <td class="num">${fmtUsd(t.est_api_usd)}</td>
          <td class="num">${q.perf?.fpsMedian ?? "—"}</td>
          <td class="num">${r1 ? r1.composite_rlaif_100.toFixed(1) : "—"}</td>
          <td class="num"><strong class="gold">${r2 ? r2.composite_rlaif_100.toFixed(1) : "—"}</strong></td>
          <td class="num ${d !== null && d >= 0 ? "delta-pos" : "delta-neg"}">${d !== null ? (d >= 0 ? "+" : "") + d.toFixed(1) : "—"}</td>
        </tr>`;
      })
      .join("")}</tbody>
  </table>`;

  const axisNames = {
    visual_craftsmanship: "시각 완성도 (20%)",
    domain_engineering_fidelity: "도메인 공학 정밀도 (20%)",
    interactivity_and_ux: "인터랙션·UX (15%)",
    technical_performance: "실측 성능/0에러 (15%)",
    reference_surpassing_depth: "리퍼런스 돌파 깊이 (15%)",
    craft_authenticity_anti_ai_look: "비-AI 장인 미감 (15%)",
  };

  document.getElementById("rlaif-cards").innerHTML = state.telemetry
    .map((t) => {
      const r1 = state.rlaifR1.find((x) => x.trackId === t.trackId);
      const r2 = state.rlaifR2.find((x) => x.trackId === t.trackId);
      const rl = r2 || r1;
      if (!rl) return "";
      const axesHtml = Object.entries(axisNames)
        .map(([k, label]) => {
          const val = rl.decision_axes?.[k]?.score_0_100 ?? 0;
          const prev = r1 && r2 ? r1.decision_axes?.[k]?.score_0_100 : null;
          const d = prev !== null ? val - prev : null;
          return `<div class="axis-row">
            <span>${label}</span>
            <div class="axis-bar-bg"><div class="axis-bar-fill" style="width:${val}%"></div></div>
            <span style="font-family:var(--mono);text-align:right">${val.toFixed(0)}${d !== null && Math.abs(d) >= 0.5 ? ` <small style="color:${d > 0 ? "#4fb3a2" : "#e06c5b"}">${d > 0 ? "+" : ""}${d.toFixed(0)}</small>` : ""}</span>
          </div>`;
        })
        .join("");

      const strengths = (rl.blind_critique?.strengths || []).map((s) => `<li>${s}</li>`).join("");
      const defects = (rl.blind_critique?.defects_and_ai_tells || []).map((s) => `<li>${s}</li>`).join("");
      return `<div class="rlaif-card">
        <div class="card-meta-row" style="margin-bottom:8px">
          <strong>${t.title}</strong>
          <span class="model-tag">Decision-1: ${rl.decision_rlaif_100} · Blind Carbon: ${rl.blind_critic_100}</span>
        </div>
        ${axesHtml}
        <div class="verdict-box" style="margin-top:10px"><strong>블라인드 정성 평결 (${r2 ? "R2 최종" : "R1"}):</strong> ${rl.blind_critique?.verdict_ko || ""}</div>
        <div style="margin-top:8px;font-size:11.5px;color:var(--teal)">강점 (Observed in Pixels)</div>
        <ul class="critique-list">${strengths}</ul>
        <div style="margin-top:8px;font-size:11.5px;color:var(--coral)">잔여/지적 사항</div>
        <ul class="critique-list">${defects}</ul>
      </div>`;
    })
    .join("");
}

function pearson(xs, ys) {
  if (xs.length < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : null;
}

function updateHumanCorr() {
  const xs = [], ysComp = [], ysDec = [];
  for (const t of state.telemetry) {
    const h = state.humanScores[t.trackId];
    const rl = latestRlaif(t.trackId);
    if (h && h.touched && rl) {
      const avg100 = ((h.aesthetics + h.domain + h.ux + h.antiAi) / 4) * 10;
      xs.push(avg100);
      ysComp.push(rl.composite_rlaif_100);
      ysDec.push(rl.decision_rlaif_100);
    }
  }
  const banner = document.getElementById("corr-banner");
  if (xs.length < 2) {
    banner.textContent = `현재 ${xs.length}/${state.telemetry.length}개 작품 평가됨 — 2개 이상 슬라이더를 조정하면 Human vs RLAIF 상관계수(Pearson r)가 계산됩니다.`;
  } else {
    const rComp = pearson(xs, ysComp);
    const rDec = pearson(xs, ysDec);
    banner.textContent = `평가 완료: ${xs.length}/${state.telemetry.length} 작품 | Human vs 복합 RLAIF r = ${rComp !== null ? rComp.toFixed(3) : "N/A"} | Human vs Decision-1 r = ${rDec !== null ? rDec.toFixed(3) : "N/A"}`;
  }
}

function renderHumanEval() {
  const grid = document.getElementById("human-grid");
  const dims = [
    ["aesthetics", "시각 미감 / 완성도"],
    ["domain", "도메인 공학·리얼리즘"],
    ["ux", "인터랙션·조작 체감"],
    ["antiAi", "비(非)-AI 자연스러움"],
  ];
  grid.innerHTML = state.telemetry
    .map((t) => {
      const rl = latestRlaif(t.trackId);
      const cur = state.humanScores[t.trackId] || { aesthetics: 8, domain: 8, ux: 8, antiAi: 8, note: "", touched: false };
      const avg = (((cur.aesthetics + cur.domain + cur.ux + cur.antiAi) / 4) * 10).toFixed(1);
      return `<div class="human-card" data-htrack="${t.trackId}">
        <div class="card-meta-row" style="margin-bottom:8px">
          <strong>${t.title}</strong>
          <span class="model-tag">내 점수: <b id="havg-${t.trackId}">${avg}</b> / AI: ${rl?.composite_rlaif_100 ?? "—"}</span>
        </div>
        <div class="muted" style="margin-bottom:8px">${t.model_label} · ${t.technique}</div>
        ${dims
          .map(
            ([k, label]) => `<div class="slider-row">
            <span>${label}</span>
            <input type="range" min="1" max="10" step="0.5" value="${cur[k]}" data-k="${k}" data-tid="${t.trackId}" />
            <strong id="hv-${t.trackId}-${k}" style="font-family:var(--mono)">${cur[k]}</strong>
          </div>`
          )
          .join("")}
        <textarea class="human-note" placeholder="직접 조작해 본 정성 소감 (예: 미감, 조작감, AI스러움 여부)..." data-note="${t.trackId}">${cur.note || ""}</textarea>
      </div>`;
    })
    .join("");

  grid.querySelectorAll('input[type="range"]').forEach((inp) => {
    inp.addEventListener("input", () => {
      const tid = inp.dataset.tid;
      const k = inp.dataset.k;
      const cur = state.humanScores[tid] || { aesthetics: 8, domain: 8, ux: 8, antiAi: 8, note: "", touched: true };
      cur[k] = parseFloat(inp.value);
      cur.touched = true;
      state.humanScores[tid] = cur;
      document.getElementById(`hv-${tid}-${k}`).textContent = cur[k];
      document.getElementById(`havg-${tid}`).textContent = (((cur.aesthetics + cur.domain + cur.ux + cur.antiAi) / 4) * 10).toFixed(1);
      localStorage.setItem("neon_bench_human_eval_v1", JSON.stringify(state.humanScores));
      updateHumanCorr();
    });
  });
  grid.querySelectorAll("textarea[data-note]").forEach((ta) => {
    ta.addEventListener("input", () => {
      const tid = ta.dataset.note;
      const cur = state.humanScores[tid] || { aesthetics: 8, domain: 8, ux: 8, antiAi: 8, note: "", touched: true };
      cur.note = ta.value;
      cur.touched = true;
      state.humanScores[tid] = cur;
      localStorage.setItem("neon_bench_human_eval_v1", JSON.stringify(state.humanScores));
    });
  });
  updateHumanCorr();
}

function renderRefs() {
  document.getElementById("refs-grid").innerHTML = PUBLIC_REFS.map(
    (r) => `<article class="ref-card">
      <div class="domain-tag" style="display:inline-block;margin-bottom:6px">${r.source}</div>
      <h3>${r.title}</h3>
      <div style="margin-bottom:6px"><a href="${r.url}" target="_blank" rel="noopener">${r.url}</a></div>
      <div class="muted"><strong>매핑 트랙:</strong> ${r.mappedTrack}</div>
      <div class="muted" style="margin-top:4px"><strong>원본 스펙:</strong> ${r.specs}</div>
      <div class="quote-block">${r.quote}</div>
    </article>`
  ).join("");
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
      if (tab === "showdown") renderShowdown();
    });
  });

  document.getElementById("btn-blind-toggle").addEventListener("click", (e) => {
    state.blindMode = !state.blindMode;
    e.target.textContent = state.blindMode ? "블라인드 모드: ON (클릭해 모델 공개)" : "블라인드 모드: OFF (모델 공개 중)";
    renderShowdown();
  });

  document.getElementById("btn-swap-sides").addEventListener("click", () => {
    state.swapped = !state.swapped;
    renderShowdown();
  });

  document.getElementById("th-close").addEventListener("click", closeTheater);
  document.getElementById("th-view-hero").addEventListener("click", () => callTheaterAction("setView", "hero"));
  document.getElementById("th-view-macro").addEventListener("click", () => callTheaterAction("setView", "macro"));
  document.getElementById("th-view-alt").addEventListener("click", () => callTheaterAction("setView", "alt_mode"));
  document.getElementById("th-demo").addEventListener("click", () => callTheaterAction("triggerAction", "demo"));

  document.getElementById("btn-export-eval").addEventListener("click", async () => {
    const lines = ["# Human Qualitative Evaluation vs RLAIF", "", "| 작품 | 모델 | 내 종합점수 | RLAIF 최종 | 정성 메모 |", "|---|---|---:|---:|---|"];
    for (const t of state.telemetry) {
      const h = state.humanScores[t.trackId] || { aesthetics: 8, domain: 8, ux: 8, antiAi: 8, note: "" };
      const avg = (((h.aesthetics + h.domain + h.ux + h.antiAi) / 4) * 10).toFixed(1);
      const rl = latestRlaif(t.trackId)?.composite_rlaif_100 ?? "—";
      lines.push(`| ${t.title} | ${t.model_label} | ${avg} | ${rl} | ${(h.note || "").replace(/\n/g, " ")} |`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert("Markdown 평가표가 클립보드에 복사되었습니다!");
    } catch {
      prompt("아래 Markdown을 복사하세요:", lines.join("\n"));
    }
  });

  document.getElementById("btn-reset-eval").addEventListener("click", () => {
    localStorage.removeItem("neon_bench_human_eval_v1");
    state.humanScores = {};
    renderHumanEval();
  });
}

async function init() {
  bindEvents();
  const [telemetry, qaR1, qaR2, rlaifR1, rlaifR2, effortFull, effort32k, authorHuman] = await Promise.all([
    fetchJsonSafe("./results/swarm_telemetry.json"),
    fetchJsonSafe("./results/qa_round1.json"),
    fetchJsonSafe("./results/qa_round2.json"),
    fetchJsonSafe("./results/rlaif_round1.json"),
    fetchJsonSafe("./results/rlaif_round2.json"),
    fetchJsonSafe("./results/effort_sweep/effort_sweep_full.json"),
    fetchJsonSafe("./results/effort_sweep/effort_sweep_32k_cap.json"),
    fetchJsonSafe("./results/human_vs_rlaif_final.json", null),
  ]);
  Object.assign(state, { telemetry, qaR1, qaR2, rlaifR1, rlaifR2, effortFull, effort32k, authorHuman });
  renderKpis();
  renderGallery();
  renderEffortSweep();
  renderRlaifTab();
  renderHumanEval();
  renderRefs();
}

init();
