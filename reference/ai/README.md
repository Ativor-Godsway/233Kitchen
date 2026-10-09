# AI image assets (+233 Kitchen)

- dishes/       Plated hero/menu photos (Gemini, re-plated from the owner's real photos). waakye-fish and braised-rice were warm-graded to match the others.
- icons/        Original Gemini icon renders (white background).
- icons-cutout/ Full-resolution transparent cutouts (AI segmentation, isnet-general-use), shadows removed.

Processed outputs:
- public/images/{dish}-{480,960,1600}.webp   plated photos (1600 is a Lanczos upscale of the 1024px source)
- public/images/box/{dish}-*.webp            the original real box photos ("What you'll receive")
- public/icons/{name}-{128,256}.webp + {name}-256.png   transparent, square, ~5% padding, no baked shadow

Dish files: banku-tilapia, fried-rice-chicken, waakye-fish, braised-rice, ice-kenkey
Icon names: shito, red-sauce, stew, coleslaw, chicken, plantain, banku, tilapia, fish, eggs,
kenkey-vanilla, kenkey-caramel, kenkey-strawberry, kenkey-oreo, nuts,
sausage, corned-beef, sardine, gizzard, omelette
