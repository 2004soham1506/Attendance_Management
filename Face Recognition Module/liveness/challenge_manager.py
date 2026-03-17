import random

class ChallengeManager:

    def __init__(self):

        self.challenges = [
            "blink",
            "turn_left",
            "turn_right",
            "blink_twice"
        ]

    def get_random_challenge(self):

        return random.choice(self.challenges)