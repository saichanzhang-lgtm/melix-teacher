# 北师大版七年级上册 · 单词跟读音频

## 音频文件（本目录）
| 文件 | 内容 |
|------|------|
| 00_试听样本.mp3 | 8 个代表词，用于确认朗读风格 |
| 01_Unit1.mp3 ~ 04_Unit4.mp3 | 各单元全部单词（含 Topic Talk / Lesson / Workshop / Reading Club 小节标记） |
| 05_附录_专名地名人名.mp3 | Proper Nouns + Countries and Places + Names |

## 每个单词的朗读结构
1. **英文常速朗读 3 遍**：美音 en-US-Aria（三遍独立合成，语调自然有变化）
2. **中文释义 1 遍**：zh-CN-Xiaoxiao

小节之间有语音标记（如 "Lesson 1"），词间留约 1.1 秒空白供学生跟读。
（历史版本曾为"慢速拆音节+常速2遍"，相关逆G2P/whisper校验管线仍保留在脚本中）

## 数据来源
- 单词表：`北师大版七年级上册单词表.pdf`（扫描版，人工识别 + 与结构化词表交叉校验）
- Starter 单元不在此 PDF 内，如需 Starter 音频可另行生成

## 重新生成 / 调参
```bash
python gen_audio.py verify   # 音节拼读自动校验（首次或改映射后运行）
python gen_audio.py sample   # 生成试听样本
python gen_audio.py all      # 生成全部单元音频
```
- 词表数据：`words.json`（unit → 小节 → [英文, 中文]）
- 校验缓存：`frag_verified.json` + `cache/`
- 音色/语速/停顿参数在 `gen_audio.py` 顶部（EN_VOICE / ZH_VOICE / rate / sil 毫秒数）
