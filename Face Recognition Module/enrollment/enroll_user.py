import numpy as np

class Enrollment:

    def __init__(self, embedder):
        self.embedder = embedder

    def enroll(self, faces):
        embeddings = []
        for face in faces:
            emb = self.embedder.get_embedding(face)
            embeddings.append(emb)

        embeddings = np.array(embeddings)
        final_embedding = np.mean(embeddings, axis=0)

        return final_embedding