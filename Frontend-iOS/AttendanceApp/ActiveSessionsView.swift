import SwiftUI

// MARK: - Student Active Sessions
struct StudentSessionsView: View {
    @State private var professorMode: AttendanceMode = .qr   // TODO: fetch from backend

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    // Session 1 — QR (professor-driven mode)
                    SessionCard(
                        title: "Swift App Dev",
                        subtitle: "Prof. Smith  •  Room 304",
                        mode: professorMode,
                        destination: AnyView(MarkAttendanceFlow(mode: professorMode))
                    )

                    // Session 2 — BLE (hardcoded)
                    SessionCard(
                        title: "Machine Learning",
                        subtitle: "Prof. Rao  •  Room 101",
                        mode: .ble,
                        destination: AnyView(MarkAttendanceFlow(mode: .ble))
                    )
                }
                .padding(.vertical)
            }
            .background(Color.gray.opacity(0.1))
            .navigationTitle("Active Sessions")
        }
    }
}

// Reusable session card
struct SessionCard: View {
    let title: String
    let subtitle: String
    let mode: AttendanceMode
    let destination: AnyView

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                Color(red: 0.102, green: 0.451, blue: 0.910).frame(height: 60)
                Text(title).font(.headline).bold().foregroundColor(.white)
                    .padding([.leading, .bottom], 12)
            }
            .clipShape(CornerShape(radius: 15, corners: [.topLeft, .topRight]))

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Circle().fill(Color.red).frame(width: 8, height: 8)
                    Text("Currently Active").font(.caption).bold().foregroundColor(.red)
                }
                Text(subtitle).font(.subheadline).foregroundColor(.secondary)
                HStack {
                    Label("Mode:", systemImage: "info.circle").font(.caption).foregroundColor(.secondary)
                    Text(mode.label).font(.caption).bold()
                        .foregroundColor(Color(red: 0.102, green: 0.451, blue: 0.910))
                }
                Divider()
                NavigationLink(destination: destination) {
                    Text("Mark Attendance")
                        .font(.headline).foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding()
                        .background(Color(red: 0.102, green: 0.451, blue: 0.910))
                        .cornerRadius(10)
                }
            }
            .padding(14)
            .background(Color.white)
            .clipShape(CornerShape(radius: 15, corners: [.bottomLeft, .bottomRight]))
        }
        .shadow(color: Color.black.opacity(0.08), radius: 5, x: 0, y: 2)
        .padding(.horizontal)
    }
}

// MARK: - Mark Attendance Flow: QR/BLE → then Face Verify
enum AttendanceMode {
    case qr, ble
    var label: String { self == .qr ? "QR Scan" : "BLE Scan" }
    var icon: String  { self == .qr ? "qrcode.viewfinder" : "antenna.radiowaves.left.and.right" }
}

struct MarkAttendanceFlow: View {
    let mode: AttendanceMode
    @State private var step = 1   // 1 = QR/BLE, 2 = Face Verify, 3 = Done

    var body: some View {
        VStack(spacing: 32) {
            // Step indicator
            HStack(spacing: 0) {
                StepDot(num: 1, label: mode.label,    active: step >= 1)
                Rectangle().frame(height: 2)
                    .foregroundColor(step >= 2 ? Color(red: 0.102, green: 0.451, blue: 0.910) : Color.gray.opacity(0.3))
                StepDot(num: 2, label: "Face Verify", active: step >= 2)
            }
            .padding(.horizontal, 40)
            .padding(.top, 32)

            Spacer()

            if step == 1 {
                if mode == .qr {
                    QRScannerView { _ in step = 2 }
                        .frame(height: 340)
                        .cornerRadius(16)
                        .padding(.horizontal)
                } else {
                    // Real BLE scan
                    StudentBLEScanView { step = 2 }
                }
            } else if step == 2 {
                // Real front camera capture
                FaceCaptureView { _ in
                    // TODO: send image to backend for verification
                    step = 3
                }
                .frame(height: 400)
                .cornerRadius(16)
                .padding(.horizontal)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 72))
                        .foregroundColor(Color(red: 0.204, green: 0.659, blue: 0.325))
                    Text("Attendance Marked!")
                        .font(.title2).bold()
                    Text("You're all set for this class.")
                        .font(.subheadline).foregroundColor(.secondary)
                }
            }

            Spacer()
        }
        .navigationTitle("Mark Attendance")
        .background(Color.gray.opacity(0.07).ignoresSafeArea())
    }
}

struct StepDot: View {
    let num: Int
    let label: String
    let active: Bool
    private let gBlue = Color(red: 0.102, green: 0.451, blue: 0.910)

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(active ? gBlue : Color.gray.opacity(0.3))
                    .frame(width: 32, height: 32)
                Text("\(num)").font(.headline).foregroundColor(.white)
            }
            Text(label).font(.caption).foregroundColor(active ? gBlue : .secondary)
        }
    }
}
