import argparse
import base64
import gc
import json
import os
import types
from io import BytesIO
from pathlib import Path

import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, ImageFilter


MODEL_ID = os.environ.get("PETDEX_LTX_MODEL_ID", "Lightricks/LTX-Video")
DEVICE = os.environ.get("PETDEX_LTX_DEVICE", "cuda")
HEIGHT = int(os.environ.get("PETDEX_LTX_HEIGHT", "256"))
WIDTH = int(os.environ.get("PETDEX_LTX_WIDTH", "256"))
STEPS = int(os.environ.get("PETDEX_LTX_STEPS", "8"))
MAX_ACTIONS = int(os.environ.get("PETDEX_LTX_MAX_ACTIONS", "9"))
NEGATIVE_PROMPT = (
    "blurry, jittery, distorted body, extra legs, missing legs, mutated animal, "
    "text, watermark, logo, cropped body, camera shake, harsh background"
)


app = FastAPI(title="PetDex LTX-Video Worker", version="0.1.0")
_pipe = None


def load_pipe():
    global _pipe
    if _pipe is not None:
        return _pipe

    if not hasattr(torch, "xpu"):
        class _MissingXpu:
            @staticmethod
            def empty_cache():
                return None

            @staticmethod
            def device_count():
                return 0

            @staticmethod
            def is_available():
                return False

            @staticmethod
            def manual_seed(seed):
                return None

            def __getattr__(self, name):
                def _missing(*args, **kwargs):
                    return None

                return _missing

        torch.xpu = _MissingXpu()
    if hasattr(torch, "distributed") and not hasattr(torch.distributed, "device_mesh"):
        torch.distributed.device_mesh = types.SimpleNamespace(DeviceMesh=object)

    from diffusers.pipelines.ltx import LTXImageToVideoPipeline

    dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    try:
        _pipe = LTXImageToVideoPipeline.from_pretrained(MODEL_ID, torch_dtype=dtype)
    except TypeError:
        _pipe = LTXImageToVideoPipeline.from_pretrained(MODEL_ID)
    _pipe.to(DEVICE)

    if hasattr(_pipe, "vae") and hasattr(_pipe.vae, "enable_tiling"):
        _pipe.vae.enable_tiling()
    if hasattr(_pipe, "enable_attention_slicing"):
        _pipe.enable_attention_slicing()
    return _pipe


def fit_image(image):
    image = image.convert("RGB")
    image.thumbnail((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (WIDTH, HEIGHT), (245, 242, 236))
    canvas.paste(image, ((WIDTH - image.width) // 2, (HEIGHT - image.height) // 2))
    return canvas


def make_transparent(frame):
    rgba = frame.convert("RGBA")
    arr = np.asarray(rgba.convert("RGB")).astype(np.int16)
    h, w, _ = arr.shape
    border = np.concatenate(
        [
            arr[:6].reshape(-1, 3),
            arr[-6:].reshape(-1, 3),
            arr[:, :6].reshape(-1, 3),
            arr[:, -6:].reshape(-1, 3),
        ]
    )
    bg = np.median(border, axis=0)
    diff = np.sqrt(((arr - bg) ** 2).sum(axis=2))
    threshold = max(20, min(62, float(np.percentile(diff, 48))))
    bg_like = diff <= threshold

    visited = np.zeros((h, w), dtype=bool)
    stack = []

    def add(y, x):
        if 0 <= y < h and 0 <= x < w and bg_like[y, x] and not visited[y, x]:
            visited[y, x] = True
            stack.append((y, x))

    for x in range(w):
        add(0, x)
        add(h - 1, x)
    for y in range(h):
        add(y, 0)
        add(y, w - 1)
    while stack:
        y, x = stack.pop()
        add(y - 1, x)
        add(y + 1, x)
        add(y, x - 1)
        add(y, x + 1)

    alpha = (~visited).astype(np.uint8) * 255
    mask = Image.fromarray(alpha, "L").filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    rgba.putalpha(mask)
    return rgba


def encode_png(image):
    buf = BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def call_ltx(pipe, image, prompt, frames):
    generated_frames = max(9, (((frames - 1) + 7) // 8) * 8 + 1)
    kwargs = {
        "image": image,
        "prompt": prompt,
        "negative_prompt": NEGATIVE_PROMPT,
        "height": HEIGHT,
        "width": WIDTH,
        "num_frames": generated_frames,
        "frame_rate": 8,
        "num_inference_steps": STEPS,
        "guidance_scale": 3,
        "generator": torch.Generator(device=DEVICE).manual_seed(42),
    }
    try:
        result = pipe(**kwargs)
    except TypeError:
        kwargs.pop("negative_prompt", None)
        result = pipe(**kwargs)

    output_frames = result.frames[0] if result.frames and isinstance(result.frames[0], list) else result.frames
    return output_frames[:frames]


@app.get("/health")
def health():
    return {
        "ok": True,
        "worker": "ltx-video",
        "modelId": MODEL_ID,
        "device": DEVICE,
        "loaded": _pipe is not None,
        "height": HEIGHT,
        "width": WIDTH,
        "steps": STEPS,
        "maxActions": MAX_ACTIONS,
    }


@app.post("/v1/pet-actions")
async def pet_actions(
    image: UploadFile = File(...),
    backend: str = Form("ltx-video"),
    pet_name: str = Form("pet"),
    tier: str = Form("basic"),
    action_plan_json: str = Form(...),
    output_format: str = Form("png_frames_rgba"),
):
    if output_format != "png_frames_rgba":
        raise HTTPException(status_code=400, detail="only png_frames_rgba is supported")
    if backend not in {"ltx-video", "ltx"}:
        raise HTTPException(status_code=400, detail="this worker only serves ltx-video")

    try:
        action_plan = json.loads(action_plan_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="invalid action_plan_json") from exc

    action_plan = action_plan[:MAX_ACTIONS]
    raw = await image.read()
    input_image = fit_image(Image.open(BytesIO(raw)))
    pipe = load_pipe()

    actions = {}
    for item in action_plan:
        key = item["key"]
        frame_count = min(int(item.get("frames") or 12), 16)
        prompt = (
            f"{item.get('prompt') or ''}. Keep the same cat identity, fur pattern and face. "
            "A single full-body desktop pet on a simple light background, smooth natural motion, loopable."
        )
        try:
            frames = call_ltx(pipe, input_image, prompt, frame_count)
        except torch.cuda.OutOfMemoryError as exc:
            torch.cuda.empty_cache()
            raise HTTPException(status_code=507, detail="GPU out of memory while generating video") from exc

        png_frames = [encode_png(make_transparent(frame)) for frame in frames]
        actions[key] = {
            "label": item.get("label") or key,
            "fps": int(item.get("fps") or 8),
            "loop": True,
            "frames": png_frames,
        }
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    return {"actions": actions}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8811")))
    args = parser.parse_args()
    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
