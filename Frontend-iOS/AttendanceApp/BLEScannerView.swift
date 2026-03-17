import SwiftUI
import CoreLocation
import Combine

// MARK: - iBeacon Scanner using CoreLocation
class BLEScanner: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let beaconUUID = UUID(uuidString: "550e8400-e29b-41d4-a716-446655440000")!

    @Published var status: BLEScanStatus = .idle
    @Published var result: BLEResult? = nil
    @Published var scanCountdown: Int = 3

    private var locationManager = CLLocationManager()
    private var rssiReadings: [Int] = []
    private var foundMinor: Int? = nil
    private var foundMajor: Int? = nil
    private var countdownTimer: Timer? = nil

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.requestWhenInUseAuthorization()
    }

    func scan() {
        rssiReadings = []
        foundMinor = nil
        foundMajor = nil
        result = nil
        scanCountdown = 3
        status = .scanning

        let constraint = CLBeaconIdentityConstraint(uuid: beaconUUID)
        let region = CLBeaconRegion(beaconIdentityConstraint: constraint, identifier: "IITH-Beacon")
        locationManager.startRangingBeacons(satisfying: constraint)

        var tick = 3
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] t in
            tick -= 1
            self?.scanCountdown = tick
            if tick <= 0 {
                t.invalidate()
                self?.finish(region: region)
            }
        }
    }

    func stop() {
        let constraint = CLBeaconIdentityConstraint(uuid: beaconUUID)
        locationManager.stopRangingBeacons(satisfying: constraint)
        countdownTimer?.invalidate()
    }

    private func finish(region: CLBeaconRegion) {
        locationManager.stopRangingBeacons(satisfying: region.beaconIdentityConstraint)
        if rssiReadings.isEmpty {
            status = .notFound
        } else {
            let mean = Double(rssiReadings.reduce(0, +)) / Double(rssiReadings.count)
            result = BLEResult(minor: foundMinor ?? 0, major: foundMajor ?? 0, meanRSSI: mean)
            // TODO: POST result (minor, major, meanRSSI) to backend
            status = .found
        }
    }

    // MARK: - CLLocationManagerDelegate
    func locationManager(_ manager: CLLocationManager, didRange beacons: [CLBeacon],
                         satisfying constraint: CLBeaconIdentityConstraint) {
        for beacon in beacons where beacon.proximity != .unknown {
            foundMajor = beacon.major.intValue
            foundMinor = beacon.minor.intValue
            rssiReadings.append(beacon.rssi)
            print("Beacon: major=\(beacon.major) minor=\(beacon.minor) rssi=\(beacon.rssi) proximity=\(beacon.proximity.rawValue)")
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .denied { status = .unauthorized }
    }
}

// MARK: - Models
enum BLEScanStatus { case idle, scanning, found, notFound, unauthorized }
struct BLEResult { let minor: Int; let major: Int; let meanRSSI: Double }

// MARK: - Student BLE Scan View
struct StudentBLEScanView: View {
    var onSuccess: () -> Void
    @StateObject private var scanner = BLEScanner()
    @State private var timeLeft = 120
    @State private var countdownTimer: Timer? = nil
    @Environment(\.dismiss) var dismiss

    private let purple = Color(red: 0.416, green: 0.353, blue: 0.804)

    var body: some View {
        VStack(spacing: 28) {
            ZStack {
                Circle().stroke(Color.gray.opacity(0.2), lineWidth: 8).frame(width: 110, height: 110)
                Circle()
                    .trim(from: 0, to: CGFloat(timeLeft) / 120)
                    .stroke(purple, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 110, height: 110)
                    .animation(.linear(duration: 1), value: timeLeft)
                Text(timeString).font(.title2).bold()
            }
            .padding(.top, 32)

            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.system(size: 64))
                .foregroundColor(scanner.status == .scanning ? purple : Color.gray.opacity(0.4))
                .symbolEffect(.pulse, isActive: scanner.status == .scanning)

            Text(statusMessage)
                .font(.subheadline).foregroundColor(.secondary)
                .multilineTextAlignment(.center).padding(.horizontal)

            if let r = scanner.result {
                VStack(spacing: 10) {
                    Text("Beacon Detected").font(.headline)
                    Divider()
                    HStack {
                        statLabel("Major",     value: "\(r.major)")
                        Spacer()
                        statLabel("Minor",     value: "\(r.minor)")
                        Spacer()
                        statLabel("Mean RSSI", value: String(format: "%.1f dBm", r.meanRSSI))
                    }
                    .padding(.horizontal, 8)
                    Text("TODO: send to backend").font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .background(Color.white)
                .cornerRadius(14)
                .shadow(color: Color.black.opacity(0.07), radius: 5, x: 0, y: 2)
                .padding(.horizontal)
            }

            if scanner.status == .idle || scanner.status == .notFound {
                Button(action: { scanner.scan() }) {
                    Label("Scan for Beacon", systemImage: "dot.radiowaves.left.and.right")
                        .font(.headline).foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding()
                        .background(purple).cornerRadius(10)
                }
                .padding(.horizontal, 28)
            }

            if scanner.status == .found {
                Button(action: { onSuccess(); dismiss() }) {
                    Text("Continue to Face Verify")
                        .font(.headline).foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding()
                        .background(purple).cornerRadius(10)
                }
                .padding(.horizontal, 28)
            }

            Spacer()
        }
        .navigationTitle("BLE Scan")
        .background(Color.gray.opacity(0.07).ignoresSafeArea())
        .onAppear {
            countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                if timeLeft > 0 { timeLeft -= 1 } else { scanner.stop(); countdownTimer?.invalidate() }
            }
        }
        .onDisappear { scanner.stop(); countdownTimer?.invalidate() }
    }

    private var timeString: String { String(format: "%d:%02d", timeLeft / 60, timeLeft % 60) }

    private var statusMessage: String {
        switch scanner.status {
        case .idle:         return "Tap Scan to search for the classroom beacon"
        case .scanning:     return "Scanning... \(scanner.scanCountdown)"
        case .found:        return "Beacon found!"
        case .notFound:     return "Beacon not found. Try again."
        case .unauthorized: return "Location permission denied. Enable in Settings."
        }
    }

    private func statLabel(_ title: String, value: String) -> some View {
        VStack(spacing: 4) {
            Text(title).font(.caption).foregroundColor(.secondary)
            Text(value).font(.headline).bold()
        }
    }
}
