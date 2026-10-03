"""Build a deterministic, original twelve-sound audition pack without dependencies."""

import html
import math
import random
import struct
import subprocess
import wave
import zipfile
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent / "audio-preview"
OUT.mkdir(exist_ok=True)
rng = random.Random(20261001)
catalog = []
combined = []


def canvas(seconds):
    return [0.0] * int(seconds * RATE)


def add(samples, start, duration, voice, gain=1):
    offset = int(start * RATE)
    for i in range(min(int(duration * RATE), len(samples) - offset)):
        t = i / RATE
        fade = min(1, t / 0.002, (duration - t) / 0.012)
        samples[offset + i] += voice(t) * gain * fade


def bell(freq, decay=9):
    return lambda t: (
        math.sin(math.tau * freq * t)
        + 0.28 * math.sin(math.tau * freq * 2.76 * t) * math.exp(-12 * t)
        + 0.11 * math.sin(math.tau * freq * 5.4 * t) * math.exp(-20 * t)
    ) * math.exp(-decay * t)


def wood(freq=260, decay=65):
    return lambda t: (
        math.sin(math.tau * freq * t) * 0.7
        + math.sin(math.tau * freq * 1.61 * t) * 0.24
        + rng.uniform(-1, 1) * 0.22 * math.exp(-100 * t)
    ) * math.exp(-decay * t)


def rustle():
    previous = 0.0

    def voice(t):
        nonlocal previous
        noise = rng.uniform(-1, 1)
        high = noise - previous
        previous = noise
        return high * math.sin(math.pi * min(1, t / 0.28)) ** 2 * 0.23

    return voice


def dice_hit():
    # Dense broadband contact with very short modes, avoiding a hollow tube ring.
    low = 0.0

    def voice(t):
        nonlocal low
        noise = rng.uniform(-1, 1)
        low += 0.42 * (noise - low)
        contact = low * math.exp(-180 * t)
        body = sum(math.sin(math.tau * freq * t) for freq in (740, 1230, 1870))
        return contact * 0.85 + body * 0.05 * math.exp(-230 * t)

    return voice


def write(path, samples):
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(b"".join(struct.pack("<h", round(s * 32767)) for s in samples))


def save(key, title, description, samples, level=0.65):
    peak = max(abs(s) for s in samples)
    samples = [s * level / peak for s in samples]
    filename = f"{len(catalog) + 1:02d}-{key}.wav"
    write(OUT / filename, samples)
    catalog.append((filename, title, description, len(samples) / RATE))
    combined.extend(samples)
    combined.extend([0.0] * int(1.1 * RATE))


s = canvas(0.48)
add(s, 0, 0.42, bell(784, 11), 0.5)
add(s, 0.075, 0.40, bell(1047, 12), 0.43)
save("turn", "Đến lượt mình", "Hai tiếng ting sáng và nhẹ.", s, 0.5)

s = canvas(0.88)
for start, gain in [(0, .28), (.032, .2), (.083, .34), (.127, .25),
                    (.19, .43), (.224, .3), (.305, .7), (.329, .48),
                    (.435, .45), (.478, .34), (.605, .26), (.742, .14)]:
    add(s, start, .065, dice_hit(), gain)
save("dice", "Tung xúc xắc", "Hai viên xúc xắc va chạm chắc, khô; cú nảy thưa dần.", s)

s = canvas(.13)
add(s, 0, .13, wood(310, 60))
save("step", "Quân bước qua ô", "Cộc mềm, ngắn để lặp lại theo từng bước.", s, .34)

def read_mp3(path):
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le",
         "-ac", "1", "-ar", str(RATE), "pipe:1"], check=True, capture_output=True,
    ).stdout
    return [value / 32768 for (value,) in struct.iter_unpack("<h", pcm)]


def pixabay(key, title, description, source, level=.56):
    save(key, title, description, read_mp3(OUT / source), level)


pixabay("money-in", "Nhận tiền", "Bản Pixabay do bạn chọn; cân mức âm.",
        "pixabay-money-in.mp3")

s = canvas(.48)
add(s, 0, .28, rustle(), .4)
add(s, .025, .4, bell(659, 14), .4)
add(s, .12, .35, bell(494, 15), .35)
save("money-out", "Trả tiền", "Tiền giấy lướt nhẹ, hai nốt hạ xuống.", s, .48)

pixabay("purchase", "Mua đất / giao dịch thành công", "Bản Pixabay do bạn chọn; cân mức âm.",
        "pixabay-purchase.mp3", .62)

s = canvas(.65)
for start, freq in [(0, 220), (.12, 280), (.24, 350)]:
    add(s, start, .15, wood(freq, 45), .5)
