BLE ATTENDANCE SYSTEM (ESP32 + SERVER)
=====================================

OVERVIEW
--------
This project implements a BLE-based attendance / beacon system using ESP32 and a Python Flask server.

- ESP32 scans or broadcasts BLE beacons
- A Python server dynamically generates minor values
- Communication happens via HTTP over WiFi
- Designed for proximity detection / attendance tracking


PROJECT STRUCTURE
-----------------

Attendance/
|
|-- .pio/                  -> PlatformIO build files
|-- .vscode/               -> VS Code settings
|-- include/               -> Header files
|-- lib/                   -> Libraries
|-- src/
|    |-- main.cpp          -> ESP32 main firmware
|-- test/                  -> Test files
|-- platformio.ini         -> PlatformIO config
|-- .gitignore
|-- server.py              -> Flask backend server


REQUIREMENTS
------------

SERVER SIDE:
- Python 3.11.0
- Flask
- requests

Install dependencies:
    pip install flask requests


ESP32 SIDE:
- ESP32 board
- PlatformIO (recommended)
- Libraries used:
    - WiFi
    - HTTPClient
    - NimBLE


HOW IT WORKS
------------

1. ESP32 connects to WiFi
2. ESP32 sends request to server:
       GET /getMinor?major=<value>
3. Server generates a random minor value
4. Server returns JSON response
5. ESP32 uses:
       - Fixed UUID
       - Major value
       - Received minor
6. ESP32 starts BLE operation (scan/advertise)


RUNNING THE PROJECT
------------------

STEP 1: Start the server

    python server.py

Server runs at:
    http://<YOUR_IP>:4040


STEP 2: Configure ESP32

Edit src/main.cpp:

    const char* ssid = "YOUR_WIFI";
    const char* password = "YOUR_PASSWORD";

    String serverURL = "http://<SERVER_IP>:4040/getMinor";


STEP 3: Upload to ESP32

Using PlatformIO:

    pio run --target upload

Or using VS Code:
    Click "Build" and "Upload" button


API ENDPOINT
------------

GET /getMinor

Query parameter:
    major (integer)

Response:
    {
        "status": "success",
        "minor": <random_value>
    }


KNOWN ISSUE (IMPORTANT)
----------------------

If you see error like:

    Failed to establish a new connection: nodename nor servname provided

This is because:

    LOG_ENDPOINT = "http://aaaaa/api/beacons/events"

"aaaaa" is not a valid server address.

Fix:
- Replace with real IP or URL
- Or disable logging if not needed


TESTING
-------

Used our Swift App for iOS

Use BLE apps:
- nRF Connect
- BLE Scanner

Expected:
- Beacon UUID visible
- Major value
- Changing minor values


NOTES
-----

- ESP32 and server must be on same network
- iOS has BLE limitations
- Ensure firewall is not blocking port 4040


FUTURE IMPROVEMENTS
-------------------

- Store attendance logs in database
- Improve RSSI-based distance estimation
- Improve the mobile app flow process
- Handle multiple classrooms


AUTHOR
------

Kosaraju Jyothsna Abhay
ES22BTECH11021
IIT Hyderabad
