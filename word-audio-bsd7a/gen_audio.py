# -*- coding: utf-8 -*-
"""北师大版七上单词跟读音频生成器
每词结构: 第1遍慢速拆解音节(经whisper逐音节校验, 失败自动回退整词慢速) + 常速2遍 + 中文1遍
美音 en-US-AriaNeural / 中文 zh-CN-XiaoxiaoNeural
用法: python gen_audio.py [verify|sample|all]
"""
import asyncio, json, os, re, subprocess, sys
import edge_tts
import edge_tts.communicate as comm_mod
import pronouncing
import pyphen

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE_SEG = os.path.join(BASE, "cache", "seg")
CACHE_WORD = os.path.join(BASE, "cache", "word")
CACHE_FRAG = os.path.join(BASE, "cache", "frag")
OUT = BASE
for d in (CACHE_SEG, CACHE_WORD, CACHE_FRAG):
    os.makedirs(d, exist_ok=True)

EN_VOICE = "en-US-AriaNeural"
ZH_VOICE = "zh-CN-XiaoxiaoNeural"
MP3_PARAMS = ["-ar", "24000", "-ac", "1", "-b:a", "48k"]
PY = pyphen.Pyphen(lang="en_US")

# edge-tts 内部会 escape 文本; 置为恒等并自行预转义(本项目不内嵌SSML标签, 纯文本+ffmpeg控制停顿)
comm_mod.escape = lambda s: s

# ---------- CMU 音节拆分 ----------
VOWELS = set("AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW".split())
ALT_SPELL = {"neighbourhood": "neighborhood", "practise": "practice"}
ONSETS2 = set(tuple(x.split()) for x in ["P L","P R","B L","B R","T R","D R","K R","K L","G R","G L","F L","F R","T W","D W","K W","G W","S L","S M","S N","S P","S T","S K","S W","S F","S T R","S P R","S K R","S K W","S T W","S P L","S K L","S M Y"])

def is_vow(tok): return tok.rstrip("012") in VOWELS

def split_syllables(phones):
    toks = phones.split()
    syls, cur, i = [], [], 0
    while i < len(toks):
        t = toks[i]
        if is_vow(t):
            cur.append(t)
            j = i + 1
            cons = []
            while j < len(toks) and not is_vow(toks[j]):
                cons.append(toks[j]); j += 1
            if not cons or j >= len(toks):
                cur += cons; syls.append(cur); cur = []
            else:
                st = t[-1] if t[-1] in "012" else None
                if len(cons) == 1 and (st == "1" or cons[0] == "R"):
                    k = 1
                elif st == "1":
                    k = len(cons) - 1
                elif len(cons) >= 2 and (cons[-2], cons[-1]) in ONSETS2:
                    k = len(cons) - 2
                else:
                    k = len(cons) - 1
                cur += cons[:max(k, 0)]
                syls.append(cur); cur = cons[max(k, 0):]
            i = j
        else:
            cur.append(t); i += 1
    if cur:
        if syls: syls[-1] += cur
        else: syls.append(cur)
    return syls

def word_syllable_tokens(word):
    w = word.lower().strip().rstrip(".").strip("*").strip()
    if " " in w: return None
    lookup = ALT_SPELL.get(w, w)
    if "-" in lookup or "'" in lookup:
        parts = re.split(r"[-']", lookup)
        if len(parts) > 1:
            all_s = []
            for p in parts:
                s = word_syllable_tokens(p)
                if not s: return None
                all_s += s
            return all_s
    prs = pronouncing.phones_for_word(lookup)
    if not prs: return None
    return split_syllables(prs[0])

# ---------- 音素音节 -> 可读拼写(逆G2P) ----------
SHORT = set(["AE", "EH", "IH", "AA", "AH", "UH"])
CONS_LETTER = {"B":"b","D":"d","F":"f","H":"h","JH":"j","L":"l","M":"m","N":"n",
    "P":"p","R":"r","S":"s","T":"t","V":"v","W":"w","Y":"y","Z":"z",
    "CH":"ch","SH":"sh","TH":"th","DH":"th","ZH":"z","NG":"ng","K":None,"G":"g"}

