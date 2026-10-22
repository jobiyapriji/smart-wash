"""
SMART WASH — PyTorch LSTM Handwashing Action Recognition Trainer
Author: SMART WASH AI Pipeline

Trains a 2-layer LSTM on (30, 126) normalized landmark sequences to classify
the 6 WHO handwashing steps + background.
Features:
- Stratified Train / Validation / Held-Out Test split.
- PyTorch model checkpointing with early stopping.
- Full evaluation: Accuracy, Precision, Recall, F1-Score, Confusion Matrix.
- Single-sample inference latency benchmarking.
- Model reload verification.
- Saves handwash_lstm.pt and config.json to backend/models/lstm/.
"""

import os
import sys
import json
import time
import argparse
import numpy as np

import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix
)

class HandwashLSTM(nn.Module):
    def __init__(self, input_size=126, hidden_size=64, num_layers=2, num_classes=7, dropout=0.2):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.num_classes = num_classes

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.fc1 = nn.Linear(hidden_size, 32)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(dropout)
        self.fc2 = nn.Linear(32, num_classes)

    def forward(self, x):
        # x shape: (batch_size, seq_len, input_size)
        out, (hn, cn) = self.lstm(x)
        # Take the output of the final time step
        last_step = out[:, -1, :]
        h = self.relu(self.fc1(last_step))
        h = self.dropout(h)
        logits = self.fc2(h)
        return logits

def train_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for X_batch, y_batch in dataloader:
        X_batch, y_batch = X_batch.to(device), y_batch.to(device)
        optimizer.zero_grad()

        outputs = model(X_batch)
        loss = criterion(outputs, y_batch)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * X_batch.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == y_batch).sum().item()
        total += y_batch.size(0)

    epoch_loss = running_loss / total
    epoch_acc = correct / total
    return epoch_loss, epoch_acc

def evaluate(model, dataloader, criterion, device):
    model.eval()
    running_loss = 0.0
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for X_batch, y_batch in dataloader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)
            outputs = model(X_batch)
            loss = criterion(outputs, y_batch)

            running_loss += loss.item() * X_batch.size(0)
            _, preds = torch.max(outputs, 1)
            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(y_batch.cpu().numpy())

    total = len(all_targets)
    val_loss = running_loss / total
    val_acc = accuracy_score(all_targets, all_preds)
    return val_loss, val_acc, np.array(all_preds), np.array(all_targets)

def benchmark_latency(model, device, seq_len=30, input_dim=126, num_runs=100):
    model.eval()
    sample = torch.randn(1, seq_len, input_dim).to(device)
    
    # Warmup
    for _ in range(10):
        with torch.no_grad():
            _ = model(sample)
            
    start = time.perf_counter()
    for _ in range(num_runs):
        with torch.no_grad():
            _ = model(sample)
    end = time.perf_counter()
    
    avg_latency_ms = ((end - start) / num_runs) * 1000.0
    return avg_latency_ms

