from ultralytics import YOLO
import os
try:
    from .utils.classifier import Classifier
except (ImportError, ValueError):
    from utils.classifier import Classifier

class inferance:
    def __init__(self):
        self.path = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(self.path, "models/classifier/best.pt")
        self.classification_model = YOLO(model_path)
        self.classifier = Classifier(model=self.classification_model)
        self.device = str(getattr(self.classification_model, 'device', 'cpu'))
        self.names = getattr(self.classification_model, 'names', {})
        self.model_loaded = self.classification_model is not None

    def predict(self, image):
        # image is a 320x320 BGR numpy array
        results = self.classification_model.predict(image, imgsz=320, verbose=False)
        if results and len(results) > 0 and results[0].probs is not None:
            probs = results[0].probs
            top1_idx = int(probs.top1)
            top1_conf = float(probs.top1conf)
            top1_class = results[0].names[top1_idx]

            # Top 5 classes & confidences
            top5_indices = [int(i) for i in probs.top5]
            top5_confs = [float(c) for c in probs.top5conf]
            top5_classes = [results[0].names[i] for i in top5_indices]
            top5_dict = {results[0].names[idx]: float(conf) for idx, conf in zip(top5_indices, top5_confs)}

            # Find best handwashing class (non-background)
            best_hand_class = None
            best_hand_conf = 0.0
            for cname, conf in zip(top5_classes, top5_confs):
                if cname != "background":
                    best_hand_class = cname
                    best_hand_conf = conf
                    break

            # If background is dominant (>= 0.35), it is genuine background (hands still or away)
            if top1_class == "background" and top1_conf >= 0.35:
                return {
                    "class": "background",
                    "confidence": top1_conf,
                    "top5": top5_dict
                }

            # If top1 is an active hand gesture
            if top1_class != "background":
                return {
                    "class": top1_class,
                    "confidence": top1_conf,
                    "top5": top5_dict
                }

            # If background was weak (< 0.35), check if a distinct hand class has >= 0.25
            for cname, conf in zip(top5_classes, top5_confs):
                if cname != "background" and conf >= 0.25:
                    return {
                        "class": cname,
                        "confidence": conf,
                        "top5": top5_dict
                    }

            return {
                "class": "background",
                "confidence": top1_conf,
                "top5": top5_dict
            }

        return {"class": "background", "confidence": 1.0, "top5": {}}

if __name__ == "__main__":
    infr = inferance()
    result = infr.predict("your/image.jpeg")
    print(result)