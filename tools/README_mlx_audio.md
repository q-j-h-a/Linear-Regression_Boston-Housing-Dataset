# MLX-Audio Kokoro 本地语音服务

这个服务用于给 AI 助教增加 Apple Silicon 友好的本地中文语音。主项目不直接加载模型，而是调用本机 HTTP 服务。

## 服务位置

服务代码：

```text
/Users/d1a0y1bb/Documents/TempProjects/Linear-Regression_Boston-Housing-Dataset/tools/mlx_audio_service.py
```

启动脚本：

```text
/Users/d1a0y1bb/Documents/TempProjects/Linear-Regression_Boston-Housing-Dataset/tools/start_mlx_audio.sh
```

Python 环境：

```text
/Users/d1a0y1bb/Documents/TempProjects/Linear-Regression_Boston-Housing-Dataset/.venv-mlx-audio/
```

`.venv-mlx-audio` 已写入 `.gitignore`，不会提交到仓库。

## 当前配置

- 服务地址：`http://127.0.0.1:50010/v1/audio/speech`
- 默认模型：`mlx-community/Kokoro-82M-bf16`
- 默认音色：`zf_xiaoxiao`
- 输出格式：`audio/wav`

主项目设置页里选择：

- 语音引擎：`MLX-Audio Kokoro 本地语音`
- MLX-Audio 服务地址：`http://127.0.0.1:50010/v1/audio/speech`
- MLX-Audio 模型：`mlx-community/Kokoro-82M-bf16`
- 音色：选择 `Kokoro 晓晓 · 中文女声 · MLX`，或填写对应音色 ID

## 可用中文音色

| 音色 ID | 说明 |
| --- | --- |
| `zf_xiaobei` | 中文女声，小北 |
| `zf_xiaoni` | 中文女声，小妮 |
| `zf_xiaoxiao` | 中文女声，晓晓 |
| `zf_xiaoyi` | 中文女声，小艺 |
| `zm_yunxi` | 中文男声，云希 |
| `zm_yunxia` | 中文男声，云夏 |
| `zm_yunyang` | 中文男声，云扬 |
| `zm_yunjian` | 中文男声，云健 |

## 环境准备

当前机器已经配置好。重新搭环境时执行：

```bash
uv venv .venv-mlx-audio --python /opt/homebrew/bin/python3.11
uv pip install --python .venv-mlx-audio/bin/python -r tools/requirements-mlx-audio-service.txt
```

说明：

- 默认 `python3` 是 3.14，部分音频依赖对 3.14 支持不稳定，所以这里固定用本机 Python 3.11。
- `misaki[en,zh]` 会安装 Kokoro 中文和英文文本处理需要的依赖。
- 模型文件由 Hugging Face 缓存在用户目录，不提交进仓库。

## 启动

```bash
tools/start_mlx_audio.sh
```

脚本会占用端口 `50010`。如果端口上已有旧的 MLX-Audio 服务，脚本会停止旧进程再启动新的。

查看服务：

```bash
curl http://127.0.0.1:50010/health
curl http://127.0.0.1:50010/voices
```

## 直接测试

```bash
curl -X POST http://127.0.0.1:50010/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mlx-community/Kokoro-82M-bf16",
    "input": "你好，我是 MLX Audio Kokoro 本地语音。",
    "voice": "zf_xiaoxiao",
    "speed": 1.1,
    "response_format": "wav"
  }' \
  --output /tmp/mlx_kokoro_short.wav
```

主项目调用测试：

```bash
curl -k -X POST https://192.168.60.29:5443/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "这是主项目调用 MLX-Audio Kokoro 的测试。",
    "provider": "mlx_audio",
    "voice": "mlx_audio:zf_xiaoxiao",
    "rate": 1.1
  }' \
  --output /tmp/mlx_kokoro_main.wav
```

响应头 `X-TTS-Provider: mlx_audio` 表示主项目已经走 MLX-Audio。
