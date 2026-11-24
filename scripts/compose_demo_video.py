#!/usr/bin/env python3
"""
Composites the 6 live Chrome-recorded WebM demo clips into ONE cohesive 1920x1080@24fps
comparison reel (`media/demo_comparison.mp4`), an inline GitHub README GIF preview
(`media/demo_preview.gif`), and a crisp poster (`media/demo_poster.png`):
  1. Intro Card (3.0s)
  2. Split-Screen Head-to-Head Showdown: Gemini 4 Neon (XHigh) vs Claude Opus 5.5 (High) (13.0s)
  3. Sequential Showcase: Track 2 (Cambridge Study 1936) -> Track 3 (AeroFan X-900)
     -> Track 4 (ChromaForge) -> Track 5 (Kinetic Atelier) (~7.5s each)
  4. Human vs RLAIF Final Scoreboard Outro (5.0s)
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\ckstn\.gemini\antigravity\scratch\neon-frontier-bench-2026")
TMP = ROOT / "tmp_video"
OVL = TMP / "overlays"
MEDIA = ROOT / "media"
OVL.mkdir(parents=True, exist_ok=True)
MEDIA.mkdir(parents=True, exist_ok=True)

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"

W, H = 1920, 1080
BG = (12, 13, 16)
SURFACE = (20, 22, 28)
BORDER = (46, 52, 66)
GOLD = (216, 182, 121)
TEAL = (79, 179, 162)
CORAL = (224, 108, 91)
WHITE = (238, 236, 230)
MUTED = (152, 156, 170)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = {
        "ko_bold": [r"C:\Windows\Fonts\malgunbd.ttf", r"C:\Windows\Fonts\segoeuib.ttf"],
        "ko_reg": [r"C:\Windows\Fonts\malgun.ttf", r"C:\Windows\Fonts\segoeui.ttf"],
        "mono_bold": [r"C:\Windows\Fonts\consolab.ttf", r"C:\Windows\Fonts\courbd.ttf"],
        "mono_reg": [r"C:\Windows\Fonts\consola.ttf", r"C:\Windows\Fonts\cour.ttf"],
        "serif_bold": [r"C:\Windows\Fonts\georgiab.ttf", r"C:\Windows\Fonts\segoeuib.ttf"],
    }[name]
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def ffprobe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        text=True,
    ).strip()
    return float(out)


def make_intro_card() -> Path:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # Subtle top & bottom framing hairlines
    d.line([(120, 140), (W - 120, 140)], fill=BORDER, width=2)
    d.line([(120, H - 140), (W - 120, H - 140)], fill=BORDER, width=2)
    d.rectangle([(120, 136), (340, 144)], fill=GOLD)

    d.text((120, 185), "CLEAN-ROOM FRONTIER MODEL BENCHMARK  ·  2026-11-24  ·  ROUND 1 -> ROUND 2 RLAIF", fill=TEAL, font=font("mono_bold", 24))
    d.text((120, 255), "NEON FRONTIER 2026", fill=WHITE, font=font("serif_bold", 96))
    d.text((120, 380), "Multi-Domain Showcase & Human vs RLAIF Evaluation", fill=GOLD, font=font("ko_bold", 46))
    d.text(
        (120, 470),
        "\"다들 Gemini 4 Neon이 좋다는데, 정량(토큰·시간·비용·FPS)과 정성(RLAIF·인간 평가)으로 직접 검증해 보자.\"",
        fill=MUTED,
        font=font("ko_reg", 30),
    )

    # 4 crisp metric pills
    pills = [
        ("6 WORKS · 5 DOMAINS", "24,966 LOC · 0 External Assets"),
        ("5 FRONTIER MODELS", "Neon · Carbon · Argon · Hydrogen · Opus 5.5"),
        ("GATE 5.5 QA: 6/6 PASS", "59.9 FPS Median · 0 Errors · 0 Overlaps"),
        ("RLAIF R1 -> R2 (+4.3)", "Decision-1 + Blind Carbon + Human Audit"),
    ]
    px = 120
    for title, sub in pills:
        d.rounded_rectangle([(px, 600), (px + 402, 740)], radius=10, fill=SURFACE, outline=BORDER, width=2)
        d.text((px + 20, 628), title, fill=GOLD, font=font("mono_bold", 21))
        d.text((px + 20, 678), sub, fill=WHITE, font=font("ko_reg", 17))
        px += 426

    d.text((120, H - 110), "PART 1: HEAD-TO-HEAD SPLIT-SCREEN SHOWDOWN (NEON XHIGH vs OPUS 5.5 HIGH)   ->   PART 2: 4-DOMAIN SEQUENTIAL SHOWCASE", fill=MUTED, font=font("mono_reg", 21))
    out = OVL / "card_intro.png"
    img.save(out)
    return out


def make_showdown_frame_overlay() -> Path:
    """RGBA transparent frame: 70px top header, 70px bottom footer, 4px center divider."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Top 70px bar
    d.rectangle([(0, 0), (W, 70)], fill=(12, 14, 18, 245))
    d.line([(0, 69), (W, 69)], fill=GOLD + (220,), width=2)
    # Center divider
    d.rectangle([(958, 70), (962, H - 70)], fill=GOLD + (200,))
    # Bottom 70px bar
    d.rectangle([(0, H - 70), (W, H)], fill=(12, 14, 18, 245))
    d.line([(0, H - 70), (W, H - 70)], fill=BORDER + (255,), width=2)

    # Top labels
    d.rounded_rectangle([(24, 14), (275, 56)], radius=6, fill=(42, 34, 22, 255), outline=GOLD + (255,), width=2)
    d.text((40, 22), "HEAD-TO-HEAD SHOWDOWN", fill=GOLD, font=font("mono_bold", 19))

    d.text((310, 18), "LEFT: Chronos N-4  ·  Gemini 4 Neon (XHigh)", fill=WHITE, font=font("ko_bold", 26))
    d.text((995, 18), "RIGHT: Chronos O-5  ·  Claude Opus 5.5 (High)", fill=WHITE, font=font("ko_bold", 26))

    # Bottom metrics comparison — strictly bounded inside left [0..954] and right [966..1920]
    d.text(
        (24, H - 46),
        "NEON XHIGH | Human 80.0 · RLAIF 81.4 · 59.9 FPS · $7.69 (92.6% cache)",
        fill=TEAL,
        font=font("mono_bold", 19),
    )
    d.text(
        (984, H - 46),
        "OPUS 5.5 HIGH | Human 88.8 (#1) · RLAIF 81.2 · 59.9 FPS · $23.61 (3.1x)",
        fill=GOLD,
        font=font("mono_bold", 19),
    )

    out = OVL / "overlay_showdown.png"
    img.save(out)
    return out


