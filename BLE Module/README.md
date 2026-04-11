# 📡 ATTENDANCE SYSTEM (BLE + QR + SERVER)

## OVERVIEW
This project implements a **real-time attendance system** using:

- 📶 BLE beacons (ESP32)
- 📱 Mobile frontend (scans BLE / QR)
- 🌐 Node.js backend (validation service)

The system supports **two attendance modes**:
- BLE-based proximity validation  
- QR-based time-bound validation  

Designed for **secure, contactless classroom attendance**.

---

## 🏗️ PROJECT STRUCTURE

```
server/
|
|-- src/
|    |-- modules/
|    |     |-- ble/
|    |     |-- qr/
|    |
|    |-- models/
|    |-- utils/
|    |-- config/
|
|-- server.js
|-- package.json
|-- .env
```

---

## ⚙️ REQUIREMENTS

### Backend
- Node.js (v18+ recommended)
- MongoDB
- npm

Install dependencies:

```
npm install
```

---

## 🚀 HOW IT WORKS

### 🔵 BLE FLOW

1. ESP32 beacon requests minor from server  
2. Server generates time-bound **minor (OTP-like)**  
3. Mobile scans multiple BLE beacons  
4. Frontend sends all detected beacons  
5. Backend:
   - Filters valid majors  
   - Picks strongest RSSI  
   - Validates minor (cache + DB)  

---

### 🟢 QR FLOW

1. Backend generates short-lived QR hash  
2. QR displayed on classroom screen  
3. Student scans QR  
4. Frontend sends hash + timestamp  
5. Backend validates:
   - Expiry (15 sec)  
   - Timestamp window (5 sec)  

---

### 🔐 FINAL STEP

```
Token validation → Face verification → Attendance marked
```

---

## 📡 API ENDPOINTS

### BLE

**POST /ble/generate-minor**  
Generate minor for beacon

Request:
```json
{
  "major_id": "abc123"
}
```

---

**POST /ble/validate**  
Validate BLE attendance

Request:
```json
{
  "class_id": "CS101",
  "beacons": [
    {
      "major": "abc123",
      "minor": "1721",
      "rssi": -68
    }
  ]
}
```

---

### QR

**POST /qr/generate**  
Generate QR hash

Request:
```json
{
  "class_id": "CS101"
}
```

---

**POST /qr/validate**  
Validate QR attendance

Request:
```json
{
  "class_id": "CS101",
  "hash": "a1b2c3d4",
  "timestamp": 1712770000000
}
```

---

## ▶️ RUNNING THE PROJECT

### 1. Start MongoDB
```
mongod
```

---

### 2. Start Server
```
npm run dev
```

Server runs at:
```
http://localhost:8000
```

---

### 3. Configure ESP32

```cpp
String serverURL = "http://<SERVER_IP>:8000/ble/generate-minor";
```

---

## 🧠 KEY FEATURES

- ⚡ Cache-first validation (fast)
- 🧹 TTL-based cleanup in MongoDB  
- 📶 Multi-beacon support with RSSI filtering  
- 🔐 Time-bound tokens (BLE + QR)  
- 📈 Scalable architecture  

---

## ⚠️ NOTES

- ESP32 and server must be on same network  
- RSSI values vary across devices  
- Ensure firewall allows port 8000  
- QR refresh interval ≈ 5 sec  

---

## 🔮 FUTURE IMPROVEMENTS

- Attendance logging system  
- Redis for distributed caching  
- Anti-spoofing (face + device binding)  
- Deployment (Docker / Cloud)  
- Analytics dashboard  

---

## 👨‍💻 AUTHOR

Kosaraju Jyothsna Abhay  
ES22BTECH11021  
IIT Hyderabad  

---

## 💬 SUMMARY

> A scalable, real-time attendance system using BLE proximity + QR time validation
