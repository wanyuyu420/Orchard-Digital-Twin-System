"""Fine-tune YOLOv8s-seg on QC orange tree annotations."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

from multiprocessing import freeze_support
from ultralytics import YOLO

if __name__ == "__main__":
    freeze_support()

    # Train from pre-trained YOLOv8s-seg baseline (not fine-tuned tree crown model)
    model = YOLO("yolov8s-seg.pt")  # auto-downloads if needed

    results = model.train(
        data="data/qc/yolo_dataset/data.yaml",
        epochs=100,
        imgsz=512,
        batch=4,
        device=0,
        project="runs/segment",
        name="orange_tree_v2",
        exist_ok=True,
        patience=30,
        save=True,
        plots=True,
        # Very low lr — single-image fine-tuning is fragile
        lr0=0.0001,
        lrf=0.001,
        # Minimal augmentation — we want to memorize this exact scene
        hsv_h=0.0,
        hsv_s=0.0,
        hsv_v=0.0,
        flipud=0.0,
        fliplr=0.0,
        mosaic=0.0,
        erasing=0.0,
        scale=0.0,
        translate=0.0,
    )
