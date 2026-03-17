import SwiftUI

enum UserRole { case student, professor, admin }

struct ContentView: View {
    @State private var isLoggedIn = false
    @State private var role: UserRole = .student

    var body: some View {
        Group {
            if isLoggedIn {
                switch role {
                case .student:   StudentTabView(isLoggedIn: $isLoggedIn)
                case .professor: ProfessorTabView(isLoggedIn: $isLoggedIn)
                case .admin:     ProfessorTabView(isLoggedIn: $isLoggedIn) // same for now
                }
            } else {
                RoleSelectionView(isLoggedIn: $isLoggedIn, role: $role)
            }
        }
        .preferredColorScheme(.light)
    }
}
