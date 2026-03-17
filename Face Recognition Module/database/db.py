from pymongo import MongoClient
import numpy as np

# 🔹 Mongo Connection
client = MongoClient("mongodb://localhost:27017/")  # change if using cloud (Atlas)
db = client["face_db"]
collection = db["users"]

# 🔹 config
MAX_EMBEDDINGS = 10


# 🔹 SAVE (Enroll / Update)
def save_user_embedding(user_id, embeddings):
    """
    embeddings: list of numpy arrays
    """

    # convert numpy → list
    new_embeddings = [emb.tolist() for emb in embeddings]

    user = collection.find_one({"user_id": user_id})

    if user:
        existing_embeddings = user.get("embeddings", [])

        # append new ones
        existing_embeddings.extend(new_embeddings)

        # 🔥 limit size (important)
        existing_embeddings = existing_embeddings[-MAX_EMBEDDINGS:]

        collection.update_one(
            {"user_id": user_id},
            {"$set": {"embeddings": existing_embeddings}}
        )

    else:
        collection.insert_one({
            "user_id": user_id,
            "embeddings": new_embeddings
        })

    return True


# 🔹 GET embeddings
def get_user_embeddings(user_id):

    user = collection.find_one({"user_id": user_id})

    if not user:
        return []

    embeddings = user.get("embeddings", [])

    # convert back to numpy
    embeddings = [np.array(e) for e in embeddings]

    return embeddings