def make_lower_third_overlay(filename: str, badge: str, title: str, model_line: str, metrics_line: str, accent=GOLD) -> Path:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bar_h = 92
    y0 = H - bar_h
    d.rectangle([(0, y0), (W, H)], fill=(12, 14, 18, 242))
    d.line([(0, y0), (W, y0)], fill=accent + (230,), width=2)

    d.rounded_rectangle([(24, y0 + 18), (196, y0 + 72)], radius=6, fill=(28, 32, 42, 255), outline=accent + (255,), width=2)
    d.text((40, y0 + 33), badge, fill=accent, font=font("mono_bold", 21))

    d.text((220, y0 + 16), title, fill=WHITE, font=font("ko_bold", 24))
    d.text((220, y0 + 53), model_line, fill=MUTED, font=font("mono_reg", 18))

    # Right-aligned live scorecard badge with generous clearance from title
    m_font = font("mono_bold", 21)
    bbox = d.textbbox((0, 0), metrics_line, font=m_font)
    mw = bbox[2] - bbox[0]
    d.rounded_rectangle([(W - mw - 56, y0 + 20), (W - 22, y0 + 70)], radius=6, fill=(20, 26, 32, 255), outline=TEAL + (160,), width=1)
    d.text((W - mw - 38, y0 + 33), metrics_line, fill=TEAL, font=m_font)

    out = OVL / filename
    img.save(out)
    return out


