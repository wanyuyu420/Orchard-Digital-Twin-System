"""
彻底移除 glb 中残留的 EXT_structural_metadata 扩展（extensions / extensionsUsed / extensionsRequired），
重新打包 glb。用于 gltf-transform 剥离 attribute 后的二次清理。

运行：python scripts/data-processing/strip_extensions.py
"""
import json
import struct
import os

SRC = r"D:\Esri_data_4people\3Dtiles_stripped"

JSON_TYPE = 0x4E4F534A  # "JSON"
BIN_TYPE = 0x004E4942   # "BIN\0"


def strip_glb(path):
    with open(path, "rb") as f:
        buf = f.read()

    magic = buf[0:4]
    version = struct.unpack("<I", buf[4:8])[0]

    # 解析 JSON chunk
    off = 12
    json_len = struct.unpack("<I", buf[off:off + 4])[0]
    json_type = struct.unpack("<I", buf[off + 4:off + 8])[0]
    json_start = off + 8
    json_end = json_start + json_len
    j = json.loads(buf[json_start:json_end].decode("utf-8"))

    def _drop(obj, key):
        if key in obj:
            del obj[key]

    # 1) extensionsUsed / extensionsRequired 移除该扩展
    for field in ("extensionsUsed", "extensionsRequired"):
        if field in j:
            j[field] = [e for e in j[field] if e != "EXT_structural_metadata"]
            if not j[field]:
                _drop(j, field)

    # 2) 递归移除所有对象上的 EXT_structural_metadata 定义
    def walk(o):
        if isinstance(o, dict):
            if "extensions" in o and isinstance(o["extensions"], dict):
                o["extensions"].pop("EXT_structural_metadata", None)
                if not o["extensions"]:
                    _drop(o, "extensions")
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(j)

    # 重新序列化 + 4 字节对齐（空格 padding）
    new_json = json.dumps(j, separators=(",", ":")).encode("utf-8")
    padded_len = (len(new_json) + 3) & ~3
    new_json_padded = new_json + b" " * (padded_len - len(new_json))

    # 定位并复制原 BIN chunk（含其 padding）
    orig_json_padded = (json_len + 3) & ~3
    bin_chunk_start = json_start + orig_json_padded
    bin_chunk = buf[bin_chunk_start:]

    new_total = 12 + 8 + padded_len + len(bin_chunk)
    out = bytearray()
    out += magic
    out += struct.pack("<I", version)
    out += struct.pack("<I", new_total)
    out += struct.pack("<I", padded_len)
    out += struct.pack("<I", JSON_TYPE)
    out += new_json_padded
    out += bin_chunk

    with open(path, "wb") as f:
        f.write(out)


def main():
    count = 0
    for d in ("0", "1", "2"):
        base = os.path.join(SRC, d)
        if not os.path.isdir(base):
            continue
        for fn in sorted(os.listdir(base)):
            if not fn.endswith(".glb"):
                continue
            strip_glb(os.path.join(base, fn))
            count += 1
    print(f"[OK] 已清理 {count} 个 glb 的 EXT_structural_metadata 残留")


if __name__ == "__main__":
    main()
