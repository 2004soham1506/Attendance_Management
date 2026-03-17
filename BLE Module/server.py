import random
import requests
from flask import Flask, request, jsonify
from collections import defaultdict, deque
from datetime import datetime, timezone

app = Flask(__name__)

# Logging endpoint [to be updated from the backend side]
LOG_ENDPOINT = "http://aaaaa/api/beacons/events"

# Caching
major_cache = defaultdict(lambda: deque(maxlen=2))


@app.route('/getMinor', methods=['GET'])
def handle_major():
    major_value = request.args.get('major')

    if not major_value:
        return "missing major", 400

    major_value = int(major_value)
    now = datetime.now(timezone.utc)

    # Check cache
    if major_value in major_cache and len(major_cache[major_value]) > 0:
        latest_entry = major_cache[major_value][-1]

        last_time = datetime.fromisoformat(latest_entry["timestamp"])
        time_diff = (now - last_time).total_seconds()

        # If last minor was generated within 30 seconds → reuse
        if time_diff <= 30:
            print(f"Reusing minor for major {major_value}: {latest_entry['minor']}")
            return str(latest_entry["minor"]), 200

    # Otherwise generate new minor
    minor_value = random.randint(0, 65535)
    timestamp = now.isoformat()

    log_data = {
        "major": major_value,
        "minor": minor_value,
        "timestamp": timestamp
    }

    # Store in cache (deque will auto pop old if >2)
    major_cache[major_value].append(log_data)

    # Send log to external DB server
    try:
        requests.post(LOG_ENDPOINT, json=log_data, timeout=2)
    except Exception as e:
        print("Logging server unreachable:", e)

    print(f"Generated new minor: {minor_value} for major {major_value}")

    return str(minor_value), 200


@app.route('/validate', methods=['GET'])
def validate_minor():
    major_value = request.args.get('major')
    minor_value = request.args.get('minor')

    if not major_value or not minor_value:
        return jsonify({"valid": False, "error": "missing major or minor"}), 400

    major_value = int(major_value)
    minor_value = int(minor_value)

    if major_value not in major_cache:
        return jsonify({"valid": False})

    for entry in major_cache[major_value]:
        if entry["minor"] == minor_value:
            return jsonify({"valid": True})

    return jsonify({"valid": False})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4040)