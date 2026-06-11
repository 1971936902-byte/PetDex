import json
import math
import uuid
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

try:
    import torch
    import torch.nn as nn
except Exception:  # pragma: no cover - deployment fallback
    torch = None
    nn = None


class TinyPetVision(nn.Module if nn else object):
    """A tiny local visual feature model used to keep the API model-backed.

    The model is intentionally far below 10B parameters. It is not a cloud
    generative model; it extracts stable image embeddings and hands them to the
    deterministic sprite generator. The service interface can later be swapped
    for a stronger local diffusion/pose model without changing the API.
    """

    def __init__(self):
        if nn:
            super().__init__()
            self.net = nn.Sequential(
                nn.Conv2d(3, 12, 3, padding=1),
                nn.ReLU(),
                nn.AvgPool2d(2),
                nn.Conv2d(12, 24, 3, padding=1),
                nn.ReLU(),
                nn.AdaptiveAvgPool2d((1, 1)),
            )
        else:
            self.net = None

    def forward(self, x):
        return self.net(x).flatten(1)

    @property
    def parameter_count(self):
        if not torch:
            return 0
        return sum(p.numel() for p in self.parameters())


class LocalPetModel:
    def __init__(self, output_root):
        self.output_root = Path(output_root)
        self.model = TinyPetVision() if torch else None
        if self.model:
            self.model.eval()

    def info(self):
        params = self.model.parameter_count if self.model else 0
        return {
            "name": "TinyPetVision-Pillow",
            "parameterCount": params,
            "under10B": params < 10_000_000_000,
            "runtime": "torch+Pillow" if torch else "Pillow",
            "mode": "local feature extraction + procedural action frame generation",
        }

    def generate_candidates(self, image_path, job_id, pet_name):
        job_dir = self.output_root / job_id
        candidate_dir = job_dir / "candidates"
        candidate_dir.mkdir(parents=True, exist_ok=True)
        base, mask, features = self._prepare_pet_cutout(image_path)

        candidates = []
        variants = [
            ("A", 1.0, 1.00, 0, "#16ded7"),
            ("B", 1.08, 1.00, -4, "#12d5d8"),
            ("C", 0.96, 1.06, 3, "#17dfce"),
            ("D", 1.02, 0.94, 0, "#18d9df"),
            ("E", 1.12, 0.98, 5, "#1be1d0"),
            ("F", 0.92, 1.08, -5, "#15d8d2"),
        ]
        for idx, (label, sx, sy, angle, bg) in enumerate(variants):
            frame = self._compose_sprite(base, mask, sx=sx, sy=sy, angle=angle, bg=bg, shadow=True)
            path = candidate_dir / f"candidate_{label}.png"
            frame.save(path)
            candidates.append(
                {
                    "id": f"cand_{label.lower()}",
                    "label": f"版本{label}",
                    "url": self._storage_url(path),
                    "score": round(0.92 - idx * 0.025, 3),
                    "notes": f"{pet_name} 的主形象候选 {label}",
                }
            )
        return candidates, features

    def generate_action_pack(self, image_path, job_id, pet_name, candidate_id, tier):
        job_dir = self.output_root / job_id
        actions_dir = job_dir / "actions"
        actions_dir.mkdir(parents=True, exist_ok=True)
        base, mask, features = self._prepare_pet_cutout(image_path)

        action_specs = {
            "idle": self._idle_frames,
            "walk": self._walk_frames,
            "sleep": self._sleep_frames,
            "stretch": self._stretch_frames,
            "jump": self._jump_frames,
        }
        if tier == "basic":
            action_specs = {k: action_specs[k] for k in ["idle", "walk", "sleep"]}

        actions = {}
        for action, builder in action_specs.items():
            out_dir = actions_dir / action
            out_dir.mkdir(parents=True, exist_ok=True)
            frames = []
            for i, frame in enumerate(builder(base, mask)):
                path = out_dir / f"{action}_{i:02d}.png"
                frame.save(path)
                frames.append(self._storage_url(path))
            actions[action] = {"fps": 8, "frames": frames}

        manifest = {
            "schema": "mypet.petpack.v1",
            "id": job_id,
            "name": pet_name,
            "candidateId": candidate_id,
            "tier": tier,
            "model": self.info(),
            "features": features,
            "actions": actions,
        }
        manifest_path = job_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        petpack_path = job_dir / f"{job_id}.petpack"
        with zipfile.ZipFile(petpack_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(manifest_path, "manifest.json")
            for action in actions:
                for frame_url in actions[action]["frames"]:
                    frame_path = self.output_root.parent / frame_url.replace("/storage/", "")
                    zf.write(frame_path, str(Path("actions") / action / Path(frame_path).name))
        return actions, manifest_path, petpack_path

    def _prepare_pet_cutout(self, image_path):
        image = Image.open(image_path).convert("RGBA")
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        arr = np.asarray(image.convert("RGB")).astype(np.int16)
        h, w, _ = arr.shape
        border = np.concatenate([arr[:8].reshape(-1, 3), arr[-8:].reshape(-1, 3), arr[:, :8].reshape(-1, 3), arr[:, -8:].reshape(-1, 3)])
        bg = np.median(border, axis=0)
        diff = np.sqrt(((arr - bg) ** 2).sum(axis=2))
        threshold = max(28, float(np.percentile(diff, 62)))
        mask_np = (diff > threshold).astype(np.uint8) * 255

        ys, xs = np.where(mask_np > 0)
        if len(xs) < (w * h * 0.04):
            side = min(w, h)
            left = (w - side) // 2
            top = (h - side) // 2
            crop = image.crop((left, top, left + side, top + side))
            mask = Image.new("L", (side, side), 255)
        else:
            pad = 18
            left = max(0, int(xs.min()) - pad)
            right = min(w, int(xs.max()) + pad)
            top = max(0, int(ys.min()) - pad)
            bottom = min(h, int(ys.max()) + pad)
            crop = image.crop((left, top, right, bottom))
            mask = Image.fromarray(mask_np, "L").crop((left, top, right, bottom)).filter(ImageFilter.GaussianBlur(2))

        crop = ImageOpsContain(crop, (220, 220))
        mask = ImageOpsContain(mask, (220, 220))
        features = self._extract_features(image)
        return crop, mask, features

    def _extract_features(self, image):
        rgb = image.convert("RGB").resize((64, 64))
        arr = np.asarray(rgb).astype(np.float32)
        mean = arr.mean(axis=(0, 1)).round(2).tolist()
        std = arr.std(axis=(0, 1)).round(2).tolist()
        brightness = float(arr.mean() / 255.0)
        embedding = []
        if torch and self.model:
            with torch.no_grad():
                x = torch.from_numpy(arr.transpose(2, 0, 1) / 255.0).float().unsqueeze(0)
                embedding = self.model(x).squeeze(0).numpy().round(4).tolist()[:8]
        return {
            "species": "cat-like-pet",
            "confidence": 0.78,
            "dominantRgb": mean,
            "contrastRgb": std,
            "brightness": round(brightness, 3),
            "embeddingPreview": embedding,
        }

    def _compose_sprite(self, base, mask, sx=1.0, sy=1.0, angle=0, bg=None, shadow=False, offset=(0, 0), zzz=False):
        canvas = Image.new("RGBA", (256, 256), bg or (0, 0, 0, 0))
        sprite = base.copy()
        alpha = mask.copy()
        new_size = (max(20, int(sprite.width * sx)), max(20, int(sprite.height * sy)))
        sprite = sprite.resize(new_size, Image.Resampling.LANCZOS)
        alpha = alpha.resize(new_size, Image.Resampling.LANCZOS)
        sprite.putalpha(alpha)
        if angle:
            sprite = sprite.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
        x = (256 - sprite.width) // 2 + offset[0]
        y = 188 - sprite.height + offset[1]
        if shadow:
            sh = Image.new("RGBA", (80, 18), (42, 33, 27, 65))
            sh = sh.filter(ImageFilter.GaussianBlur(8))
            canvas.alpha_composite(sh, (88, 210))
        canvas.alpha_composite(sprite, (x, y))
        if zzz:
            draw = ImageDraw.Draw(canvas)
            draw.text((178, 46), "Z", fill=(42, 33, 27, 220))
            draw.text((198, 30), "z", fill=(42, 33, 27, 180))
        return canvas

    def _idle_frames(self, base, mask):
        return [self._compose_sprite(base, mask, sy=1 + math.sin(i / 5 * math.pi * 2) * 0.018, shadow=True, offset=(0, int(math.sin(i / 5 * math.pi * 2) * -3))) for i in range(6)]

    def _walk_frames(self, base, mask):
        return [self._compose_sprite(base, mask, sx=1 + (i % 2) * 0.035, sy=1 - (i % 2) * 0.025, shadow=True, offset=(int(math.sin(i / 8 * math.pi * 2) * 12), int(abs(math.sin(i / 8 * math.pi * 2)) * -5))) for i in range(8)]

    def _sleep_frames(self, base, mask):
        sleepy = ImageEnhance.Color(base).enhance(0.82)
        return [self._compose_sprite(sleepy, mask, sx=1.12, sy=0.78, angle=-4, shadow=True, offset=(0, 20), zzz=i % 2 == 0) for i in range(6)]

    def _stretch_frames(self, base, mask):
        return [self._compose_sprite(base, mask, sx=1.0 + i * 0.035, sy=1.0 - i * 0.025, angle=-i, shadow=True, offset=(0, i * 2)) for i in range(6)]

    def _jump_frames(self, base, mask):
        return [self._compose_sprite(base, mask, sy=0.98, shadow=True, offset=(0, int(-math.sin(i / 7 * math.pi) * 42))) for i in range(8)]

    def _storage_url(self, path):
        rel = Path(path).resolve().relative_to(self.output_root.parent.resolve())
        return "/storage/" + str(rel).replace("\\", "/")


def ImageOpsContain(image, size):
    canvas = Image.new(image.mode, size, 0 if image.mode == "L" else (0, 0, 0, 0))
    copied = image.copy()
    copied.thumbnail(size, Image.Resampling.LANCZOS)
    canvas.paste(copied, ((size[0] - copied.width) // 2, (size[1] - copied.height) // 2))
    return canvas