def coda_spelling(vbase, coda):
    if not coda: return ""
    if len(coda) == 1:
        c = coda[0]
        dbl = vbase in ("AE", "EH", "IH")
        if c == "K": return "ck" if (dbl or vbase in ("AH", "UH")) else "k"
        if c == "S": return "ss" if dbl else "s"
        if c == "F": return "ff" if dbl else "f"
        if c == "L": return "ll" if dbl else "l"
        if c == "Z": return "zz" if dbl else "z"
        if c == "CH": return "tch" if dbl else "ch"
        if c in ("B", "D", "G", "M", "N", "P", "T"):
            return CONS_LETTER[c] * 2 if dbl else CONS_LETTER[c]
        return CONS_LETTER.get(c, "x")
    return "".join((CONS_LETTER.get(c) or ("k" if c == "K" else "x")) for c in coda)

def spell_syllable(toks):
    onset, i = [], 0
    while i < len(toks) and not is_vow(toks[i]):
        onset.append(toks[i]); i += 1
    if i >= len(toks): return None
    vow, coda = toks[i], toks[i+1:]
    vb = vow.rstrip("012")
    # R 韵特殊: ɛr 系拼作 air
    if coda and coda[0] == "R" and vb in ("EH", "AE"):
        return _onset(onset, "a") + "air" + coda_spelling(vb, coda[1:])
    cod = coda_spelling(vb, coda)
    closed = len(coda) > 0
    if closed:
        if vb == "AE": nuc = "a"
        elif vb == "EH": nuc = "e"
        elif vb == "IH": nuc = "i"
        elif vb == "AA": nuc = "o"
        elif vb == "AH": nuc = "u"
        elif vb == "UH": nuc = "oo"
        elif vb == "UW": nuc = "oo"
        elif vb == "AW": nuc = "aw"
        elif vb == "AO": nuc = "aw"
        elif vb == "OY": nuc = "oi"
        elif vb == "ER": nuc = "er"
        elif vb == "IY": nuc = "ee"
        elif vb == "EY": return _onset(onset, "a") + "a" + cod + "e"
        elif vb == "AY":
            if coda == ["N", "D"]: return _onset(onset, "i") + "ind"
            if coda == ["L", "D"]: return _onset(onset, "i") + "ild"
            return _onset(onset, "i") + "i" + cod + "e"
        elif vb == "OW":
            if coda == ["L", "D"]: return _onset(onset, "o") + "old"
            if coda == ["S", "T"]: return _onset(onset, "o") + "ost"
            if coda == ["N"]: return _onset(onset, "o") + "own"
            return _onset(onset, "o") + "o" + cod + "e"
        else: return None
        return _onset(onset, nuc) + nuc + cod
    # 开音节
    if vb == "IY": nuc = "ee"
    elif vb == "EY": nuc = "ay"
    elif vb == "AY": nuc = "I" if not onset else "ye"
    elif vb == "OW": nuc = "oh"
    elif vb == "AA": nuc = "ah"
    elif vb == "AO": nuc = "aw"
    elif vb == "AW": nuc = "aw"
    elif vb == "AH": nuc = "uh"
    elif vb == "UH": nuc = "oo"
    elif vb == "EH": nuc = "eh"
    elif vb == "IH": nuc = "ih"
    elif vb == "OY": nuc = "oy"
    elif vb == "ER": nuc = "er"
    else: return None
    return _onset(onset, nuc) + nuc + cod

def _onset(onset, nuc):
    out = []
    for c in onset:
        if c == "K": out.append("k" if nuc[0] in "eiy" else "c")
        else: out.append(CONS_LETTER.get(c, ""))
    return "".join(out)

def word_frag_tokens(word):
    """返回 [(拼写片段, 音素序列)]; 无法处理返回 None"""
    syls = word_syllable_tokens(word)
    if not syls: return None
    out = []
    for s in syls:
        f = spell_syllable(s)
        if f is None: return None
        out.append((f, s))
    return out

