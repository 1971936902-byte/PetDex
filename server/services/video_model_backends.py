import base64
import json
import os
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image


class VideoBackendError(RuntimeError):
    pass


ACTION_PROMPTS = {
    "idle": "the pet breathes gently while standing still, subtle head and body motion",
    "walk_right": "the pet walks to the right with natural leg motion, stable body, loopable",
    "walk_left": "the pet walks to the left with natural leg motion, stable body, loopable",
    "sleep": "the pet lies down and sleeps peacefully with slow breathing",
    "sit": "the pet sits down and waits, slight head motion",
    "jump": "the pet makes a small cute jump and lands softly",
    "stretch": "the pet stretches its front legs and body like waking up",
    "run": "the pet trots quickly with clear leg motion, loopable side view",
    "shake": "the pet happily wiggles and shakes its body",
}


class ExternalVideoBackend:
    """Adapter for a separate GPU video-generation worker.

    The PetDex Flask app stays small and stable. Heavy models such as LTX-Video,
    AnimateDiff-Lightning, and HunyuanVideo should run as a separate worker,
    preferably through ComfyUI or a dedicated FastAPI process.
    """

    def __init__(self, output_root):
        self.output_root = Path(output_root)
        self.backend = os.environ.get("PETDEX_VIDEO_BACKEND", "hunyuanvideo-1.5").strip() or "hunyuanvideo-1.5"
        self.endpoint = os.environ.get("PETDEX_VIDEO_ENDPOINT", "").rstrip("/")
        self.token = os.environ.get("PETDEX_VIDEO_TOKEN", "")
        self.timeout = int(os.environ.get("PETDEX_VIDEO_TIMEOUT", "900"))
        self.required = os.environ.get("PETDEX_VIDEO_REQUIRED", "1") == "1"

    @property
    def configured(self):
        return self.backend != "procedural" and bool(self.endpoint)

    def info(self):
        return {
            "backend": self.backend,
            "configured": self.configured,
            "endpointConfigured": bool(self.endpoint),
            "required": self.required,
            "contract": "POST /v1/pet-video for HunyuanVideo MP4; POST /v1/pet-actions for legacy PNG action frames",
            "fallback": "disabled",
        }

    def generate_action_pack(self, image_path, job_id, pet_name, candidate_id, tier):
        if not self.configured:
            raise VideoBackendError("external video backend is not configured")

        if self.backend.startswith("hunyuanvideo"):
            response = self._post_worker_video(image_path, pet_name, tier)
            return self._persist_worker_video(response, job_id, candidate_id, tier)

        action_keys = ["idle", "walk_right", "walk_left", "sleep", "sit"]
        if tier != "basic":
            action_keys += ["jump", "stretch", "run", "shake"]

        action_plan = [
            {
                "key": key,
                "label": {
                    "idle": "待机呼吸",
                    "walk_right": "向右走",
                    "walk_left": "向左走",
                    "sleep": "趴下睡觉",
                    "sit": "坐下等待",
                    "jump": "轻轻跳跃",
                    "stretch": "伸懒腰",
                    "run": "小跑巡游",
                    "shake": "开心摇摆",
                }[key],
                "prompt": self._prompt_for(key, pet_name),
                "fps": 8 if key in {"idle", "sit", "stretch"} else 10,
                "frames": 16 if key in {"walk_right", "walk_left", "run"} else 12,
                "transparent": True,
            }
            for key in action_keys
        ]

        response = self._post_worker(image_path, pet_name, tier, action_plan)
        return self._persist_worker_frames(response, job_id, candidate_id, tier)

    def _video_prompt_for(self, pet_name, tier):
        motion = (
            "The pet performs a natural short sequence: attentive idle breathing, "
            "turning its head, taking two small steps, a cute stretch, then settling back. "
            "The legs, paws, tail, head, and body posture should visibly change over time."
        )
        if tier != "basic":
            motion = (
                "The pet performs a richer continuous desktop-pet sequence: idle breathing, "
                "head turn, walking two steps, playful hop, full-body stretch, then sitting. "
                "Show clear limb articulation, paw contact, tail movement, and stable identity."
            )
        return (
            f"{pet_name}, the exact pet from the reference image, as a cute desktop companion. "
            f"{motion} Keep the same fur pattern, face, eye color, body proportions, and markings. "
            "Single animal only, full body visible, smooth coherent motion, no camera movement, "
            "plain clean background, no text, no watermark, no extra limbs, no morphing."
        )

    def _prompt_for(self, action_key, pet_name):
        model_hint = {
            "ltx-video": "Use image-to-video conditioning, short loop, preserve the exact pet identity.",
            "animatediff-lightning": "Use the input image as reference, short loop, clean motion, no camera movement.",
            "hunyuanvideo-1.5": "Use image-to-video generation, preserve pet identity and fur pattern, short clip.",
        }.get(self.backend, "Use image-to-video generation and preserve pet identity.")
        return (
            f"{pet_name}, a cute desktop pet. {ACTION_PROMPTS[action_key]}. "
            "transparent or plain clean background, full body visible, no text, no watermark. "
            f"{model_hint}"
        )

    def _post_worker(self, image_path, pet_name, tier, action_plan):
        boundary = "----PetDexVideoBoundary"
        image_bytes = Path(image_path).read_bytes()
        fields = {
            "backend": self.backend,
            "pet_name": pet_name,
            "tier": tier,
            "action_plan_json": json.dumps(action_plan, ensure_ascii=False),
            "output_format": "png_frames_rgba",
        }
        body = bytearray()
        for name, value in fields.items():
            body.extend(f"--{boundary}\r\n".encode())
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
            body.extend(str(value).encode("utf-8"))
            body.extend(b"\r\n")
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(b'Content-Disposition: form-data; name="image"; filename="pet.png"\r\n')
        body.extend(b"Content-Type: image/png\r\n\r\n")
        body.extend(image_bytes)
        body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode())

        request = urllib.request.Request(
            self.endpoint + "/v1/pet-actions",
            data=bytes(body),
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Accept": "application/json",
            },
            method="POST",
        )
        if self.token:
            request.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise VideoBackendError(f"video backend request failed: {exc}") from exc

    def _post_worker_video(self, image_path, pet_name, tier):
        boundary = "----PetDexHunyuanBoundary"
        image_bytes = Path(image_path).read_bytes()
        fields = {
            "backend": self.backend,
            "pet_name": pet_name,
            "tier": tier,
            "prompt": self._video_prompt_for(pet_name, tier),
            "output_format": "mp4",
            "duration_seconds": "4",
        }
        body = bytearray()
        for name, value in fields.items():
            body.extend(f"--{boundary}\r\n".encode())
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
            body.extend(str(value).encode("utf-8"))
            body.extend(b"\r\n")
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(b'Content-Disposition: form-data; name="image"; filename="pet.png"\r\n')
        body.extend(b"Content-Type: image/png\r\n\r\n")
        body.extend(image_bytes)
        body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode())

        request = urllib.request.Request(
            self.endpoint + "/v1/pet-video",
            data=bytes(body),
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Accept": "application/json",
            },
            method="POST",
        )
        if self.token:
            request.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise VideoBackendError(f"hunyuan video backend request failed: {exc}") from exc

    def _persist_worker_video(self, response, job_id, candidate_id, tier):
        payload = response.get("video")
        if not isinstance(payload, dict):
            raise VideoBackendError("video backend response missing video payload")
        video_b64 = payload.get("base64")
        if not video_b64:
            raise VideoBackendError("video backend response missing video base64")

        job_dir = self.output_root / job_id
        video_dir = job_dir / "videos"
        video_dir.mkdir(parents=True, exist_ok=True)
        ext = payload.get("extension") or "mp4"
        video_path = video_dir / f"{job_id}_hunyuan.{ext}"
        video_path.write_bytes(base64.b64decode(video_b64.split(",", 1)[-1]))
        video_url = self._storage_url(video_path)

        actions = {
            "short_video": {
                "label": payload.get("label") or "HunyuanVideo short motion",
                "kind": "video",
                "format": ext,
                "mime": payload.get("mime") or "video/mp4",
                "url": video_url,
                "fps": int(payload.get("fps") or 24),
                "durationSeconds": float(payload.get("durationSeconds") or 4),
                "sourceModel": payload.get("sourceModel") or self.backend,
                "prompt": payload.get("prompt"),
                "note": "MP4 short video is delivered first; transparent GIF/PNG frame extraction is deferred.",
            }
        }
        manifest = {
            "schema": "mypet.video-delivery.v1",
            "id": job_id,
            "candidateId": candidate_id,
            "tier": tier,
            "model": self.info(),
            "delivery": "mp4_short_video",
            "video": actions["short_video"],
        }
        manifest_path = job_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        return actions, manifest_path, video_path

    def _persist_worker_frames(self, response, job_id, candidate_id, tier):
        if "actions" not in response or not isinstance(response["actions"], dict):
            raise VideoBackendError("video backend response missing actions")
        job_dir = self.output_root / job_id
        actions_dir = job_dir / "actions"
        actions_dir.mkdir(parents=True, exist_ok=True)
        actions = {}
        for action_key, payload in response["actions"].items():
            frames_payload = payload.get("frames") or []
            if not frames_payload:
                raise VideoBackendError(f"video backend returned no frames for {action_key}")
            out_dir = actions_dir / action_key
            out_dir.mkdir(parents=True, exist_ok=True)
            frames = []
            for i, frame_b64 in enumerate(frames_payload):
                path = out_dir / f"{action_key}_{i:02d}.png"
                raw = base64.b64decode(frame_b64.split(",", 1)[-1])
                path.write_bytes(raw)
                self._ensure_rgba_png(path)
                frames.append(self._storage_url(path))
            actions[action_key] = {
                "label": payload.get("label") or action_key,
                "fps": int(payload.get("fps") or 8),
                "loop": bool(payload.get("loop", True)),
                "transparent": True,
                "limbMotion": True,
                "frameCount": len(frames),
                "frames": frames,
                "sourceModel": self.backend,
            }
        manifest = {
            "schema": "mypet.petpack.v1",
            "id": job_id,
            "candidateId": candidate_id,
            "tier": tier,
            "model": self.info(),
            "actions": actions,
        }
        manifest_path = job_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        petpack_path = job_dir / f"{job_id}.petpack"
        with zipfile.ZipFile(petpack_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(manifest_path, "manifest.json")
            for action_key, action in actions.items():
                for frame_url in action["frames"]:
                    frame_path = self.output_root.parent / frame_url.replace("/storage/", "")
                    zf.write(frame_path, str(Path("actions") / action_key / Path(frame_path).name))
        return actions, manifest_path, petpack_path

    def _ensure_rgba_png(self, path):
        image = Image.open(path).convert("RGBA")
        image.save(path)

    def _storage_url(self, path):
        rel = Path(path).resolve().relative_to(self.output_root.parent.resolve())
        return "/storage/" + str(rel).replace("\\", "/")
