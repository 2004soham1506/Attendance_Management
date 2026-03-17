import numpy as np

class Verifier:

    def cosine_similarity(self, a, b):
        return np.dot(a,b) / (np.linalg.norm(a)*np.linalg.norm(b))

    def verify(self, candidate, stored_embeddings):
        scores = []
        
        for emb in stored_embeddings:
            score = self.cosine_similarity(candidate, emb)
            scores.append(score)

        return max(scores)