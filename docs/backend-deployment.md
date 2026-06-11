# 后端部署与模型说明

## 当前部署

- 服务器目录：`/opt/petdex`
- systemd 服务：`petdex.service`
- 监听地址：`0.0.0.0:8800`
- 外网映射：`15558 -> 8800`
- 访问地址：`http://223.109.239.11:15558`

## 后端能力

后端使用 Flask 提供页面和 API，同源部署，前端可以直接调用 `/api/*`。

核心接口：

- `GET /api/health`：服务和模型状态。
- `POST /api/pet-jobs`：上传宠物图片并生成 6 张主形象候选。
- `POST /api/pet-jobs/:id/select-candidate`：选择最像的一张候选。
- `POST /api/orders`：创建 mock 订单。
- `POST /api/orders/:id/confirm-mock`：确认 mock 支付。
- `POST /api/pet-jobs/:id/generate-pack`：生成动作帧和 `.petpack`。
- `GET /api/pets`：作品库列表。
- `GET /api/pets/:id/download`：下载资源包。

## 模型说明

当前模型管线名为 `TinyPetVision-Pillow`：

- 参数量：2952，远低于 10B。
- 运行时：PyTorch + Pillow。
- 作用：本地图像特征提取、主体裁切、候选图生成、动作帧生成。
- 不调用任何外部云模型。

当前动作：

- `idle`
- `walk`
- `sleep`
- `stretch`
- `jump`

当前实现属于“轻量视觉模型 + 程序化动作帧生成”。它能跑通用户上传猫咪图片到桌宠动作包的闭环，但不是最终生产级姿态生成模型。后续可以在不改前端 API 的情况下，将 `server/services/local_ai_model.py` 替换为更强的本地 diffusion、pose transfer 或 sprite animation 模型。

## 存储

- 上传图：`storage/uploads`
- 生成图：`storage/generated/:jobId/candidates`
- 动作帧：`storage/generated/:jobId/actions`
- 资源包：`storage/generated/:jobId/:jobId.petpack`
- 数据库：`storage/petdex.sqlite3`
