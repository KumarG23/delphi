#!/usr/bin/env python3
"""Generate launcher assets from the DelphiAvatar geometry."""

from pathlib import Path
from PIL import Image, ImageDraw

SCALE = 4
SIZE = 1024
OUT = Path(__file__).resolve().parents[1] / "assets" / "images"

CHARCOAL = "#141414"
CAT = "#0F0F0F"
CREAM = "#FAFBF8"
GREEN = "#00E875"
PINK = "#FF8FA8"
WHITE = "#FFFFFF"


def points(values, origin, scale):
    ox, oy = origin
    return [((ox + x * scale) * SCALE, (oy + y * scale) * SCALE) for x, y in values]


def quadratic(a, b, c, steps=32):
    result = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        result.append((
            u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
            u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
        ))
    return result


def draw_avatar(draw, origin, scale):
    ox, oy = origin

    def box(cx, cy, rx, ry):
        return (
            (ox + (cx - rx) * scale) * SCALE,
            (oy + (cy - ry) * scale) * SCALE,
            (ox + (cx + rx) * scale) * SCALE,
            (oy + (cy + ry) * scale) * SCALE,
        )

    draw.ellipse(box(50, 55, 34, 30), fill=CAT)
    draw.polygon(points([(20, 38), (26, 16), (38, 32)], origin, scale), fill=CAT)
    draw.polygon(points([(62, 32), (74, 16), (80, 38)], origin, scale), fill=CAT)
    draw.polygon(points([(25, 32), (28, 21), (33, 31)], origin, scale), fill=PINK)
    draw.polygon(points([(67, 31), (72, 21), (75, 32)], origin, scale), fill=PINK)

    muzzle = (
        quadratic((30, 58), (26, 80), (50, 82))
        + quadratic((50, 82), (74, 80), (70, 58))[1:]
        + quadratic((70, 58), (60, 56), (50, 63))[1:]
        + quadratic((50, 63), (40, 56), (30, 58))[1:]
    )
    draw.polygon(points(muzzle, origin, scale), fill=WHITE)

    for cx in (40, 60):
        draw.ellipse(box(cx, 52, 4.6, 5.6), fill=GREEN)
        draw.ellipse(box(cx, 52, 1.2, 4.5), fill="#050505")
        draw.ellipse(box(cx + 1.6, 50.4, 0.9, 0.9), fill=WHITE)

    draw.polygon(points([(47, 64), (53, 64), (50, 68)], origin, scale), fill=PINK)
    width = max(1, round(0.9 * scale * SCALE))
    left_mouth = points(quadratic((50, 68), (50, 72), (46, 72), 16), origin, scale)
    right_mouth = points(quadratic((50, 68), (50, 72), (54, 72), 16), origin, scale)
    draw.line(left_mouth, fill=CAT, width=width, joint="curve")
    draw.line(right_mouth, fill=CAT, width=width, joint="curve")

    whisker_width = max(1, round(0.55 * scale * SCALE))
    for start, end in [
        ((34, 66), (20, 64)), ((34, 69), (20, 70)),
        ((66, 66), (80, 64)), ((66, 69), (80, 70)),
    ]:
        draw.line(points([start, end], origin, scale), fill=CAT, width=whisker_width)


def make_badge(transparent=False):
    mode = "RGBA"
    bg = (0, 0, 0, 0) if transparent else CHARCOAL
    image = Image.new(mode, (SIZE * SCALE, SIZE * SCALE), bg)
    draw = ImageDraw.Draw(image)

    center = SIZE * SCALE // 2
    outer_radius = 356 * SCALE
    inner_radius = 332 * SCALE
    draw.ellipse((center - outer_radius, center - outer_radius, center + outer_radius, center + outer_radius), fill=GREEN)
    draw.ellipse((center - inner_radius, center - inner_radius, center + inner_radius, center + inner_radius), fill=CREAM)

    avatar_scale = 5.65
    avatar_origin = ((SIZE - 100 * avatar_scale) / 2, (SIZE - 100 * avatar_scale) / 2 + 8)
    draw_avatar(draw, avatar_origin, avatar_scale)
    return image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    full = make_badge(transparent=False)
    foreground = make_badge(transparent=True)

    full.convert("RGB").save(OUT / "icon.png", optimize=True)
    foreground.save(OUT / "adaptive-icon.png", optimize=True)
    foreground.save(OUT / "splash-icon.png", optimize=True)
    full.resize((48, 48), Image.Resampling.LANCZOS).save(OUT / "favicon.png", optimize=True)
    full.resize((512, 512), Image.Resampling.LANCZOS).save(OUT / "delphi-icon-preview.png", optimize=True)


if __name__ == "__main__":
    main()
