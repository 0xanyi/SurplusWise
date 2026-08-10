# Sika brand guide

The Sika symbol is an **S** built from opposing ledger-page stacks. The gold
ribbon represents money moving between personal and business workspaces. Use
the supplied artwork as-is: do not redraw it, add effects, or recolor individual
parts.

## Artwork

Production files live in [`public/brand`](../public/brand):

- `sika-logo-horizontal.svg` — preferred lockup on light backgrounds
- `sika-logo-horizontal-dark.svg` — preferred lockup on dark backgrounds
- `sika-mark.svg` — full-color symbol for light backgrounds
- `sika-mark-mono.svg` — one-color dark symbol
- `sika-mark-reversed.svg` — one-color ivory symbol for dark backgrounds
- `sika-favicon.svg` — small-size symbol on its own background

The horizontal SVGs use outlined Bricolage Grotesque letterforms. They do not
depend on an installed font and will render consistently in browsers, print,
and design tools.

Use the horizontal lockup when introducing Sika, in marketing, and wherever
space allows. Use the symbol alone for app icons, favicons, avatars, and places
where the Sika name is already visible or understood.

## Colors

| Role | Hex |
| --- | --- |
| Deep ink | `#111318` |
| Sika cobalt | `#2B6BF3` |
| Warm gold | `#B58A3A` |
| Warm ivory | `#F5F1E8` |

Use the full-color mark on warm ivory, white, or similarly light neutral
backgrounds. On dark backgrounds, use the dark horizontal lockup or the
one-color reversed mark. The monochrome variants are for processes that can
only reproduce one color.

## Clear space and minimum size

Keep clear space equal to at least **one quarter of the symbol's height** on
all sides. Measure from the visible artwork, not the SVG view box.

- Horizontal lockup: at least 100 px wide on screen or 26 mm in print.
- Full-color symbol: at least 24 px high on screen.
- Below 24 px: use `sika-favicon.svg` or the supplied favicon assets.

Do not crop the symbol, compress or stretch it, rotate it, place it on a busy
image, change its proportions, or add outlines, gradients, shadows, or other
effects. App icons already include the safe area required by platform masks;
do not enlarge the symbol inside them.

## Raster exports

| File | Size | Use |
| --- | --- | --- |
| `public/favicon.ico` | 16, 32, and 48 px | Browser favicon |
| `public/apple-touch-icon.png` | 180×180 px | Apple home-screen icon |
| `public/icon-192.png` | 192×192 px | PWA icon with maskable safe area |
| `public/icon-512.png` | 512×512 px | PWA icon with maskable safe area |
| `public/og-image.png` | 1200×630 px | Open Graph and social sharing |

These files are generated exports. Recreate them from the approved SVG mark
rather than editing them independently. Their public paths are part of the PWA
manifest and metadata contracts and should remain stable unless those references
are updated at the same time.

The updated install icons are guaranteed for new installations. Browser-managed
icons for an already installed PWA may remain unchanged until the app is
reinstalled, particularly on desktop platforms.
