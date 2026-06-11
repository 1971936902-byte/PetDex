# PetDex

PetDex is a frontend + local backend prototype for an AI desktop pet website.

Open `index.html` directly in a browser to view the site. The prototype includes:

- Home page with PetDex Studio branding, upload CTA, case cards, and process steps.
- Studio workflow with upload form, generation state, candidate selection, package selection, payment mock, and completion state.
- Art album, library, cloud plaza, desktop client download, pricing, and FAQ pages.
- Warm handmade visual style matching the reference documents under `docs/`.

The current deployment uses a Flask backend on port `8800`. It serves the static frontend and exposes the MVP APIs:

- `GET /api/health`
- `POST /api/pet-jobs`
- `POST /api/pet-jobs/:id/select-candidate`
- `POST /api/orders`
- `POST /api/orders/:id/confirm-mock`
- `POST /api/pet-jobs/:id/generate-pack`
- `GET /api/pets`
- `GET /api/pets/:id/download`

The image generation path uses `TinyPetVision-Pillow`, a local lightweight PyTorch/Pillow pipeline far below 10B parameters. It extracts visual features from the uploaded cat image, creates six candidate PNGs, generates action frames, and packages them into `.petpack`.
