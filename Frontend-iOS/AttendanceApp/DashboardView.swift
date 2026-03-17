import SwiftUI

// MARK: - Model
struct Subject: Identifiable {
    let id = UUID()
    let name: String
    let code: String
    let bannerColor: Color
    var attended: Int
    var total: Int
    var percentage: Double { total > 0 ? Double(attended) / Double(total) * 100 : 0 }
}

// MARK: - DashboardView
struct DashboardView: View {
    @State private var subjects: [Subject] = [
        Subject(name: "Swift App Dev",    code: "CS5.401", bannerColor: Color(red: 0.102, green: 0.451, blue: 0.910), attended: 10, total: 10),
        Subject(name: "Machine Learning", code: "CS5.301", bannerColor: Color(red: 0.204, green: 0.659, blue: 0.325), attended: 18, total: 20),
        Subject(name: "Backend Dev",      code: "CS5.501", bannerColor: Color(red: 0.984, green: 0.467, blue: 0.094), attended: 15, total: 20),
    ]

    private var overall: Double {
        let a = subjects.reduce(0) { $0 + $1.attended }
        let t = subjects.reduce(0) { $0 + $1.total }
        return t > 0 ? Double(a) / Double(t) * 100 : 0
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    // Overall card
                    VStack(spacing: 6) {
                        Text("Overall Attendance")
                            .font(.subheadline).foregroundColor(.secondary)
                        Text(String(format: "%.1f%%", overall))
                            .font(.system(size: 56, weight: .bold))
                            .foregroundColor(overall >= 75 ? Color(red: 0.204, green: 0.659, blue: 0.325) : .red)
                        ProgressView(value: overall, total: 100)
                            .progressViewStyle(LinearProgressViewStyle(
                                tint: overall >= 75 ? Color(red: 0.204, green: 0.659, blue: 0.325) : .red))
                            .padding(.horizontal, 32)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .background(Color.white)
                    .cornerRadius(15)
                    .shadow(color: Color.black.opacity(0.08), radius: 5, x: 0, y: 2)
                    .padding(.horizontal)

                    ForEach(subjects) { subject in
                        SubjectCard(subject: subject)
                    }
                }
                .padding(.vertical)
            }
            .background(Color.gray.opacity(0.1))
            .navigationTitle("Analytics")
        }
    }
}

// MARK: - SubjectCard
struct SubjectCard: View {
    let subject: Subject

    private var statusColor: Color {
        subject.percentage >= 75 ? Color(red: 0.204, green: 0.659, blue: 0.325)
            : subject.percentage >= 60 ? Color(red: 0.984, green: 0.467, blue: 0.094)
            : .red
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                subject.bannerColor.frame(height: 60)
                Text(subject.name)
                    .font(.headline).bold().foregroundColor(.white)
                    .padding([.leading, .bottom], 12)
            }
            .clipShape(CornerShape(radius: 15, corners: [.topLeft, .topRight]))

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(subject.code).font(.caption).foregroundColor(.secondary)
                    ProgressView(value: subject.percentage, total: 100)
                        .progressViewStyle(LinearProgressViewStyle(tint: statusColor))
                        .frame(width: 160)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(String(format: "%.0f%%", subject.percentage))
                        .font(.title2).bold().foregroundColor(statusColor)
                    Text("\(subject.attended)/\(subject.total) classes")
                        .font(.caption).foregroundColor(.secondary)
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
