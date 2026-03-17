# Face Recognition Module

A comprehensive face recognition system built with FastAPI that supports user enrollment, face verification, and liveness detection. This module uses state-of-the-art deep learning models for facial embedding generation and implements security features including encryption and challenge-based liveness checks.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Module Descriptions](#module-descriptions)
- [Usage Examples](#usage-examples)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Features

✅ **Face Enrollment** - Capture and store facial embeddings for new users
✅ **Face Verification** - Compare live face against stored embeddings with confidence scoring
✅ **Liveness Detection** - Multi-challenge liveness checks (blink, head pose, etc.)
✅ **Embedding Generation** - Uses MobileFaceNet for efficient face encoding
✅ **Database Storage** - SQLite database for user embeddings with versioning
✅ **Encryption Support** - Optional encryption for sensitive embeddings
✅ **Head Pose Detection** - Detects face direction (left, right, center)
✅ **Blink Detection** - Validates eye aspect ratio for liveness
✅ **Challenge Management** - Random challenge generation for anti-spoofing

## Project Structure

```
Face Recognition Module/
├── main_pipeline.py                 # FastAPI application with main endpoints
├── requirements.txt                 # Python package dependencies
├── database/
│   └── db.py                       # SQLite database operations
├── embedding/
│   └── mobilefacenet_embedder.py   # Face embedding generation using InsightFace
├── enrollment/
│   └── enroll_user.py              # User enrollment logic
├── liveness/
│   ├── blink_detector.py           # Eye blink detection for liveness
│   ├── challenge_manager.py        # Random challenge generation
│   └── head_pose.py                # Head pose estimation
├── security/
│   └── encryptor.py                # Embedding encryption/decryption
└── verification/
    └── verify_user.py              # Face verification logic
```

## Installation

### Prerequisites

- Python 3.8 or higher
- pip package manager

### Steps

1. **Clone or download the repository**

   ```bash
   cd "Face Recognition Module"
   ```

2. **Install required packages**

   ```bash
   pip install -r requirements.txt
   ```

   Or manually install key dependencies:

   ```bash
   pip install -U insightface
   pip install onnxruntime
   pip install fastapi uvicorn
   pip install cryptography
   ```

3. **Initialize the database** (automatically happens on first run)
   ```python
   python -c "from database.db import init_db; init_db()"
   ```

## Configuration

### Database Configuration

- **DB_PATH**: `face_embeddings.db` (configurable in `database/db.py`)
- **MAX_EMBEDDINGS**: Maximum embeddings stored per user (default: 10)

### Face Detection Configuration

- **Model**: InsightFace Buffalo-SC (detection size: 320x320)
- **Context ID**: -1 (CPU mode, change to 0 for GPU)

### Verification Threshold

- **Similarity Threshold**: 0.50 (configurable in `main_pipeline.py`)
  - Values above 0.50 indicate successful face match

### Liveness Challenges

Available challenges in `liveness/challenge_manager.py`:

- `blink` - Single eye blink
- `blink_twice` - Double blink
- `turn_left` - Turn head left
- `turn_right` - Turn head right

## API Endpoints

### 1. Face Enrollment Endpoint

**POST** `/enroll-face`

Enrolls a new user by capturing facial frames and storing the averaged embedding.

**Request Body:**

```json
{
  "user_id": "string (unique user identifier)",
  "frames": "list of numpy arrays or image frames (10-15 frames recommended)"
}
```

**Response:**

```json
{
  "status": "enrolled",
  "embedding_dim": 128
}
```

**Status Codes:**

- `"enrolled"` - Successfully enrolled
- `"no_face"` - No face detected in provided frames

---

### 2. Face Verification Endpoint

**POST** `/verify-face`

Verifies a user's face against their stored embeddings.

**Request Body:**

```json
{
  "user_id": "string (user to verify against)",
  "frames": "list of numpy arrays or image frames (5-10 frames)"
}
```

**Response:**

```json
{
  "status": "verified or rejected",
  "similarity": 0.75
}
```

**Status Codes:**

- `"verified"` - Similarity > 0.50 threshold
- `"rejected"` - Similarity ≤ 0.50 threshold
- `"no_face"` - No face detected in provided frames

---

## Module Descriptions

### 1. **main_pipeline.py**

FastAPI application with two main endpoints for face enrollment and verification. Handles frame processing, embedding generation, and decision logic.

**Key Functions:**

- `verify_face()` - POST endpoint for face verification
- `enroll_face()` - POST endpoint for face enrollment

---

### 2. **database/db.py**

SQLite database management for storing user embeddings.

**Key Functions:**

- `init_db()` - Creates users table if not exists
- `save_user_embedding(user_id, embeddings)` - Stores or updates user embeddings (keeps last 10)
- `get_user_embeddings(user_id)` - Retrieves all embeddings for a user

**Database Schema:**

```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    embeddings TEXT  -- JSON array of embedding vectors
);
```

---

### 3. **embedding/mobilefacenet_embedder.py**

Generates 128-dimensional facial embeddings using InsightFace's MobileFaceNet model.

**Key Functions:**

- `__init__()` - Initializes FaceAnalysis model
- `get_embedding(image)` - Returns normalized embedding for detected face

**Model Details:**

- Model: InsightFace Buffalo-SC
- Output Dimension: 128
- Speed: Fast inference on CPU
- Handles face detection automatically

---

### 4. **enrollment/enroll_user.py**

Processes multiple face frames and generates a single averaged embedding for enrollment.

**Key Functions:**

- `enroll(faces)` - Takes list of face frames, returns averaged embedding

**Process:**

1. Extracts embedding from each frame
2. Computes mean of all embeddings
3. Returns final averaged embedding

---

### 5. **verification/verify_user.py**

Compares a candidate embedding against stored user embeddings using cosine similarity.

**Key Functions:**

- `cosine_similarity(a, b)` - Computes cosine similarity between two embeddings
- `verify(candidate, stored_embeddings)` - Returns highest similarity score

**Similarity Range:** 0.0 to 1.0 (1.0 = most similar)

---



## Performance Metrics

| Metric                        | Value           |
| ----------------------------- | --------------- |
| Embedding Dimension           | 128             |
| Inference Time per Frame      | ~50-100ms (CPU) |
| Database Query Time           | <5ms            |
| Cosine Similarity Computation | <1ms            |
| Typical API Response Time     | 100-500ms       |

---

## Dependencies Summary

| Package       | Version  | Purpose                    |
| ------------- | -------- | -------------------------- |
| insightface   | latest   | Face detection & embedding |
| onnxruntime   | latest   | Model inference            |
| fastapi       | >=0.68.0 | REST API framework         |
| uvicorn       | >=0.15.0 | ASGI server                |
| cryptography  | >=3.4    | Encryption/decryption      |
| numpy         | >=1.19.0 | Array operations           |
| opencv-python | >=4.5.0  | Image processing           |

---

## License

Part of attendance management app

---

