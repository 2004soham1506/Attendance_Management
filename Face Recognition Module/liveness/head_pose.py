import numpy as np

class HeadPose:

    def detect_turn(self, nose, left_eye, right_eye):

        left_dist = np.linalg.norm(nose - left_eye)
        right_dist = np.linalg.norm(nose - right_eye)

        if left_dist > right_dist * 1.4:
            return "left"

        if right_dist > left_dist * 1.4:
            return "right"

        return "center"