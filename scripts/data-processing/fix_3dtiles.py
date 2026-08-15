"""
修复 ArcGIS Pro 导出的 3D Tiles tileset.json：
  1. 删除 LOD3（tiles/3/）引用 —— 对应已删除的 3/ 目录
  2. 去掉 uri 的 "tiles/" 前缀 —— 使 uri 与实际目录（0/,1/,2/）对齐

运行：python scripts/data-processing/fix_3dtiles.py
"""
import json
import os

TILESET = r"D:\Esri_data_4people\3Dtiles\tileset.json"


def process(node):
    if "children" in node:
        node["children"] = [
            c
            for c in node["children"]
            if not c.get("content", {}).get("uri", "").startswith("tiles/3/")
        ]
        for c in node["children"]:
            process(c)
    if "content" in node and "uri" in node["content"]:
        node["content"]["uri"] = node["content"]["uri"].replace("tiles/", "")


def collect_uris(node, out):
    if "content" in node:
        out.append(node["content"]["uri"])
    for c in node.get("children", []):
        collect_uris(c, out)


def main():
    os.chmod(TILESET, 0o644)  # 去掉只读属性

    with open(TILESET, encoding="utf-8") as f:
        data = json.load(f)

    process(data["root"])

    with open(TILESET, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))

    uris = []
    collect_uris(data["root"], uris)
    l3 = sum(1 for u in uris if "3/" in u or u.startswith("tiles/"))
    prefix = sum(1 for u in uris if u.startswith("tiles/"))
    print(f"[OK] 修复完成: {TILESET}")
    print(f"  剩余 uri 数: {len(uris)}")
    print(f"  tiles/3/ 残留: {l3}")
    print(f"  tiles/ 前缀残留: {prefix}")
    print(f"  示例 uri: {uris[:3]}")


if __name__ == "__main__":
    main()
