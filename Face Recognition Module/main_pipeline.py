"""
╔════════════════════════════════════════════════════════════════════════════════╗
║                        FACE RECOGNITION MAIN PIPELINE                          ║
╚════════════════════════════════════════════════════════════════════════════════╝

PURPOSE:
    This module is the core FastAPI application that serves REST API endpoints for:
    1. User face enrollment - Collecting and storing facial embeddings
    2. User face verification - Comparing live faces against stored embeddings

MAIN ENDPOINTS:
    - POST /enroll-face    : Enroll a new user's face biometric data
    - POST /verify-face    : Verify a user's face against stored embeddings

KEY FEATURES:
    - Multi-frame processing (10-15 frames recommended)
    - Embedding averaging for robust representations
    - Cosine similarity-based verification
    - Automatic face detection and normalization
    - Configurable similarity threshold (default: 0.50)

FLOW:
    1. Receive frames from client
    2. Extract embeddings using MobileFaceNet
    3. For enrollment: Average embeddings and normalize, then store in database
    4. For verification: Average embeddings and compare with stored embeddings
    5. Return status (verified/rejected/no_face) with similarity score

REQUIREMENTS:
    - FastAPI >= 0.68.0
    - Uvicorn >= 0.15.0
    - insightface >= 0.7.0
    - numpy >= 1.19.0

AUTHOR: Face Recognition Team
DATE: March 2026
"""

from fastapi import FastAPI
from embedding.mobilefacenet_embedder import MobileFaceNet
from verification.verify_user import Verifier
# from liveness.liveness_check import LivenessChecker
from database.db import get_user_embeddings, save_user_embedding
import numpy as np

app = FastAPI()

embedder = MobileFaceNet()
verifier = Verifier()
# liveness = LivenessChecker()


@app.post("/verify-face")
def verify_face(data: dict):
    user_id = data["user_id"]
    frames = data["frames"]

    embeddings = []

    for frame in frames:
        emb = embedder.get_embedding(frame)
        if emb is not None:
            embeddings.append(emb)

    if len(embeddings) == 0:
        return {"status": "no_face"}

    final_embedding = np.mean(embeddings, axis=0)

    stored_embeddings = get_user_embeddings(user_id)
    stored_embeddings = [np.array(e) for e in stored_embeddings]

    similarity = verifier.verify(final_embedding, stored_embeddings)

    if similarity > 0.50:
        return {"status": "verified", "similarity": float(similarity)}

    return {"status": "rejected", "similarity": float(similarity)}


@app.post("/enroll-face")
def enroll_face(data: dict):
    user_id = data["user_id"]
    frames = data["frames"]

    embeddings = []

    for frame in frames:
        emb = embedder.get_embedding(frame)
        if emb is not None:
            embeddings.append(emb)

    if len(embeddings) == 0:
        return {"status": "no_face"}

    # average embeddings
    final_embedding = np.mean(embeddings, axis=0)

    # normalize again
    final_embedding = final_embedding / np.linalg.norm(final_embedding)

    # store in DB
    save_user_embedding(user_id, final_embedding)

    return {
        "status": "enrolled",
        "embedding_dim": len(final_embedding)
    }