def main():
    parser = argparse.ArgumentParser(description="Train PyTorch LSTM on handwashing landmark sequences.")
    parser.add_argument("--data", type=str, default="dataset_landmarks.npz", help="Path to .npz dataset")
    parser.add_argument("--epochs", type=int, default=35, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--hidden-size", type=int, default=64, help="LSTM hidden layer size")
    parser.add_argument("--num-layers", type=int, default=2, help="Number of LSTM layers")
    parser.add_argument("--dropout", type=float, default=0.2, help="Dropout rate")
    parser.add_argument("--patience", type=int, default=8, help="Early stopping patience")
    parser.add_argument("--output-dir", type=str, default="../../backend/models/lstm", help="Export directory")
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, args.data) if not os.path.isabs(args.data) else args.data
    output_dir = os.path.join(base_dir, args.output_dir) if not os.path.isabs(args.output_dir) else args.output_dir
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(data_path):
        print(f"[ERROR] Dataset file not found: {data_path}")
        print("Please run extract_landmarks.py first.")
        sys.exit(1)

    print(f"[TRAIN] Loading dataset from: {data_path}")
    raw_data = np.load(data_path, allow_pickle=True)
    X = raw_data["X"]
    y = raw_data["y"]
    classes_json = raw_data["classes"].item() if raw_data["classes"].ndim == 0 else str(raw_data["classes"])
    classes = json.loads(classes_json) if isinstance(classes_json, str) else classes_json
    class_names = [classes[str(i)] for i in range(len(classes))]

    print(f"[TRAIN] Total samples: {X.shape[0]}, Shape: {X.shape[1:]}, Classes: {len(classes)}")

    # 1. Held-out test split (20% test, 80% train+val)
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # 2. Validation split from train+val (15% of train+val)
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=0.15, random_state=42, stratify=y_train_val
    )

    print(f"[SPLIT] Train: {X_train.shape[0]}, Val: {X_val.shape[0]}, Held-out Test: {X_test.shape[0]}")

    # Convert to PyTorch Tensors
    train_dataset = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    val_dataset = TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val))
    test_dataset = TensorDataset(torch.from_numpy(X_test), torch.from_numpy(y_test))

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[DEVICE] Training on: {device}")

    input_size = X.shape[2]
    seq_len = X.shape[1]
    num_classes = len(classes)

    model = HandwashLSTM(
        input_size=input_size,
        hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        num_classes=num_classes,
        dropout=args.dropout
    ).to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=3, factor=0.5)

    best_val_loss = float("inf")
    best_weights_path = os.path.join(output_dir, "handwash_lstm.pt")
    patience_counter = 0

    print(f"\n[TRAINING START] {args.epochs} max epochs, patience={args.patience}...")
    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, _, _ = evaluate(model, val_loader, criterion, device)
        scheduler.step(val_loss)

        print(f"Epoch [{epoch:02d}/{args.epochs:02d}] "
              f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.2f}% | "
              f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc*100:.2f}%")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save(model.state_dict(), best_weights_path)
            # print(f"  --> Saved new best checkpoint (Val Loss: {val_loss:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= args.patience:
                print(f"[EARLY STOPPING] Validation loss stopped improving for {args.patience} epochs.")
                break

    print(f"\n[TRAINING FINISHED] Loading best checkpoint from {best_weights_path}...")
    model.load_state_dict(torch.load(best_weights_path, map_location=device))

    # Held-out Test Evaluation
    print("\n" + "="*60)
    print("HELD-OUT TEST EVALUATION (Unseen Data)")
    print("="*60)
    test_loss, test_acc, test_preds, test_targets = evaluate(model, test_loader, criterion, device)
    
    prec_macro, rec_macro, f1_macro, _ = precision_recall_fscore_support(test_targets, test_preds, average='macro', zero_division=0)
    prec_wt, rec_wt, f1_wt, _ = precision_recall_fscore_support(test_targets, test_preds, average='weighted', zero_division=0)

    print(f"Test Accuracy: {test_acc*100:.2f}%")
    print(f"Macro Precision: {prec_macro:.4f} | Macro Recall: {rec_macro:.4f} | Macro F1-Score: {f1_macro:.4f}")
    print(f"Weighted Precision: {prec_wt:.4f} | Weighted Recall: {rec_wt:.4f} | Weighted F1-Score: {f1_wt:.4f}")

    print("\nDetailed Classification Report:")
    target_names = [f"Class {i} ({class_names[i]})" for i in range(num_classes)]
    print(classification_report(test_targets, test_preds, target_names=target_names, digits=4, zero_division=0))

    print("Confusion Matrix (Rows=True, Columns=Predicted):")
    cm = confusion_matrix(test_targets, test_preds)
    print(cm)

    # Benchmark Latency
    avg_latency = benchmark_latency(model, device, seq_len=seq_len, input_dim=input_size, num_runs=100)
    print(f"\nInference Latency: {avg_latency:.2f} ms per sample on {device.type.upper()}")

    # Model Reload Verification Test
    print("\n[VERIFICATION] Testing model reload and sample forward pass...")
    reloaded_model = HandwashLSTM(
        input_size=input_size,
        hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        num_classes=num_classes,
        dropout=args.dropout
    ).to(device)
    reloaded_model.load_state_dict(torch.load(best_weights_path, map_location=device))
    reloaded_model.eval()

    sample_x = torch.from_numpy(X_test[:2]).to(device)
    with torch.no_grad():
        sample_logits = reloaded_model(sample_x)
        sample_probs = torch.softmax(sample_logits, dim=-1).cpu().numpy()
        sample_pred = np.argmax(sample_probs, axis=-1)

    print(f"[VERIFICATION OK] Forward pass succeeded! Predicted classes: {sample_pred.tolist()}")

    # Export config & metadata
    config_data = {
        "model_architecture": "HandwashLSTM",
        "input_size": input_size,
        "sequence_length": seq_len,
        "hidden_size": args.hidden_size,
        "num_layers": args.num_layers,
        "num_classes": num_classes,
        "classes": classes,
        "normalization": {
            "type": "wrist_centered_scale_normalized",
            "wrist_index": 0,
            "middle_mcp_index": 9,
            "feature_dim": input_size
        },
        "metrics": {
            "test_accuracy": round(float(test_acc), 4),
            "macro_f1": round(float(f1_macro), 4),
            "weighted_f1": round(float(f1_wt), 4),
            "latency_ms": round(float(avg_latency), 2)
        },
        "weights_file": "handwash_lstm.pt"
    }

    config_path = os.path.join(output_dir, "config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2)

    # Also sync a copy to ml/models/step_model
    ml_models_dir = os.path.normpath(os.path.join(base_dir, "../models/step_model"))
    os.makedirs(ml_models_dir, exist_ok=True)
    with open(os.path.join(ml_models_dir, "config.json"), "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2)

    print(f"\n[EXPORT COMPLETE] Weights: {best_weights_path}")
    print(f"                  Config:  {config_path}")

if __name__ == "__main__":
    main()
