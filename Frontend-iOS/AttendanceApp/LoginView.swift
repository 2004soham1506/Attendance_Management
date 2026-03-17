import SwiftUI

struct LoginView: View {
    @Binding var isLoggedIn: Bool
    @Binding var role: UserRole
    let selectedRole: UserRole

    @State private var email = ""
    @State private var password = ""

    private let gBlue = Color(red: 0.102, green: 0.451, blue: 0.910)

    var roleLabel: String {
        switch selectedRole {
        case .student:   return "Student"
        case .professor: return "Professor"
        case .admin:     return "Admin"
        }
    }

    var body: some View {
        VStack(spacing: 32) {
            Spacer()
            VStack(spacing: 8) {
                Image("iithlogo")
                    .resizable().scaledToFit()
                    .frame(width: 80, height: 80)
                Text("Sign In as \(roleLabel)")
                    .font(.title2).bold()
            }

            VStack(spacing: 14) {
                TextField("Email", text: $email)
                    .padding()
                    .background(Color.gray.opacity(0.12))
                    .cornerRadius(10)

                SecureField("Password", text: $password)
                    .padding()
                    .background(Color.gray.opacity(0.12))
                    .cornerRadius(10)

                Button(action: {
                    role = selectedRole
                    isLoggedIn = true
                }) {
                    Text("Sign In")
                        .font(.headline).foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding()
                        .background(gBlue)
                        .cornerRadius(10)
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 28)

            Spacer()
        }
        .background(Color.gray.opacity(0.07).ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
    }
}
