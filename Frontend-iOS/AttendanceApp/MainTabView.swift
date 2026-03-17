import SwiftUI

// MARK: - Shared profile overlay used by both tab views
struct ProfileToolbarButton: View {
    @Binding var showProfile: Bool
    var body: some View {
        Button(action: { showProfile = true }) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 26))
                .foregroundColor(Color(red: 0.102, green: 0.451, blue: 0.910))
        }
    }
}

struct ProfileSheet: View {
    @Binding var isLoggedIn: Bool
    @Binding var showProfile: Bool

    // TODO: replace with real user from backend
    let name  = "Sreehith Sanam"
    let email = "sreehith@iith.ac.in"
    let id    = "CS22BTECH11050"

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(Color(red: 0.102, green: 0.451, blue: 0.910))
                .padding(.top, 40)

            VStack(spacing: 6) {
                Text(name).font(.title2).bold()
                Text(email).font(.subheadline).foregroundColor(.secondary)
                Text(id).font(.subheadline).foregroundColor(.secondary)
            }

            Divider().padding(.horizontal)

            VStack(spacing: 12) {
                Button(action: {
                    showProfile = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { isLoggedIn = false }
                }) {
                    Label("Log Out", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(.headline).foregroundColor(.red)
                        .frame(maxWidth: .infinity).padding()
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(12)
                }
                Button(action: { showProfile = false }) {
                    Text("Close").font(.subheadline).foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 28)
            Spacer()
        }
    }
}

// MARK: - Student Tab
struct StudentTabView: View {
    @Binding var isLoggedIn: Bool
    @State private var showProfile = false

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dashboard", systemImage: "chart.bar.fill") }
            StudentSessionsView()
                .tabItem { Label("Active Sessions", systemImage: "clock.fill") }
        }
        .accentColor(Color(red: 0.102, green: 0.451, blue: 0.910))
        .overlay(alignment: .topTrailing) {
            ProfileToolbarButton(showProfile: $showProfile)
                .padding(.trailing, 16)
                .padding(.top, 8)
        }
        .sheet(isPresented: $showProfile) {
            ProfileSheet(isLoggedIn: $isLoggedIn, showProfile: $showProfile)
        }
    }
}

// MARK: - Professor Tab
struct ProfessorTabView: View {
    @Binding var isLoggedIn: Bool
    @State private var showProfile = false

    var body: some View {
        TabView {
            ProfessorScheduleView()
                .tabItem { Label("Schedule", systemImage: "calendar") }
            ProfessorSessionView()
                .tabItem { Label("Courses", systemImage: "book.fill") }
            ProfessorAnalyticsView()
                .tabItem { Label("Analytics", systemImage: "chart.bar.fill") }
        }
        .accentColor(Color(red: 0.102, green: 0.451, blue: 0.910))
        .overlay(alignment: .topTrailing) {
            ProfileToolbarButton(showProfile: $showProfile)
                .padding(.trailing, 16)
                .padding(.top, 8)
        }
        .sheet(isPresented: $showProfile) {
            ProfileSheet(isLoggedIn: $isLoggedIn, showProfile: $showProfile)
        }
    }
}