add(s, .31, .34, bell(1047, 12), .25)
save("build", "Xây nhà / khách sạn", "Ba nhịp gõ nhỏ và một nốt vui.", s, .6)

s = canvas(.58)
add(s, 0, .28, rustle(), .9)
add(s, .20, .16, wood(580, 65), .22)
add(s, .25, .33, bell(1175, 13), .2)
save("card", "Rút thẻ", "Giấy sột soạt, nốt bất ngờ ngắn.", s, .47)

s = canvas(.48)
add(s, 0, .25, wood(125, 24), .8)
add(s, .045, .22, wood(390, 32), .3)
add(s, .17, .18, wood(170, 38), .18)
save("auction", "Chốt đấu giá", "Một cú búa gõ, chút cộng hưởng mặt bàn.", s)

pixabay("jail", "Bị đưa vào tù", "Bản Pixabay do bạn chọn; cân mức âm.",
        "pixabay-lock-in-jail.mp3", .62)

s = canvas(1.05)
for start, freq in [(0, 392), (.19, 330), (.38, 262), (.57, 196)]:
    add(s, start, .48, bell(freq, 9), .36)
save("bankrupt", "Phá sản", "Bốn nốt hụt dần, nhẹ nhàng.", s, .53)

standing_track = OUT / "tien-len-standings.mp3"
win_pcm = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", str(standing_track), "-f", "s16le",
     "-ac", "1", "-ar", str(RATE), "pipe:1"], check=True, capture_output=True,
).stdout
save("win", "Chiến thắng", "Nhạc kết thúc lấy từ Tiến lên.",
     [value / 32768 for (value,) in struct.iter_unpack("<h", win_pcm)], .68)

write(OUT / "00-all-effects.wav", combined)
cards = "\n".join(
    f'<article><h2>{i:02d}. {html.escape(title)}</h2><p>{html.escape(desc)} '
    f'({duration:.2f}s)</p><audio controls preload="none" src="{file}"></audio>'
    f'<a href="{file}" download>Tải WAV</a></article>'
    for i, (file, title, desc, duration) in enumerate(catalog, 1)
)
(OUT / "index.html").write_text('''<!-- biome-ignore-all lint/a11y/useMediaCaption: Nonverbal sound previews have descriptions beside each player. -->
<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nghe thử âm thanh Cờ tỷ phú</title><style>
body{margin:32px auto;padding:0 20px;max-width:920px;background:#f7eedb;color:#483320;
font:16px/1.5 system-ui}h1{font-size:30px}h2{font-size:19px;margin:0}p{margin:8px 0}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
article{background:#fffaf0;border:1px solid #d7bc89;border-radius:14px;padding:18px}
audio{display:block;width:100%;margin:12px 0}a{color:#80521b}
</style></head><body><h1>Nghe thử âm thanh Cờ tỷ phú</h1>
<p>7 hiệu ứng dựng bằng mã; tiếng nhận tiền, mua đất, vào tù dùng Pixabay bạn chọn;
nhạc thắng lấy từ Tiến lên.
Đây là bộ nghe thử, chưa thay âm thanh trong game.</p>
<article><h2>Nghe cả bộ theo thứ tự</h2><p>Mỗi hiệu ứng cách nhau 1,1 giây.
Tiếng bước quân được giữ nhỏ hơn các hiệu ứng còn lại.</p>
<audio controls src="00-all-effects.wav"></audio></article><br><main>'''
    + cards + '</main></body></html>', encoding="utf-8")
(OUT / "README.md").write_text(
    "# Bộ âm thanh nghe thử Cờ tỷ phú\n\n"
    "Mở `index.html` bằng trình duyệt để nghe từng tiếng hoặc cả bộ. "
    "Các file WAV là mono 16 bit, 44.100 Hz. "
    "Bảy hiệu ứng được tổng hợp bằng `../make_audio_preview.py`; tiếng nhận tiền, "
    "mua đất và vào tù dùng file Pixabay bạn cung cấp. Nhạc thắng lấy từ "
    "`games/tien-len/assets/tien-len-standings.mp3`. Chạy lại cần Python và ffmpeg.\n\n"
    + "| Tệp | Hiệu ứng | Độ dài |\n| --- | --- | --- |\n"
    + "\n".join(f"| `{file}` | {title} | {duration:.2f}s |"
                for file, title, _, duration in catalog) + "\n",
    encoding="utf-8",
)
with zipfile.ZipFile(OUT / "co-ty-phu-sfx-preview.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(OUT.iterdir()):
        if path.suffix in {".wav", ".html", ".md", ".mp3"}:
            archive.write(path, path.name)
print(f"Created {len(catalog)} effects, audition page, combined WAV and ZIP in {OUT}")
