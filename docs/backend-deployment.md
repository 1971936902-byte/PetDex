# 后端部署与视频模型说明

## 当前部署

- 新服务器目录：`/opt/petdex`
- systemd 服务：`petdex.service`
- 视频 worker 服务：`petdex-ltx-worker.service`
- 应用监听：`0.0.0.0:8800`
- LTX worker 监听：`127.0.0.1:8811`
- 外网映射：`44100 -> 8800`
- 访问地址：`http://223.109.239.36:44100`
- GPU：`NVIDIA A800-SXM4-40GB`

## 后端能力

后端使用 Flask 提供页面和 API，同源部署，前端直接调用 `/api/*`。

核心接口：

- `GET /api/health`：服务和模型状态。
- `POST /api/pet-jobs`：上传宠物图片并生成 6 张主形象候选。
- `POST /api/pet-jobs/:id/select-candidate`：选择最像的一张候选。
- `POST /api/orders`：创建 mock 订单。
- `POST /api/orders/:id/confirm-mock`：确认 mock 支付。
- `POST /api/pet-jobs/:id/generate-pack`：生成连续动作帧和 `.petpack`。
- `GET /api/pets`：作品库列表。
- `GET /api/pets/:id/download`：下载资源包。

## 模型策略

PetDex 后端现在采用“业务 API + 可插拔视频生成 worker”的结构。

主 Flask 服务使用 `TinyPetVision-Pillow` 做上传图特征提取和候选图生成：

- 参数量：约 2952，远低于 10B。
- 运行时：PyTorch + Pillow，PyTorch 不可用时自动降级到 Pillow。
- 用途：本地图像特征提取、主体裁切、候选图生成、透明背景动作帧生成。
- 优点：启动快、资源占用低、不会因为大模型加载失败导致站点不可用。

动作包生成已切换为强制调用外部视频模型 worker。当前部署设置了 `PETDEX_VIDEO_REQUIRED=1`，如果 LTX worker 不可用，`generate-pack` 会直接失败，不再回退到旧的 procedural 动作生成。

## 推荐模型选择

当前新云服务器检测到的显卡是 A800 40GB。基于这个资源条件：

- 当前优先接入 `LTX-Video`，以独立 FastAPI worker 方式运行。
- LTX worker 使用 `LTXImageToVideoPipeline` 进行图生视频，输入用户宠物图和动作 prompt，输出 RGBA PNG 连续帧。
- `AnimateDiff-Lightning` 保留为备选 worker 方向。

## 外部视频 worker 配置

systemd 中可以加入以下环境变量：

```ini
Environment=PETDEX_VIDEO_BACKEND=ltx-video
Environment=PETDEX_VIDEO_ENDPOINT=http://127.0.0.1:8811
Environment=PETDEX_VIDEO_TIMEOUT=2400
Environment=PETDEX_VIDEO_REQUIRED=1
```

可选值建议：

- `PETDEX_VIDEO_BACKEND=ltx-video`
- `PETDEX_VIDEO_BACKEND=animatediff-lightning`
- `PETDEX_VIDEO_BACKEND=hunyuanvideo-1.5`

## 安装摘要

主后端依赖：

```bash
python3 -m venv /opt/petdex/venv
/opt/petdex/venv/bin/python -m pip install -r /opt/petdex/server/requirements.txt
```

视频 worker 依赖：

```bash
/opt/petdex/venv/bin/python -m pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu121
/opt/petdex/venv/bin/python -m pip install -r /opt/petdex/server/worker-requirements.txt
```

## Worker 接口契约

主应用会请求：

```http
POST /v1/pet-actions
Content-Type: multipart/form-data
```

表单字段：

- `image`：用户上传的宠物图片。
- `backend`：模型后端名。
- `pet_name`：宠物名。
- `tier`：套餐类型，`basic` 或 `advanced`。
- `action_plan_json`：动作计划，包含动作 key、中文 label、prompt、fps、期望帧数、透明背景要求。
- `output_format=png_frames_rgba`：要求返回 RGBA PNG 连续帧。

期望返回：

```json
{
  "actions": {
    "walk_right": {
      "label": "向右走",
      "fps": 10,
      "loop": true,
      "frames": ["data:image/png;base64,..."]
    }
  }
}
```

主应用会把这些帧保存到 `storage/generated/:jobId/actions/:action/`，写入 `manifest.json`，并打包为 `.petpack`。

## 动作与透明背景要求

基础版动作：

- `idle`
- `walk_right`
- `walk_left`
- `sleep`
- `sit`

高级版额外动作：

- `jump`
- `stretch`
- `run`
- `shake`

所有模型 worker 都必须输出透明背景 RGBA PNG 帧。如果模型只能输出视频或非透明图片，worker 需要在返回前完成抠图、背景移除和逐帧 PNG 导出。

## 存储

- 上传图：`storage/uploads`
- 候选图：`storage/generated/:jobId/candidates`
- 动作帧：`storage/generated/:jobId/actions`
- 资源包：`storage/generated/:jobId/:jobId.petpack`
- 数据库：`storage/petdex.sqlite3`
