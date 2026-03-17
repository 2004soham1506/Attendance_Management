import SwiftUI
import AVFoundation

// MARK: - Face Capture (front camera)

struct FaceCaptureView: UIViewControllerRepresentable {
    var onCaptured: (UIImage) -> Void

    func makeUIViewController(context: Context) -> FaceCaptureVC {
        let vc = FaceCaptureVC()
        vc.onCaptured = onCaptured
        return vc
    }
    func updateUIViewController(_ uiViewController: FaceCaptureVC, context: Context) {}
}

class FaceCaptureVC: UIViewController {
    var onCaptured: ((UIImage) -> Void)?
    private var session = AVCaptureSession()
    private var photoOutput = AVCapturePhotoOutput()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input),
              session.canAddOutput(photoOutput) else { return }

        session.addInput(input)
        session.addOutput(photoOutput)

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = view.bounds
        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)

        // Capture button
        let btn = UIButton(type: .system)
        btn.setTitle("Capture", for: .normal)
        btn.titleLabel?.font = .boldSystemFont(ofSize: 18)
        btn.setTitleColor(.white, for: .normal)
        btn.backgroundColor = UIColor(red: 0.102, green: 0.451, blue: 0.910, alpha: 1)
        btn.layer.cornerRadius = 30
        btn.frame = CGRect(x: view.bounds.midX - 70, y: view.bounds.maxY - 100, width: 140, height: 60)
        btn.addTarget(self, action: #selector(capture), for: .touchUpInside)
        view.addSubview(btn)

        DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        session.stopRunning()
    }

    @objc private func capture() {
        let settings = AVCapturePhotoSettings()
        photoOutput.capturePhoto(with: settings, delegate: self)
    }
}

extension FaceCaptureVC: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto,
                     error: Error?) {
        guard let data = photo.fileDataRepresentation(),
              let image = UIImage(data: data) else { return }
        session.stopRunning()
        onCaptured?(image)
    }
}

// MARK: - Face Verify Screen (student)

struct StudentFaceVerifyView: View {
    var onSuccess: () -> Void
    @State private var captured = false
    @State private var capturedImage: UIImage? = nil
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            if !captured {
                FaceCaptureView { image in
                    capturedImage = image
                    captured = true
                }
                .ignoresSafeArea()

                VStack {
                    Spacer()
                    Text("Look straight at the camera and tap Capture")
                        .font(.subheadline).foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .padding(10)
                        .background(Color.black.opacity(0.5))
                        .cornerRadius(8)
                        .padding(.bottom, 120)
                }
            } else {
                VStack(spacing: 20) {
                    if let img = capturedImage {
                        Image(uiImage: img)
                            .resizable().scaledToFill()
                            .frame(width: 160, height: 160)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(Color(red: 0.204, green: 0.659, blue: 0.325), lineWidth: 3))
                    }
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 48))
                        .foregroundColor(Color(red: 0.204, green: 0.659, blue: 0.325))
                    Text("Face Captured!")
                        .font(.title2).bold()
                    Text("Sending for verification...")
                        .font(.subheadline).foregroundColor(.secondary)
                    // TODO: POST capturedImage to backend for face verification
                    Button(action: { onSuccess(); dismiss() }) {
                        Text("Done")
                            .font(.headline).foregroundColor(.white)
                            .frame(maxWidth: .infinity).padding()
                            .background(Color(red: 0.204, green: 0.659, blue: 0.325))
                            .cornerRadius(10)
                    }
                    .padding(.horizontal, 28)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.gray.opacity(0.07))
            }
        }
        .navigationTitle("Face Verify")
    }
}
