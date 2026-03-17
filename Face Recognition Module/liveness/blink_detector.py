
import numpy as np

class BlinkDetector:

    def eye_aspect_ratio(self, eye):

        A = np.linalg.norm(eye[1] - eye[5])
        B = np.linalg.norm(eye[2] - eye[4])
        C = np.linalg.norm(eye[0] - eye[3])

        ear = (A + B) / (2.0 * C)

        return ear

    def detect_blink(self, left_eye, right_eye):

        left = self.eye_aspect_ratio(left_eye)
        right = self.eye_aspect_ratio(right_eye)

        ear = (left + right) / 2

        if ear < 0.2:
            return True

        return False