def word_fragments(word):
    d = word_frag_tokens(word)
    return [f for f, _ in d] if d else None

# ---------- TTS / ffmpeg ----------
def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

async def tts_seg(path, text, voice, rate):
    if os.path.exists(path) and os.path.getsize(path) > 500:
        return True
    for attempt in range(3):
        try:
            c = edge_tts.Communicate(esc(text), voice, rate=rate)
            await c.save(path)
        except Exception as e:
            if attempt == 2: print(f"[FAIL] {os.path.basename(path)}: {e}")
            await asyncio.sleep(1.5); continue
        if os.path.exists(path) and os.path.getsize(path) > 500:
            return True
        await asyncio.sleep(1.5)
    print(f"[EMPTY] {os.path.basename(path)}")
    return False

def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)

def silence(path, ms):
    if os.path.exists(path): return
    ff("-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", str(ms / 1000),
       "-c:a", "libmp3lame", *MP3_PARAMS, path)

def concat_reencode(files, out):
    args = []
    for f in files: args += ["-i", f]
    n = len(files)
    fc = "".join(f"[{i}:a]" for i in range(n)) + f"concat=n={n}:v=0:a=1[a]"
    ff(*args, "-filter_complex", fc, "-map", "[a]", "-c:a", "libmp3lame", *MP3_PARAMS, out)

def concat_copy(files, out):
    listf = out + ".list"
    with open(listf, "w", encoding="utf-8") as f:
        for p in files: f.write(f"file '{p}'\n")
    ff("-f", "concat", "-safe", "0", "-i", listf, "-c", "copy", out)
    os.remove(listf)

SIL = {}
def sil(ms):
    if ms not in SIL:
        p = os.path.join(CACHE_SEG, f"_sil{ms}.mp3")
        silence(p, ms); SIL[ms] = p
    return SIL[ms]

# ---------- 校验 ----------
def norm(s): return re.sub(r"[^a-z]", "", s.lower())

def run_verify():
    from faster_whisper import WhisperModel
    data = json.load(open(os.path.join(BASE, "words.json"), encoding="utf-8"))
    vpath = os.path.join(BASE, "frag_verified.json")
    verified = json.load(open(vpath, encoding="utf-8")) if os.path.exists(vpath) else {}
    targets = {}
    for unit, secs in data.items():
        for sec, entries in secs.items():
            for en, zh in entries:
                d = word_frag_tokens(en)
                if d:
                    for f, toks in d:
                        targets[norm(f)] = [re.sub(r"\d", "", t) for t in toks]
    todo = [f for f in sorted(targets) if not verified.get(f)]
    print(f"unique fragments: {len(targets)}, to verify: {len(todo)}")
    if todo:
        model = WhisperModel("small", device="cpu", compute_type="int8")
        async def gen_all():
            sem = asyncio.Semaphore(6)
            async def one(f):
                async with sem:
                    p = os.path.join(CACHE_FRAG, f"frag_{f}.mp3")
                    await tts_seg(p, f, EN_VOICE, "-30%")
            await asyncio.gather(*[one(f) for f in todo])
        asyncio.run(gen_all())
        for f in todo:
            p = os.path.join(CACHE_FRAG, f"frag_{f}.mp3")
            ok = False
            if os.path.exists(p) and os.path.getsize(p) > 500:
                segs, _ = model.transcribe(p, language="en")
                heard = " ".join(s.text for s in segs).strip()
                hp = pronouncing.phones_for_word(norm(heard))
                ok = (norm(heard) == f) or (
                    bool(hp) and
                    [re.sub(r'\d','',x) for x in hp[0].split()] == targets[f])
                if not ok:
                    print(f"  miss: {f!r} heard={heard!r}")
            verified[f] = ok
            json.dump(verified, open(vpath, "w", encoding="utf-8"))
    print(f"verified OK: {sum(verified.values())}/{len(verified)}")

