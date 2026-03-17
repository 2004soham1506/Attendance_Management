import SwiftUI

// MARK: - Role Selection
struct RoleSelectionView: View {
    @Binding var isLoggedIn: Bool
    @Binding var role: UserRole
    @State private var navigateToLogin = false
    @State private var selectedRole: UserRole = .student

    var body: some View {
        NavigationView {
            VStack(spacing: 32) {
                Spacer()
                VStack(spacing: 8) {
                    Image("iithlogo")
                        .resizable().scaledToFit()
                        .frame(width: 80, height: 80)
                    Text("Attendance Portal")
                        .font(.largeTitle).bold()
                    Text("IIT Hyderabad")
                        .font(.subheadline).foregroundColor(.secondary)
                }

                VStack(spacing: 14) {
                    Text("I am a...")
                        .font(.headline).foregroundColor(.secondary)
                    RoleButton(title: "Student",   icon: "graduationcap.fill", selected: selectedRole == .student)   { selectedRole = .student }
                    RoleButton(title: "Professor", icon: "person.fill.checkmark", selected: selectedRole == .professor) { selectedRole = .professor }
                    RoleButton(title: "Admin",     icon: "shield.fill",        selected: selectedRole == .admin)     { selectedRole = .admin }
                }
                .padding(.horizontal, 28)

                NavigationLink(destination: LoginView(isLoggedIn: $isLoggedIn, role: $role, selectedRole: selectedRole),
                               isActive: $navigateToLogin) { EmptyView() }

                Button(action: { navigateToLogin = true }) {
                    Text("Continue")
                        .font(.headline).foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding()
                        .background(Color(red: 0.102, green: 0.451, blue: 0.910))
                        .cornerRadius(10)
                }
                .padding(.horizontal, 28)

                Spacer()
            }
            .background(Color.gray.opacity(0.07).ignoresSafeArea())
            .navigationBarHidden(true)
        }
    }
}

struct RoleButton: View {
    let title: String
    let icon: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(selected ? .white : Color(red: 0.102, green: 0.451, blue: 0.910))
                    .frame(width: 36)
                Text(title)
                    .font(.headline)
                    .foregroundColor(selected ? .white : .primary)
                Spacer()
                if selected {
                    Image(systemName: "checkmark")
                        .foregroundColor(.white)
                }
            }
            .padding()
            .background(selected ? Color(red: 0.102, green: 0.451, blue: 0.910) : Color.white)
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.07), radius: 4, x: 0, y: 2)
        }
    }
}
