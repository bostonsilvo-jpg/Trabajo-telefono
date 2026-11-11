#!/usr/bin/env python3
"""Murmuración: video audio-reactivo para 'Birds' (Imagine Dragons).
Uso: render_birds.py AUDIO.mp3 SALIDA.mp4 [segundos_max]
"""
import sys, os, subprocess, math, array
import numpy as np
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFont

AUDIO = sys.argv[1]
OUT = sys.argv[2]
MAXS = float(sys.argv[3]) if len(sys.argv) > 3 else None
W, H, FPS = 1280, 720, 30
N = 9000
WORK = os.path.join(os.path.dirname(os.path.abspath(OUT)), "_work")
os.makedirs(WORK, exist_ok=True)

COBALT = np.array([45, 107, 255], np.float32) / 255
AMBER = np.array([255, 179, 71], np.float32) / 255
MAGENTA = np.array([255, 46, 136], np.float32) / 255
CREAM = np.array([244, 241, 234], np.float32) / 255

# ---------- audio ----------
def load_audio():
    sr = 22050
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", AUDIO, "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768, sr

def analyse():
    x, sr = load_audio()
    dur = len(x) / sr
    nf = int(dur * FPS) + 1
    win = 2048
    bass = np.zeros(nf, np.float32); rms = np.zeros(nf, np.float32); hi = np.zeros(nf, np.float32)
    fr = np.fft.rfftfreq(win, 1 / sr)
    hann = np.hanning(win).astype(np.float32)
    for i in range(nf):
        c = int(i / FPS * sr)
        seg = x[max(0, c - win // 2): c + win // 2]
        if len(seg) < win: seg = np.pad(seg, (0, win - len(seg)))
        sp = np.abs(np.fft.rfft(seg * hann))
        bass[i] = sp[(fr > 30) & (fr < 150)].sum()
        hi[i] = sp[(fr > 3000) & (fr < 9000)].sum()
        rms[i] = math.sqrt(float((seg ** 2).mean()))
    def norm(a):
        a = a / (np.percentile(a, 97) + 1e-9)
        return np.clip(a, 0, 1.3)
    bass, hi, rms = norm(bass), norm(hi), norm(rms)
    slow = np.convolve(bass, np.ones(15) / 15, "same")
    pulse = np.clip(bass - slow, 0, None) * 2.2
    k = np.exp(-np.arange(6) / 2.0); k /= k.sum()
    pulse = np.clip(np.convolve(pulse, k)[:nf], 0, 1.2)
    return dict(dur=dur, nf=nf, bass=bass, hi=hi, rms=rms, pulse=pulse)

# ---------- shapes ----------
rng = np.random.default_rng(7)
U = rng.random(N).astype(np.float32); V = rng.random(N).astype(np.float32); S = rng.random(N).astype(np.float32)
PH = rng.random(N).astype(np.float32) * 6.283
ORDER = rng.permutation(N)           # orden de activación
RANK = np.empty(N, np.float32); RANK[ORDER] = np.arange(N) / N

def shape_sphere(t):
    th = U * 6.283 + 0.3 * t * (0.5 + S)
    ph = np.arccos(1 - 2 * V)
    r = 1.0 + 0.12 * np.sin(3 * th + t + PH)
    return np.stack([r * np.sin(ph) * np.cos(th), r * np.cos(ph) * 0.8, r * np.sin(ph) * np.sin(th)], 1)

def shape_torus(t):
    a = U * 6.283 + 0.5 * t; b = V * 6.283 + 1.4 * t * (0.5 + S)
    R, r = 1.15, 0.42 + 0.1 * np.sin(2 * a + t)
    return np.stack([(R + r * np.cos(b)) * np.cos(a), r * np.sin(b), (R + r * np.cos(b)) * np.sin(a)], 1)

def shape_sheet(t):
    x = (U - 0.5) * 3.4; z = (V - 0.5) * 3.4
    y = 0.45 * np.sin(2.0 * x + 1.5 * t) * np.cos(1.6 * z - 0.9 * t) + 0.08 * np.sin(PH + t)
    return np.stack([x, y, z], 1)

def shape_helix(t):
    a = U * 6.283 * 3 + 0.8 * t; sgn = np.where(S > 0.5, 1.0, -1.0)
    h = (V - 0.5) * 3.6
    r = 0.8 + 0.15 * np.sin(h * 2 + t)
    return np.stack([r * np.cos(a + (sgn > 0) * 3.14159), h, r * np.sin(a + (sgn > 0) * 3.14159)], 1)

def shape_disperse(t):
    th = U * 6.283; ph = np.arccos(1 - 2 * V)
    r = 2.6 + 1.2 * S + 0.3 * np.sin(PH + t * 2)
    return np.stack([r * np.sin(ph) * np.cos(th), r * np.cos(ph), r * np.sin(ph) * np.sin(th)], 1)

SHAPES = [shape_sphere, shape_torus, shape_sheet, shape_helix, shape_disperse]
# (tiempo de inicio, forma)
SCHEDULE = [(0, 0), (64, 1), (100, 2), (130, 3), (150, 0), (180, 4), (183, 1)]

def smooth(a):
    a = np.clip(a, 0, 1); return a * a * (3 - 2 * a)

def shape_weights(t):
    w = np.zeros(len(SHAPES), np.float32)
    cur = SCHEDULE[0][1]
    w[cur] = 1
    for i in range(1, len(SCHEDULE)):
        ts, sh = SCHEDULE[i]
        k = smooth((t - ts) / 2.0)
        if k > 0:
            w *= (1 - k); w[sh] += k
    return w

def kf(t, pts):
    xs, ys = zip(*pts); return float(np.interp(t, xs, ys))

# fracción activa (0=un solo pájaro, 1=toda la bandada)
ACTIVE = [(0, 0.002), (28, 0.004), (34, 0.25), (64, 0.7), (100, 1.0), (153, 1.0), (162, 0.02), (169, 0.001),
          (176, 0.001), (180, 0.35), (181.5, 1.0), (214, 1.0), (219, 0.01), (222.5, 0.002)]
SCALE = [(0, 0.6), (32, 0.7), (64, 1.0), (153, 1.15), (162, 0.2), (180, 0.3), (181, 1.5), (214, 1.35), (222, 0.4)]
MIX = [(0, 0.0), (30, 0.05), (64, 0.55), (130, 0.75), (150, 0.35), (170, 0.1), (178, 0.2), (181, 1.0), (214, 0.9), (222, 0.9)]
MAG = [(0, 0), (179.5, 0), (181, 1), (186, 0.35), (214, 0.5), (222, 0)]
BRIGHT = [(0, 0.8), (160, 1.0), (167, 0.35), (176, 0.35), (181, 1.4), (214, 1.2), (222, 0.5)]

# ---------- fondo / texto ----------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rr = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
def make_bg(mix):
    base = np.array([5, 6, 13], np.float32) / 255
    sky = np.array([11, 27, 74], np.float32) / 255 * (1 - mix) + np.array([60, 28, 20], np.float32) / 255 * mix
    g = np.clip(1 - rr * 0.9, 0, 1) ** 1.6
    return base[None, None] + sky[None, None] * g[..., None] * 0.55

def font(sz):
    for p in ["/usr/share/fonts/opentype/inter/Inter-Medium.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def text_mask(txt, sz, y, track=0.0):
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im); f = font(sz)
    widths = [d.textlength(c, font=f) for c in txt]
    tw = sum(widths) + track * sz * (len(txt) - 1)
    x = (W - tw) / 2
    for c, w in zip(txt, widths):
        d.text((x, y), c, font=f, fill=255); x += w + track * sz
    return np.asarray(im, np.float32) / 255

TXT_TITLE = text_mask("BIRDS", 92, H / 2 - 50, 0.5)
TXT_ARTIST = text_mask("IMAGINE DRAGONS", 26, H / 2 + 70, 0.45)
TXT_END = text_mask("BIRDS", 40, H - 130, 0.5)

def text_alpha(t):
    a = 0.0
    if 2 <= t < 14: a = smooth((t - 2) / 3) * (1 - smooth((t - 10) / 4))
    t_end = 214 + 0
    return a

# estrellas
STARS = rng.random((260, 3)).astype(np.float32)

def blur_box(a, r):
    k = 2 * r + 1
    c = np.cumsum(np.pad(a, ((r + 1, r), (0, 0), (0, 0)), mode="edge"), 0)
    a = (c[k:] - c[:-k]) / k
    c = np.cumsum(np.pad(a, ((0, 0), (r + 1, r), (0, 0)), mode="edge"), 1)
    return (c[:, k:] - c[:, :-k]) / k

def pool2(a): return a.reshape(H // 2, 2, W // 2, 2, 3).mean((1, 3))
def up2(a): return np.repeat(np.repeat(a, 2, 0), 2, 1)

# ---------- render ----------
A = None
def init(a):
    global A; A = a

def project(P, cam_a, cam_tilt, dist, scale):
    ca, sa = math.cos(cam_a), math.sin(cam_a); ct, st = math.cos(cam_tilt), math.sin(cam_tilt)
    x = P[:, 0] * ca - P[:, 2] * sa; z = P[:, 0] * sa + P[:, 2] * ca; y = P[:, 1]
    y2 = y * ct - z * st; z2 = y * st + z * ct
    d = z2 + dist
    f = 820.0 / np.maximum(d, 0.3)
    return x * f + W / 2, -y2 * f + H / 2, d

def render_range(args):
    f0, f1, path = args
    a = A
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                             "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "fast", "-crf", "26",
                             "-pix_fmt", "yuv420p", path], stdin=subprocess.PIPE)
    acc = np.zeros((H, W, 3), np.float32)
    for f in range(max(0, f0 - 20), f1):
        t = f / FPS
        i = min(f, a["nf"] - 1)
        bass, pulse, rms, hi = a["bass"][i], a["pulse"][i], a["rms"][i], a["hi"][i]
        w = shape_weights(t)
        P = sum(w[k] * SHAPES[k](t) for k in range(len(SHAPES)) if w[k] > 1e-3)
        act = kf(t, ACTIVE); sc = kf(t, SCALE) * (1 + 0.22 * pulse + 0.06 * bass)
        mix = kf(t, MIX); mag = kf(t, MAG); br = kf(t, BRIGHT)
        n_act = max(6, int(N * act))
        sel = ORDER[:n_act]
        Ps = P[sel] * sc
        # pájaro solitario / pluma: deriva propia
        if act < 0.01:
            dx = 0.35 * math.sin(t * 0.7) if t < 30 else 0.0
            Ps = Ps * 0.12 + np.array([dx, 0.1 * math.sin(t * 1.3), 0], np.float32)
            if 168 < t < 180:   # pluma que cae (~2:48)
                fall = (t - 168) / 12
                Ps = Ps * 0.4 + np.array([0.3 * math.sin(fall * 6), 1.2 - 2.4 * fall, 0], np.float32)
        # ruido de flujo
        Ps = Ps + 0.05 * np.stack([np.sin(PH[sel] * 3 + t * 1.7), np.cos(PH[sel] * 2 + t * 1.3), np.sin(PH[sel] + t * 2.1)], 1) * (1 + 2 * pulse)
        cam_a = 0.18 * t + (0.35 * smooth((t - 180) / 4) * (t - 180) * 0.4 if t > 180 else 0)
        cam_tilt = 0.25 + 0.18 * math.sin(t * 0.21)
        dist = 4.2 - 0.9 * smooth((t - 64) / 8) + (0.8 if 100 < t < 130 else 0) - 0.2 * smooth((t - 181) / 3) * (t < 214) + (0.9 if t >= 181 else 0)
        px, py, d = project(Ps, cam_a, cam_tilt, dist, sc)
        ix = px.astype(np.int32); iy = py.astype(np.int32)
        ok = (ix >= 0) & (ix < W) & (iy >= 0) & (iy < H) & (d > 0.3)
        ix, iy, d, sel_ok = ix[ok], iy[ok], d[ok], np.arange(len(sel))[ok]
        s_s = S[sel][ok]
        flat = iy * W + ix
        depth = np.clip(1.6 - d / 5.5, 0.15, 1.4)
        m = np.clip(mix + 0.45 * (s_s - 0.5) + 0.25 * (RANK[sel][ok] - 0.5) * (1 if t > 60 else 0), 0, 1)
        col = COBALT[None] * (1 - m[:, None]) + AMBER[None] * m[:, None]
        if mag > 0:
            mm = (s_s > (1 - 0.5 * mag)) & True
            col[mm] = col[mm] * (1 - 0.8 * mag) + MAGENTA[None] * 0.8 * mag
        wgt = depth * (0.9 + 0.5 * pulse) * br
        frame = np.zeros((H * W, 3), np.float32)
        for c in range(3):
            frame[:, c] = np.bincount(flat, weights=wgt * col[:, c], minlength=H * W)
        frame = frame.reshape(H, W, 3)
        # estrellas lejanas
        sx = ((STARS[:, 0] * W + t * 4 * (0.3 + STARS[:, 2])) % W).astype(np.int32)
        sy = (STARS[:, 1] * H).astype(np.int32)
        frame[sy, sx] += CREAM[None] * 0.25 * (0.4 + 0.6 * STARS[:, 2:3]) * (1 + hi * 0.5)
        # glow
        half = pool2(frame)
        g1 = up2(blur_box(blur_box(half, 2), 2))
        g2 = up2(blur_box(blur_box(half, 9), 9))
        cur = frame * 0.55 + g1 * 2.4 + g2 * 5.5
        acc = acc * (0.78 if act > 0.05 else 0.9) + cur
        if f >= f0:
            bg = make_bg(mix) * (1 + 0.6 * pulse)
            img = bg + (1 - np.exp(-acc * 0.75)) * 1.0
            # flash en el drop
            if 180.0 <= t < 181.6:
                img += CREAM[None, None] * 0.5 * (1 - (t - 180) / 1.6) * smooth((t - 180) / 0.15)
            # texto
            ta = 0.0
            if 2 <= t < 15: ta = smooth((t - 2) / 3) * (1 - smooth((t - 11) / 4))
            if ta > 0:
                img += CREAM[None, None] * (TXT_TITLE[..., None] * ta + TXT_ARTIST[..., None] * ta * 0.7)
            te = smooth((t - 215) / 2) * (1 - smooth((t - 221) / 1.5))
            if te > 0: img += CREAM[None, None] * TXT_END[..., None] * te
            # viñeta + fundidos
            img *= (1 - 0.35 * np.clip(rr - 0.6, 0, 1))[..., None]
            fade = smooth(t / 1.5) * (1 - smooth((t - (a["dur"] - 1.5)) / 1.5))
            img *= fade
            proc.stdin.write((np.clip(img, 0, 1) * 255).astype(np.uint8).tobytes())
    proc.stdin.close(); proc.wait()
    return path

if __name__ == "__main__":
    a = analyse()
    total = int((MAXS if MAXS else a["dur"]) * FPS)
    chunks = 8
    step = math.ceil(total / chunks)
    jobs = [(i * step, min(total, (i + 1) * step), os.path.join(WORK, f"seg{i:02d}.mp4")) for i in range(chunks) if i * step < total]
    with Pool(4, initializer=init, initargs=(a,)) as p:
        for done in p.imap(render_range, jobs):
            print("ok", done, flush=True)
    lst = os.path.join(WORK, "list.txt")
    open(lst, "w").write("".join(f"file '{j[2]}'\n" for j in jobs))
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-i", AUDIO]
    if MAXS: cmd += ["-t", str(MAXS)]
    cmd += ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", OUT]
    subprocess.run(cmd, check=True)
    print("LISTO", OUT)