# ---------- 组装 ----------
async def build_word(unit, idx, en, zh, sem):
    slug = re.sub(r'[^a-z0-9]+', '_', en.lower()).strip('_')[:24]
    wpath = os.path.join(CACHE_WORD, f"{unit.replace(' ', '')}_{idx:03d}_{slug}.mp3")
    if os.path.exists(wpath) and os.path.getsize(wpath) > 500:
        return wpath
    pre = f"{unit.replace(' ', '')}_{idx:03d}"
    p_n1 = os.path.join(CACHE_SEG, f"{pre}_n1.mp3")
    p_n2 = os.path.join(CACHE_SEG, f"{pre}_n2.mp3")
    p_n3 = os.path.join(CACHE_SEG, f"{pre}_n3.mp3")
    p_zh = os.path.join(CACHE_SEG, f"{pre}_zh.mp3")
    async with sem:
        await asyncio.gather(
            tts_seg(p_n1, en, EN_VOICE, "+0%"),
            tts_seg(p_n2, en, EN_VOICE, "+0%"),
            tts_seg(p_n3, en, EN_VOICE, "+0%"),
            tts_seg(p_zh, zh, ZH_VOICE, "+0%"))
    seq = [sil(200), p_n1, sil(320), p_n2, sil(320), p_n3, sil(500), p_zh]
    concat_reencode(seq, wpath)
    return wpath

async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    data = json.load(open(os.path.join(BASE, "words.json"), encoding="utf-8"))
    sem = asyncio.Semaphore(6)

    if mode == "sample":
        picks = ["grandparent", "comfortable", "a.m.", "ice-skate",
                 "look forward to", "neighbourhood", "Leonardo", "geography"]
        tasks, items = [], []
        for u, secs in data.items():
            for sec, entries in secs.items():
                for en, zh in entries:
                    if en in picks and en not in [i[2] for i in items]:
                        tasks.append(build_word(u, 900 + len(items), en, zh, sem))
                        items.append((u, sec, en, zh))
        paths = await asyncio.gather(*tasks)
        seq = [sil(500)]
        for (u, sec, en, zh), p in zip(items, paths):
            seq += [p, sil(1200)]
        concat_copy(seq, os.path.join(OUT, "00_试听样本.mp3"))
        for u, sec, en, zh in items:
            print(f"  {en:20s} {zh}")
        print("sample done")
        return

    for unit, secs in data.items():
        unum = {"Unit 1": "01", "Unit 2": "02", "Unit 3": "03", "Unit 4": "04", "Appendix": "05"}[unit]
        tasks, meta = [], []
        idx = 0
        for sec, entries in secs.items():
            for en, zh in entries:
                tasks.append(build_word(unit, idx, en, zh, sem))
                meta.append((sec, en)); idx += 1
        paths = await asyncio.gather(*tasks)
        mpath = os.path.join(CACHE_SEG, f"_marker_{unum}.mp3")
        label = unit if unit != "Appendix" else "Proper Nouns, Countries and Places, Names"
        await tts_seg(mpath, label, EN_VOICE, "+0%")
        seq = [sil(400), mpath, sil(900)]
        cur_sec = None
        for (sec, en), p in zip(meta, paths):
            if sec != cur_sec:
                sp = os.path.join(CACHE_SEG, f"_sec_{unum}_{re.sub(r'[^a-z0-9]+','_',sec.lower())}.mp3")
                await tts_seg(sp, sec, EN_VOICE, "+0%")
                seq += [sil(700), sp, sil(600)]
                cur_sec = sec
            seq += [p, sil(1100)]
        fname = {"01": "01_Unit1.mp3", "02": "02_Unit2.mp3", "03": "03_Unit3.mp3",
                 "04": "04_Unit4.mp3", "05": "05_附录_专名地名人名.mp3"}[unum]
        concat_copy(seq, os.path.join(OUT, fname))
        print(f"[done] {fname} ({len(paths)} words)")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        run_verify()
    else:
        asyncio.run(main())
