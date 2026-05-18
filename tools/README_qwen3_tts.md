# Qwen3-TTS 本地语音

Qwen3-TTS 现在作为 AI 助教的一个独立语音引擎接入。它复用项目里的 MLX-Audio 本地服务，不需要再启动第二个端口。

## 当前配置

- 服务地址：`http://127.0.0.1:50010/v1/audio/speech`
- 模型目录：`.qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit`
- 默认角色：`vivian`
- 默认语言：`chinese`
- 输出格式：`audio/wav`

模型目录 `.qwen3-tts/` 已写入 `.gitignore`，不会提交到仓库。

## 下载模型

当前机器已经下载好模型。如果需要重新下载：

```bash
.venv-mlx-audio/bin/hf download mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit \
  --local-dir .qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit
```

## 启动服务

Qwen3-TTS 和 Kokoro 共用同一个服务：

```bash
tools/start_mlx_audio.sh
```

查看服务状态：

```bash
curl http://127.0.0.1:50010/health
curl http://127.0.0.1:50010/voices
```

## 设置页配置

在 AI 助教设置页选择：

- 语音引擎：`Qwen3-TTS 本地语音`
- Qwen3-TTS 服务地址：`http://127.0.0.1:50010/v1/audio/speech`
- Qwen3-TTS 模型：`.qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit`
- Qwen3-TTS 角色 ID：`vivian`
- Qwen3-TTS 语言：`chinese`

## 可用角色

| 角色 ID | 说明 |
| --- | --- |
| `vivian` | 中文女声 |
| `serena` | 中文女声 |
| `uncle_fu` | 中文男声 |
| `dylan` | 北京男声 |
| `eric` | 成都男声 |
| `ryan` | 英文男声 |
| `aiden` | 英文男声 |
| `ono_anna` | 日文女声 |
| `sohee` | 韩文女声 |

中文演示建议先用 `vivian`、`serena`、`uncle_fu`、`dylan`、`eric`。

## 直接测试

```bash
curl -X POST http://127.0.0.1:50010/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": ".qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit",
    "input": "你好，我是 Qwen3 TTS 本地语音。",
    "voice": "vivian",
    "speed": 1.0,
    "language": "chinese",
    "response_format": "wav"
  }' \
  --output /tmp/qwen3_tts_short.wav
```

主项目调用：

```bash
curl -k -X POST https://192.168.60.29:5443/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "这是主项目调用 Qwen3 TTS 的测试。",
    "provider": "qwen3_tts",
    "voice": "qwen3_tts:vivian",
    "rate": 1.0
  }' \
  --output /tmp/qwen3_tts_main.wav
```

响应头 `X-TTS-Provider: qwen3_tts` 表示主项目已经走 Qwen3-TTS。
