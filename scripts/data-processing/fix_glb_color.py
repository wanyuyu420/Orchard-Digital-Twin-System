"""
修复 ArcGIS 导出的 glb 顶点色问题：
  1. COLOR_0 accessor 补 normalized: true（glTF 规范要求，ArcGIS 漏了）
  2. material.baseColorFactor 从黑色 [1/255,..] 改为白色 [1,1,1,1]
使 Cesium 正确渲染顶点色（否则树渲染成黑色不可见）。

运行：python scripts/data-processing/fix_glb_color.py
"""
import json
import struct
import os

SRC = r"D:\Esri_data_4people\3Dtiles_stripped"

JSON_TYPE = 0x4E4F534A


def fix_glb(path):
    with open(path, "rb") as f:
        buf = f.read()

    magic = buf[0:4]
    version = struct.unpack("<I", buf[4:8])[0]

    off = 12
    json_len = struct.unpack("<I", buf[off:off + 4])[0]
    json_start = off + 8
    json_end = json_start + json_len
    j = json.loads(buf[json_start:json_end].decode("utf-8"))

    # 1) 找到 COLOR_0 引用的 accessor，补 normalized: true
    for mesh in j.get("meshes", []):
        for prim in mesh.get("primitives", []):
            color_idx = prim.get("attributes", {}).get("COLOR_0")
            if color_idx is not None:
                acc = j["accessors"][color_idx]
                if acc.get("componentType") in (5121, 5123) and not acc.get("normalized"):
                    acc["normalized"] = True

    # 2) material.baseColorFactor 改为白色
    for mat in j.get("materials", []):
        pbr = mat.get("pbrMetallicRoughness")
        if pbr is not None:
            pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]

    new_json = json.dumps(j, separators=(",", ":")).encode("utf-8")
    padded_len = (len(new_json) + 3) & ~3
    new_json_padded = new_json + b" " * (padded_len - len(new_json))

    orig_json_padded = (json_len + 3) & ~3
    bin_chunk = buf[json_start + orig_json_padded:]

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
            fix_glb(os.path.join(base, fn))
            count += 1
    print(f"[OK] 已修复 {count} 个 glb 的 COLOR_0 归一化 + baseColorFactor")


if __name__ == "__main__":
    main()