def make_outro_card() -> Path:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.line([(90, 96), (W - 90, 96)], fill=BORDER, width=2)
    d.rectangle([(90, 92), (320, 100)], fill=GOLD)
    d.text((90, 120), "FINAL BENCHMARK SCOREBOARD  ·  HUMAN QUALITATIVE vs MULTIMODAL RLAIF (R1 -> R2)", fill=GOLD, font=font("mono_bold", 26))
    d.text((90, 162), "6 Works · 5 Domains · 6/6 Gate 5.5 PASS · 59.9 FPS Median · 0 Errors", fill=WHITE, font=font("ko_bold", 40))

    headers = ["Track / Work", "Model & Technique", "Human", "RLAIF R1->R2", "API USD", "H / $", "Key Verdict"]
    xs = [90, 470, 880, 1015, 1225, 1365, 1485]
    y = 250
    d.rectangle([(80, y - 10), (W - 80, y + 42)], fill=SURFACE)
    for h_txt, x in zip(headers, xs):
        d.text((x, y), h_txt, fill=MUTED, font=font("mono_bold", 20))

    rows = [
        ("1B. Chronos Calibre O-5", "Claude Opus 5.5 (High)", "88.8 #1", "76.1 -> 81.2", "$23.61*", "3.76", "미감·자연스러움 압도 (쿼터 100%)"),
        ("1A. Chronos Calibre N-4", "Gemini 4 Neon (XHigh)", "80.0 #2", "75.2 -> 81.4", "$7.69", "10.40", "조작 UX·공학 균형 (3.1x 저비용)"),
        ("2. Cambridge Study 1936", "Neon (XHigh) x2 Swarm", "78.8 #3", "73.8 -> 79.2", "$18.71", "4.21", "인간-RLAIF 최고 일치 (-0.44)"),
        ("5. Kinetic Atelier + XPBD", "Neon High -> Hydrogen XH", "78.8 #3", "74.4 -> 75.5", "$3.70", "21.31", "최고 멀티에이전트 ROI (캐시 96.4%)"),
        ("3. AeroFan X-900 CAD", "Gemini 4 Carbon One-Shot", "77.5 #5", "81.7 -> 80.5", "$5.90", "13.14", "1차 원샷 공학 수렴력 최강"),
        ("4. ChromaForge Art + CV", "Gemini 4 Argon Iterative", "75.0 #6", "71.1 -> 80.2", "$1.87", "40.21", "최대 RLAIF 개선 (+9.1) · 최저가"),
    ]
    y = 315
    for i, r in enumerate(rows):
        if i % 2 == 1:
            d.rectangle([(80, y - 10), (W - 80, y + 54)], fill=(17, 19, 24))
        for j, (val, x) in enumerate(zip(r, xs)):
            col = GOLD if j == 2 and "#1" in val else (TEAL if j in (3, 5) else WHITE)
            if j == 6:
                d.text((x, y + 8), val, fill=MUTED, font=font("ko_reg", 17))
            else:
                d.text((x, y + 6), val, fill=col, font=font("mono_bold" if j in (2, 3, 4, 5) else "ko_bold", 19))
        y += 74

    # Bottom takeaway box
    d.rounded_rectangle([(80, 790), (W - 80, 965)], radius=12, fill=SURFACE, outline=TEAL, width=2)
    d.text((112, 814), "RLAIF JUDGE BLIND-SPOT DISCOVERY (Human vs AI Alignment Audit)", fill=TEAL, font=font("mono_bold", 23))
    d.text((112, 856), "• Decision-1 'Visual Craft' 축은 인간 미감과 음의 상관(ρ = -0.261) — 화려함 과대평가 vs 절제된 자연스러움 과소평가", fill=WHITE, font=font("ko_reg", 24))
    d.text((112, 902), "• 반면 'Anti-AI-Look' 축(ρ = +0.696)과 블라인드 Carbon 비평가(ρ = +0.582)가 인간 정성 순위를 가장 잘 예측!", fill=GOLD, font=font("ko_bold", 24))

    d.text((90, H - 64), "github.com/hobby-programmer-5000/neon-frontier-bench-2026  ·  MIT License  ·  Co-authored with Antigravity", fill=MUTED, font=font("mono_reg", 20))
    out = OVL / "card_outro.png"
    img.save(out)
    return out


def run(cmd: list[str]) -> None:
    print(">>", " ".join(str(x) for x in cmd), flush=True)
    subprocess.run(cmd, check=True)


