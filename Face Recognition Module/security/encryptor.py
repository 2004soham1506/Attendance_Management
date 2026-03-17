from cryptography.fernet import Fernet
import numpy as np

class EmbeddingEncryptor:

    def __init__(self, key):
        self.cipher = Fernet(key)

    def encrypt(self, embedding):
        data = embedding.tobytes()
        encrypted = self.cipher.encrypt(data)
        return encrypted

    def decrypt(self, encrypted):
        decrypted = self.cipher.decrypt(encrypted)
        embedding = np.frombuffer(decrypted, dtype=np.float32)
        return embedding