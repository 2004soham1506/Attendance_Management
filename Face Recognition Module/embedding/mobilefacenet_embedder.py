import numpy as np
from insightface.app import FaceAnalysis


class MobileFaceNet:

    def __init__(self):
        self.app = FaceAnalysis(name="buffalo_sc")
        self.app.prepare(
            ctx_id=-1,
            det_size=(320,320)
        )

    def get_embedding(self, image):
        faces = self.app.get(image)

        if len(faces) == 0:
            return None

        embedding = faces[0].embedding
        embedding = embedding / np.linalg.norm(embedding)
        return embedding













# import cv2
# import numpy as np
# import onnxruntime as ort

# class MobileFaceNet:

#     def __init__(self, model_path):

#         self.session = ort.InferenceSession(model_path)
#         self.input_name = self.session.get_inputs()[0].name

#     def preprocess(self, face):

#         face = cv2.resize(face, (112,112))
#         face = face.astype(np.float32) / 255.0

#         face = np.transpose(face, (2,0,1))
#         face = np.expand_dims(face, axis=0)

#         return face

#     def get_embedding(self, face):

#         input_tensor = self.preprocess(face)

#         embedding = self.session.run(
#             None,
#             {self.input_name: input_tensor}
#         )[0]

#         embedding = embedding.flatten()

#         return embedding / np.linalg.norm(embedding)