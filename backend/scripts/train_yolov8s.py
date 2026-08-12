import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

from ultralytics import YOLO

if __name__ == "__main__":
    from multiprocessing import freeze_support
    freeze_support()
    model = YOLO("weights/yolov8s-seg.pt")
    results = model.train(
        data="weights/data_fixed_v3.yaml",
        epochs=100,
        imgsz=640,
        batch=8,
        device=0,
        project="runs/segment",
        name="tree_crown_v3_small",
        exist_ok=True,
        patience=50,
        save=True,
        plots=True,
    )
