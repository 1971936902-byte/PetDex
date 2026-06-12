# PetDex backend deployment

## Current server

- Application directory: `/opt/petdex`
- Public URL: `http://223.109.239.36:44100`
- Public port mapping: `44100 -> 8800`
- Main service: `petdex.service`
- Main listen address: `0.0.0.0:8800`
- GPU: `NVIDIA A800-SXM4-40GB`

## Model strategy

The product flow now uses a dedicated GPU worker for paid motion generation.

- Primary backend: `hunyuanvideo-1.5`
- Worker service: `petdex-hunyuan-worker.service`
- Worker listen address: `127.0.0.1:8812`
- Worker contract: `POST /v1/pet-video`
- Delivery format: MP4 short video
- Legacy worker kept for fallback experiments: `petdex-ltx-worker.service` on `127.0.0.1:8811`

The main Flask service still stores generated results in the existing `petpack_url`
column for compatibility, but when HunyuanVideo is enabled that URL points to an
MP4 file instead of a `.petpack` archive. The frontend detects
`actions.short_video` and renders an HTML5 video preview plus MP4 download.

## Main service environment

```ini
Environment=PETDEX_VIDEO_BACKEND=hunyuanvideo-1.5
Environment=PETDEX_VIDEO_ENDPOINT=http://127.0.0.1:8812
Environment=PETDEX_VIDEO_TIMEOUT=3600
Environment=PETDEX_VIDEO_REQUIRED=1
```

## HunyuanVideo worker environment

```ini
Environment=PETDEX_HUNYUAN_MODEL_ID=hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v_step_distilled
Environment=PETDEX_HUNYUAN_WIDTH=832
Environment=PETDEX_HUNYUAN_HEIGHT=480
Environment=PETDEX_HUNYUAN_FRAMES=81
Environment=PETDEX_HUNYUAN_FPS=24
Environment=PETDEX_HUNYUAN_STEPS=12
Environment=PETDEX_HUNYUAN_CPU_OFFLOAD=0
```

The worker lazy-loads the 8.3B model on first generation so the health endpoint
can respond before weights are loaded.

## API flow

1. `POST /api/pet-jobs`: upload the pet image and create candidates.
2. `POST /api/pet-jobs/:id/select-candidate`: choose the best candidate.
3. `POST /api/orders`: create the mock order.
4. `POST /api/orders/:id/confirm-mock`: simulate payment confirmation.
5. `POST /api/pet-jobs/:id/generate-pack`: call HunyuanVideo worker and persist MP4.
6. `GET /api/pets/:id/download`: download the MP4 generated for that job.

## Health checks

```bash
curl http://127.0.0.1:8812/health
curl http://127.0.0.1:8800/api/health
curl http://223.109.239.36:44100/api/health
```
