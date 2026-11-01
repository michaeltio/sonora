# Sonora Project Context

## Product goal

Sonora is an accessible English audio-guide web app for Indonesian art and heritage. A user uploads or photographs an object, and Sonora describes what can be seen in clear, emotionally engaging language that works well for blind and low-vision listeners.

## Initial Pareto scope

Prioritize these three categories:

1. **Painting** — portraits, landscapes, historical scenes, abstract works, and local/unknown paintings.
2. **Sculpture** — statues, stone or wooden figures, temple objects, ritual objects, and contemporary sculpture.
3. **Textile** — batik, songket, ulos, ikat, tenun, endek, tapis, and other Indonesian fabrics.

Do not expand into every cultural category before these three have high-quality narration. Architecture, masks/wayang, instruments, costumes, and performances are later phases.

## Identity and uncertainty policy

The model must first decide whether the work can be reliably identified:

- `identified`: strong visible evidence such as a readable label, signature, distinctive landmark, or highly specific known composition.
- `possible`: plausible but unverified identity.
- `unknown`: insufficient evidence.

Never infer a famous artist from style, colors, subject matter, or brushwork alone. Never invent provenance, exhibition history, symbolism, dates, or historical context.

When identity is `possible` or `unknown`, the narration must be visual-only and should explicitly communicate that the title/artist cannot be confirmed from the image. The narration should focus on visible evidence.

## Narration requirements

- Primary language: **English**.
- Length: **120–150 words**, target approximately 140 words.
- Understandable after one listening.
- Prefer sentences of 8–18 words.
- Do not use “Once upon a time.”
- Do not use hex color codes in narration.
- Use familiar color names: brick red, deep blue, warm cream, golden yellow, moss green, earth brown, ivory white.
- Use concrete, imaginable language for blind/low-vision listeners.
- Describe spatial relationships: left, right, center, foreground, background, behind, near the lower edge.
- Describe shape, size, posture, expression, gesture, material, texture, light, shadow, distance, and emotional atmosphere.
- Avoid overly academic language, long object lists, unsupported metaphors, and invented details.

## Category-specific description

- Painting: composition, figures, light, palette, brushwork, expression, atmosphere.
- Sculpture: three-dimensional form, pose, material, texture, volume, front/side orientation, attributes.
- Textile: repeated pattern, symmetry, motif direction, weave, density, surface texture, thread shine, borders.

Do not claim an exact textile motif from visual resemblance alone. Use language such as “resembles” or “cannot be confirmed” when needed.

## Audio direction

The long-term one-click experience is:

`upload → classify → identify if reliable → generate narration → generate/get TTS → generate/get subtle background music → play narration and music together`

Narration must remain the dominant track. Music should be instrumental, without vocals or a dominant melody, and should leave space for speech. Use Web Audio API for mixing, low music volume, fade-in/fade-out, and ducking during speech.

For UI testing, mock mode must not call AI or TTS APIs. It should return static narration immediately and use browser/local mock audio. Production AI mode may call Muse and the TTS/music providers.

## Technical architecture

- Next.js App Router, React, TypeScript, Bun.
- `/` is the scan page.
- `/history` is local device history.
- `/api/generate` supports mock and AI generation.
- `/api/describe` handles Muse vision and accessible narration packaging.
- `/api/tts` handles production TTS when enabled.
- Browser image compression is required before AI upload.
- Keep API keys server-side.
- Use localStorage for current history unless a database is explicitly added.

## UI direction

- Warm museum palette: parchment, burnt sienna, deep umber.
- Desktop and mobile compatible.
- One primary upload button, followed by a modal offering camera or gallery.
- Preserve image aspect ratio with `object-contain`; never crop artwork.
- Keep header and body containers aligned.
- Use the provided Sonora logo assets from `/public/logo.svg` and `/public/logo.png`.
- Developer-only controls such as Mock/AI mode may be shown in development but hidden in production.

## Product positioning

Sonora is not merely a painting classifier. It is an accessible audio guide for Indonesian visual art and heritage, beginning with paintings, sculptures, and textiles.

Suggested product promise:

> Scan Indonesian art. Hear every detail.
