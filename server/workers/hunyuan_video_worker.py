import argparse
import base64
import gc
import os
import tempfile
from io import BytesIO
from pathlib import Path

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image


MODEL_ID = os.environ.get(
    "PETDEX_HUNYUAN_MODEL_ID",
    "hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v_step_distilled",
)
DEVICE = os.environ.get("PETDEX_HUNYUAN_DEVICE", "cuda")
WIDTH = int(os.environ.get("PETDEX_HUNYUAN_WIDTH", "832"))
HEIGHT = int(os.environ.get("PETDEX_HUNYUAN_HEIGHT", "480"))
FPS = int(os.environ.get("PETDEX_HUNYUAN_FPS", "24"))
FRAMES = int(os.environ.get("PETDEX_HUNYUAN_FRAMES", "81"))
STEPS = int(os.environ.get("PETDEX_HUNYUAN_STEPS", "12"))
CPU_OFFLOAD = os.environ.get("PETDEX_HUNYUAN_CPU_OFFLOAD", "0") == "1"
NEGATIVE_PROMPT = (
    "low quality, blurry, distorted animal, mutated body, extra legs, missing legs, "
    "bad paws, broken limbs, duplicate animal, identity drift, face deformation, "
    "text, watermark, logo, subtitles, fast camera movement, heavy zoom, flicker"
)


app = FastAPI(title="PetDex HunyuanVideo Worker", version="0.1.0")
_pipe = None


def load_pipe():
    global _pipe
    if _pipe is not None:
        return _pipe

    from diffusers.pipelines.hunyuan_video1_5.pipeline_hunyuan_video1_5_image2video import (
        HunyuanVideo15ImageToVideoPipeline,
    )

    dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    _pipe = HunyuanVideo15ImageToVideoPipeline.from_pretrained(MODEL_ID, torch_dtype=dtype)

    if CPU_OFFLOAD and hasattr(_pipe, "enable_model_cpu_offload"):
        _pipe.enable_model_cpu_offload()
    else:
        _pipe.to(DEVICE)

    if hasattr(_pipe, "vae") and hasattr(_pipe.vae, "enable_tiling"):
        _pipe.vae.enable_tiling()
    if hasattr(_pipe, "enable_attention_slicing"):
        _pipe.enable_attention_slicing()
    return _pipe


def fit_image(image):
    image = image.convert("RGB")
    image.thumbnail((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (WIDTH, HEIGHT), (246, 241, 232))
    canvas.paste(image, ((WIDTH - image.width) // 2, (HEIGHT - image.height) // 2))
    return canvas


def encode_file(path):
    return base64.b64encode(Path(path).read_bytes()).decode("ascii")


def export_frames_to_mp4(frames, fps):
    from diffusers.utils import export_to_video

    out_dir = Path(tempfile.mkdtemp(prefix="petdex-hunyuan-"))
    out_path = out_dir / "petdex_hunyuan.mp4"
    export_to_video(frames, str(out_path), fps=fps)
    return out_path


def generate_video(image, prompt):
    pipe = load_pipe()
    generator = torch.Generator(device=DEVICE).manual_seed(42) if torch.cuda.is_available() else torch.Generator().manual_seed(42)
    kwargs = {
        "image": image,
        "prompt": prompt,
        "negative_prompt": NEGATIVE_PROMPT,
        "num_frames": FRAMES,
        "num_inference_steps": STEPS,
        "generator": generator,
        "output_type": "np",
    }
    result = pipe(**kwargs)
    frames = result.frames[0] if result.frames and isinstance(result.frames[0], list) else result.frames
    return frames


@app.get("/health")
def health():
    return {
        "ok": True,
        "worker": "hunyuanvideo-1.5",
        "modelId": MODEL_ID,
        "device": DEVICE,
        "loaded": _pipe is not None,
        "height": HEIGHT,
        "width": WIDTH,
        "fps": FPS,
        "frames": FRAMES,
        "steps": STEPS,
        "cpuOffload": CPU_OFFLOAD,
    }


@app.post("/v1/pet-video")
async def pet_video(
    image: UploadFile = File(...),
    backend: str = Form("hunyuanvideo-1.5"),
    pet_name: str = Form("pet"),
    tier: str = Form("basic"),
    prompt: str = Form(...),
    output_format: str = Form("mp4"),
    duration_seconds: str = Form("4"),
):
    if output_format != "mp4":
        raise HTTPException(status_code=400, detail="only mp4 output is supported")
    if not backend.startswith("hunyuanvideo"):
        raise HTTPException(status_code=400, detail="this worker only serves hunyuanvideo")

    raw = await image.read()
    input_image = fit_image(Image.open(BytesIO(raw)))
    try:
        frames = generate_video(input_image, prompt)
        mp4_path = export_frames_to_mp4(frames, FPS)
    except torch.cuda.OutOfMemoryError as exc:
        torch.cuda.empty_cache()
        raise HTTPException(status_code=507, detail="GPU out of memory while generating HunyuanVideo") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"HunyuanVideo generation failed: {exc}") from exc
    finally:
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    return {
        "video": {
            "label": f"{pet_name} HunyuanVideo short motion",
            "base64": encode_file(mp4_path),
            "mime": "video/mp4",
            "extension": "mp4",
            "fps": FPS,
            "durationSeconds": round(FRAMES / FPS, 2),
            "sourceModel": "hunyuanvideo-1.5",
            "modelId": MODEL_ID,
            "prompt": prompt,
            "tier": tier,
        }
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8812")))
    args = parser.parse_args()
    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
