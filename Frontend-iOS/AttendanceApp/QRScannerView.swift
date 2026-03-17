import SwiftUI
import AVFoundation

// MARK: - QR Scanner (back camera)

struct QRScannerView: UIViewControllerRepresentable {
    var onScanned: (String) -> Void

    func makeUIViewController(context: Context) -> QRScannerVC {
        let vc = QRScannerVC()
        vc.onScanned = onScanned
        return vc
    }
    func updateUIViewController(_ uiViewController: QRScannerVC, context: Context) {}
}

class QRScannerVC: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onScanned: ((String) -> Void)?
    private var session = AVCaptureSession()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return }

        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { return }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = view.bounds
        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)

        // Overlay: scanning frame
        let box = UIView(frame: CGRect(x: view.bounds.midX - 120, y: view.bounds.midY - 120, width: 240, height: 240))
        box.layer.borderColor = UIColor.white.cgColor
        box.layer.borderWidth = 2
        box.layer.cornerRadius = 12
        view.addSubview(box)

        DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        session.stopRunning()
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput objects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        if let obj = objects.first as? AVMetadataMachineReadableCodeObject,
           let value = obj.stringValue {
            session.stopRunning()
            onScanned?(value)
        }
    }
}

// MARK: - QR Scan Screen (student)

struct StudentQRScanView: View {
    var onSuccess: () -> Void
    @State private var scanned = false
    @State private var scannedValue = ""
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack(alignment: .bottom) {
            if !scanned {
                QRScannerView { value in
                    scannedValue = value
                    scanned = true
                }
                .ignoresSafeArea()

                VStack {
                    Text("Point camera at QR code")
                        .font(.subheadline).foregroundColor(.white)
                        .padding(10)
                        .background(Color.black.opacity(0.5))
                        .cornerRadius(8)
                }
                .padding(.bottom, 60)
            } else {
                VStack(spacing: 20) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 72))
                        .foregroundColor(Color(red: 0.204, green: 0.659, blue: 0.325))
                    Text("QR Scanned!")
                        .font(.title2).bold()
                    Text(scannedValue)
                        .font(.caption).foregroundColor(.secondary)
                    Button(action: { onSuccess(); dismiss() }) {
                        Text("Continue to Face Verify")
                            .font(.headline).foregroundColor(.white)
                            .frame(maxWidth: .infinity).padding()
                            .background(Color(red: 0.102, green: 0.451, blue: 0.910))
                            .cornerRadius(10)
                    }
                    .padding(.horizontal, 28)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.gray.opacity(0.07))
            }
        }
        .navigationTitle("Scan QR")
    }
}