def trim_start_sec(webm: Path, ready_sec: float) -> float:
    dur = ffprobe_duration(webm)
    # Trim initial boot loading frames cleanly; keep ready_sec from the end
    return max(0.0, dur - ready_sec + 0.15)


def main() -> int:
    manifest = {m["name"]: m for m in json.loads((TMP / "clips_manifest.json").read_text(encoding="utf-8"))}

    intro_png = make_intro_card()
    showdown_ovl = make_showdown_frame_overlay()
    outro_png = make_outro_card()

    ovl_turing = make_lower_third_overlay(
        "ovl_turing.png", "TRACK 2 / 6",
        "Cambridge Study 1936 — Working Universal Turing Machine",
        "Gemini 4 Neon (XHigh) x2 Specialist Swarm  ·  3D Architecture & Computing",
        "Human 78.8 | RLAIF 79.2 | 59.9 FPS | $18.71", TEAL,
    )
    ovl_turbofan = make_lower_third_overlay(
        "ovl_turbofan.png", "TRACK 3 / 6",
        "AeroFan X-900 — 135° Cutaway High-Bypass Turbofan CAD",
        "Gemini 4 Carbon (High) One-Shot Master Spec  ·  Brayton Cycle & Thermal CAD",
        "Human 77.5 | RLAIF 80.5 | 59.9 FPS | $5.90", GOLD,
    )
    ovl_chroma = make_lower_third_overlay(
        "ovl_chroma.png", "TRACK 4 / 6",
        "ChromaForge — ACES Hex-Voxel Curl Flame & 57.6K Formula Relight",
        "Gemini 4 Argon (High) Iterative Visual Refinement  ·  GLSL 300 ES + Sheet CV",
        "Human 75.0 | RLAIF 80.2 (+9.1!) | $1.87 (#1 ROI)", CORAL,
    )
    ovl_kinetic = make_lower_third_overlay(
        "ovl_kinetic.png", "TRACK 5 / 6",
        "Kinetic Atelier — 120 Hz Rube Goldberg & Live XPBD Silk Cloth",
        "Gemini 4 Neon (High) -> Hydrogen (XHigh) Orchestrator-Executor Pipeline",
        "Human 78.8 | RLAIF 75.5 | 96.4% Cache | $3.70", TEAL,
    )

    segs = []

    # Seg 0: Intro (3.2s)
    seg0 = TMP / "seg0_intro.mp4"
    run([
        FFMPEG, "-y", "-loop", "1", "-t", "3.2", "-i", str(intro_png),
        "-vf", "fps=24,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=2.8:d=0.4",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", str(seg0),
    ])
    segs.append(seg0)

    # Seg 1: Split-Screen Showdown (13.0s) — Left Neon + Right Opus + Frame Overlay
    neon_w = Path(manifest["showdown_neon"]["destPath"])
    opus_w = Path(manifest["showdown_opus"]["destPath"])
    ss_neon = trim_start_sec(neon_w, manifest["showdown_neon"]["readyDurationSec"])
    ss_opus = trim_start_sec(opus_w, manifest["showdown_opus"]["readyDurationSec"])
    seg1 = TMP / "seg1_showdown.mp4"
    run([
        FFMPEG, "-y",
        "-ss", f"{ss_neon:.2f}", "-t", "13.0", "-i", str(neon_w),
        "-ss", f"{ss_opus:.2f}", "-t", "13.0", "-i", str(opus_w),
        "-loop", "1", "-t", "13.0", "-i", str(showdown_ovl),
        "-filter_complex",
        "[0:v]fps=24,scale=960:940:force_original_aspect_ratio=decrease,pad=960:940:(ow-iw)/2:(oh-ih)/2:color=#0c0d10,setpts=PTS-STARTPTS[left];"
        "[1:v]fps=24,scale=960:940:force_original_aspect_ratio=decrease,pad=960:940:(ow-iw)/2:(oh-ih)/2:color=#0c0d10,setpts=PTS-STARTPTS[right];"
        "[left][right]hstack=inputs=2,pad=1920:1080:0:70:color=#0c0d10[stack];"
        "[stack][2:v]overlay=0:0:shortest=1,fade=t=in:st=0:d=0.35,fade=t=out:st=12.6:d=0.4,format=yuv420p[v]",
        "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "21", str(seg1),
    ])
    segs.append(seg1)

    # Extract crisp cover poster from Seg 1 at t=2.0s (clean Hero split-screen!)
    run([
        FFMPEG, "-y", "-ss", "2.0", "-i", str(seg1), "-vframes", "1", str(MEDIA / "demo_poster.png"),
    ])

    # Segs 2..5: Sequential full-frame showcase (~7.5s each)
    seq_specs = [
        ("seg2_turing.mp4", "seq_turing", ovl_turing, 7.6),
        ("seg3_turbofan.mp4", "seq_turbofan", ovl_turbofan, 7.6),
        ("seg4_chroma.mp4", "seq_chroma", ovl_chroma, 7.8),
        ("seg5_kinetic.mp4", "seq_kinetic", ovl_kinetic, 8.0),
    ]
    for out_name, clip_key, ovl_png, dur_s in seq_specs:
        src_w = Path(manifest[clip_key]["destPath"])
        ss = trim_start_sec(src_w, manifest[clip_key]["readyDurationSec"])
        seg_p = TMP / out_name
        run([
            FFMPEG, "-y",
            "-ss", f"{ss:.2f}", "-t", f"{dur_s:.1f}", "-i", str(src_w),
            "-loop", "1", "-t", f"{dur_s:.1f}", "-i", str(ovl_png),
            "-filter_complex",
            f"[0:v]fps=24,scale=1920:988:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:0:color=#0c0d10,setpts=PTS-STARTPTS[base];"
            f"[base][1:v]overlay=0:0:shortest=1,fade=t=in:st=0:d=0.3,fade=t=out:st={dur_s - 0.35:.2f}:d=0.35,format=yuv420p[v]",
            "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "21", str(seg_p),
        ])
        segs.append(seg_p)

    # Seg 6: Outro Scoreboard (5.0s)
    seg6 = TMP / "seg6_outro.mp4"
    run([
        FFMPEG, "-y", "-loop", "1", "-t", "5.0", "-i", str(outro_png),
        "-vf", "fps=24,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=4.5:d=0.5",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", str(seg6),
    ])
    segs.append(seg6)

    # Concat into final master MP4 (1920x1080 @ 24fps, faststart for web streaming)
    concat_txt = TMP / "concat.txt"
    concat_txt.write_text("\n".join(f"file '{p.as_posix()}'" for p in segs), encoding="utf-8")
    final_mp4 = MEDIA / "demo_comparison.mp4"
    run([
        FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_txt),
        "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(final_mp4),
    ])

    # Generate lightweight animated GIF preview (720x405 @ 8fps, 1.5x speed, <8 MB) for instant inline GitHub README display!
    palette_png = TMP / "palette.png"
    final_gif = MEDIA / "demo_preview.gif"
    vf_gif = "setpts=0.62*PTS,fps=8,scale=720:-1:flags=lanczos"
    run([FFMPEG, "-y", "-i", str(final_mp4), "-vf", f"{vf_gif},palettegen=max_colors=128:stats_mode=diff", str(palette_png)])
    run([
        FFMPEG, "-y", "-i", str(final_mp4), "-i", str(palette_png),
        "-lavfi", f"{vf_gif} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
        str(final_gif),
    ])

    # Extract 4 verification keyframes from final MP4 for mandatory visual inspection
    verify_dir = TMP / "verify_frames"
    verify_dir.mkdir(exist_ok=True)
    for tag, ts in [("intro", "1.5"), ("showdown", "10.0"), ("turing", "20.0"), ("turbofan", "29.0"), ("chroma", "37.0"), ("kinetic", "44.0"), ("outro", "49.5")]:
        run([FFMPEG, "-y", "-ss", ts, "-i", str(final_mp4), "-vframes", "1", str(verify_dir / f"{tag}.png")])

    mp4_mb = final_mp4.stat().st_size / (1024 * 1024)
    gif_mb = final_gif.stat().st_size / (1024 * 1024)
    dur_total = ffprobe_duration(final_mp4)
    print(f"DONE! MP4={final_mp4} ({mp4_mb:.2f} MB, {dur_total:.1f}s) | GIF={final_gif} ({gif_mb:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
