import SwiftUI

// MARK: - Models

struct ScheduledClass: Identifiable {
    let id = UUID()
    let name: String
    let code: String
    let room: String
    let timing: String
    let days: [String]        // e.g. ["Mon", "Wed", "Fri"]
    let bannerColor: Color
}

struct AttendanceSchedule: Identifiable {
    let id = UUID()
    var label: String        // e.g. "15 min after start"
    var time: String         // e.g. "10:15 AM"
    var mode: ProfMode
    var isEnabled: Bool
}

enum ProfMode: String {
    case qr = "QR Code"
    case ble = "BLE"
    case manual = "Manual"
    var icon: String {
        switch self {
        case .qr:     return "qrcode.viewfinder"
        case .ble:    return "antenna.radiowaves.left.and.right"
        case .manual: return "list.clipboard.fill"
        }
    }
    var color: Color {
        switch self {
        case .qr:     return Color(red: 0.102, green: 0.451, blue: 0.910)
        case .ble:    return Color(red: 0.416, green: 0.353, blue: 0.804)
        case .manual: return Color(red: 0.984, green: 0.467, blue: 0.094)
        }
    }
}

// MARK: - Professor Schedule List

struct ProfessorScheduleView: View {
    let classes: [ScheduledClass] = [
        ScheduledClass(name: "Swift App Dev",    code: "CS5.401", room: "Room 304", timing: "10:00 – 11:00 AM", days: ["Mon", "Wed", "Fri"], bannerColor: Color(red: 0.102, green: 0.451, blue: 0.910)),
        ScheduledClass(name: "Machine Learning", code: "CS5.301", room: "Room 101", timing: "11:30 – 12:30 PM", days: ["Tue", "Thu"],         bannerColor: Color(red: 0.204, green: 0.659, blue: 0.325)),
        ScheduledClass(name: "Backend Dev",      code: "CS5.501", room: "Room 202", timing: "02:00 – 03:00 PM", days: ["Mon", "Thu"],         bannerColor: Color(red: 0.984, green: 0.467, blue: 0.094)),
    ]

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    ForEach(classes) { cls in
                        NavigationLink(destination: ClassDetailView(cls: cls)) {
                            ScheduleCard(cls: cls)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
                .padding(.vertical)
            }
            .background(Color.gray.opacity(0.1))
            .navigationTitle("My Schedule")
        }
    }
}

struct ScheduleCard: View {
    let cls: ScheduledClass
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                cls.bannerColor.frame(height: 56)
                Text(cls.name)
                    .font(.headline).bold().foregroundColor(.white)
                    .padding([.leading, .bottom], 12)
            }
            .clipShape(CornerShape(radius: 15, corners: [.topLeft, .topRight]))

            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(cls.code).font(.caption).foregroundColor(.secondary)
                    Label(cls.timing, systemImage: "clock").font(.caption).foregroundColor(.secondary)
                    // Days chips
                    HStack(spacing: 4) {
                        ForEach(cls.days, id: \.self) { day in
                            Text(day)
                                .font(.system(size: 10, weight: .semibold))
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(cls.bannerColor.opacity(0.15))
                                .foregroundColor(cls.bannerColor)
                                .cornerRadius(4)
                        }
                    }
                }
                Spacer()
                Label(cls.room, systemImage: "mappin").font(.caption).foregroundColor(.secondary)
            }
            .padding(14)
            .background(Color.white)
            .clipShape(CornerShape(radius: 15, corners: [.bottomLeft, .bottomRight]))
        }
        .shadow(color: Color.black.opacity(0.08), radius: 5, x: 0, y: 2)
        .padding(.horizontal)
    }
}

// MARK: - Class Detail (Start Session + Schedules)

struct ClassDetailView: View {
    let cls: ScheduledClass
    @State private var schedules: [AttendanceSchedule] = [
        AttendanceSchedule(label: "15 min after start", time: "10:15 AM", mode: .qr,  isEnabled: true),
        AttendanceSchedule(label: "15 min before end",  time: "10:45 AM", mode: .ble, isEnabled: false),
    ]
    @State private var showAddSchedule = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Class info card
                VStack(alignment: .leading, spacing: 0) {
                    ZStack(alignment: .bottomLeading) {
                        cls.bannerColor.frame(height: 56)
                        Text(cls.name)
                            .font(.headline).bold().foregroundColor(.white)
                            .padding([.leading, .bottom], 12)
                    }
                    .clipShape(CornerShape(radius: 15, corners: [.topLeft, .topRight]))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(cls.code)  •  \(cls.room)").font(.subheadline).foregroundColor(.secondary)
                        Label(cls.timing, systemImage: "clock").font(.caption).foregroundColor(.secondary)
                    }
                    .padding(14)
                    .background(Color.white)
                    .clipShape(CornerShape(radius: 15, corners: [.bottomLeft, .bottomRight]))
                }
                .shadow(color: Color.black.opacity(0.08), radius: 5, x: 0, y: 2)
                .padding(.horizontal)

                // Start Session
                VStack(alignment: .leading, spacing: 10) {
                    Text("Start Attendance Now")
                        .font(.headline).padding(.horizontal)
                    HStack(spacing: 10) {
                        ForEach([ProfMode.qr, .ble, .manual], id: \.self) { mode in
                            NavigationLink(destination: destinationView(for: mode)) {
                                VStack(spacing: 6) {
                                    Image(systemName: mode.icon).font(.system(size: 22))
                                    Text(mode.rawValue).font(.caption).fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity).padding(.vertical, 12)
                                .background(mode.color.opacity(0.12))
                                .foregroundColor(mode.color)
                                .cornerRadius(12)
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // Scheduled Attendances
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Scheduled Attendances")
                            .font(.headline)
                        Spacer()
                        Button(action: { showAddSchedule = true }) {
                            Image(systemName: "plus.circle.fill")
                                .font(.title3)
                                .foregroundColor(Color(red: 0.102, green: 0.451, blue: 0.910))
                        }
                    }
                    .padding(.horizontal)

                    // Fixed-height scrollable schedule list showing ~3 items
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach($schedules) { $schedule in
                                ScheduleRow(schedule: $schedule)
                                Divider().padding(.horizontal)
                            }
                        }
                        .background(Color.white)
                        .cornerRadius(15)
                        .shadow(color: Color.black.opacity(0.08), radius: 5, x: 0, y: 2)
                    }
                    .frame(height: CGFloat(min(schedules.count, 3)) * 72)
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Color.gray.opacity(0.1))
        .navigationTitle(cls.name)
        .sheet(isPresented: $showAddSchedule) {
            AddScheduleSheet { newSchedule in
                schedules.append(newSchedule)
            }
        }
    }

    @ViewBuilder
    func destinationView(for mode: ProfMode) -> some View {
        switch mode {
        case .qr:     ProfQRSessionView(cls: cls)
        case .ble:    ProfBLESessionView(cls: cls)
        case .manual: ProfManualSessionView(cls: cls)
        }
    }
}

struct ScheduleRow: View {
    @Binding var schedule: AttendanceSchedule
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "alarm.fill")
                .foregroundColor(schedule.mode.color)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(schedule.label).font(.subheadline).fontWeight(.medium)
                HStack(spacing: 6) {
                    Text(schedule.time).font(.caption).foregroundColor(.secondary)
                    Text("•").foregroundColor(.secondary)
                    Text(schedule.mode.rawValue).font(.caption).foregroundColor(schedule.mode.color)
                }
            }
            Spacer()
            Toggle("", isOn: $schedule.isEnabled)
                .labelsHidden()
                .tint(Color(red: 0.102, green: 0.451, blue: 0.910))
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
    }
}

// MARK: - Add Schedule Sheet

struct AddScheduleSheet: View {
    var onAdd: (AttendanceSchedule) -> Void
    @Environment(\.dismiss) var dismiss
    @State private var label = ""
    @State private var time = Date()
    @State private var mode: ProfMode = .qr

    var body: some View {
        NavigationView {
            Form {
                Section("Label") {
                    TextField("e.g. 15 min after start", text: $label)
                }
                Section("Time") {
                    DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                        .labelsHidden()
                }
                Section("Mode") {
                    Picker("Mode", selection: $mode) {
                        Text("QR Code").tag(ProfMode.qr)
                        Text("BLE").tag(ProfMode.ble)
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Add Schedule")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let formatter = DateFormatter()
                        formatter.timeStyle = .short
                        onAdd(AttendanceSchedule(label: label.isEmpty ? "Scheduled" : label,
                                                 time: formatter.string(from: time),
                                                 mode: mode, isEnabled: true))
                        dismiss()
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

// MARK: - QR Session View

struct ProfQRSessionView: View {
    let cls: ScheduledClass
    @State private var timeLeft = 120
    @State private var qrImage = "qrcode"   // TODO: replace with fetched QR from backend
    @State private var timer: Timer? = nil
    @State private var qrRefreshTimer: Timer? = nil

    var body: some View {
        VStack(spacing: 24) {
            // Timer ring
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.2), lineWidth: 8)
                    .frame(width: 100, height: 100)
                Circle()
                    .trim(from: 0, to: CGFloat(timeLeft) / 120)
                    .stroke(Color(red: 0.102, green: 0.451, blue: 0.910), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 100, height: 100)
                    .animation(.linear(duration: 1), value: timeLeft)
                Text(timeString).font(.title2).bold()
            }
            .padding(.top, 32)

            Text("QR refreshes every 3–5 seconds")
                .font(.caption).foregroundColor(.secondary)

            // QR placeholder (swap Image(systemName:) with actual QR image from backend)
            Image(systemName: qrImage)
                .resizable().scaledToFit()
                .frame(width: 200, height: 200)
                .padding(16)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.08), radius: 6, x: 0, y: 2)

            Text("Display this to students")
                .font(.subheadline).foregroundColor(.secondary)

            Spacer()
        }
        .navigationTitle("QR Attendance")
        .background(Color.gray.opacity(0.07).ignoresSafeArea())
        .onAppear { startTimers() }
        .onDisappear { stopTimers() }
    }

    private var timeString: String {
        String(format: "%d:%02d", timeLeft / 60, timeLeft % 60)
    }

    private func startTimers() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if timeLeft > 0 { timeLeft -= 1 } else { stopTimers() }
        }
        qrRefreshTimer = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { _ in
            // TODO: fetch new QR from backend here
            qrImage = qrImage == "qrcode" ? "qrcode.viewfinder" : "qrcode"
        }
    }

    private func stopTimers() {
        timer?.invalidate(); qrRefreshTimer?.invalidate()
    }
}

// MARK: - BLE Session View

struct ProfBLESessionView: View {
    let cls: ScheduledClass
    @State private var timeLeft = 120
    @State private var timer: Timer? = nil

    var body: some View {
        VStack(spacing: 24) {
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.2), lineWidth: 8)
                    .frame(width: 100, height: 100)
                Circle()
                    .trim(from: 0, to: CGFloat(timeLeft) / 120)
                    .stroke(Color(red: 0.416, green: 0.353, blue: 0.804), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 100, height: 100)
                    .animation(.linear(duration: 1), value: timeLeft)
                Text(timeString).font(.title2).bold()
            }
            .padding(.top, 32)

            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.system(size: 80))
                .foregroundColor(Color(red: 0.416, green: 0.353, blue: 0.804))
                .symbolEffect(.pulse)

            Text("BLE beacon is active\nStudents will be detected automatically")
                .font(.subheadline).foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Spacer()
        }
        .navigationTitle("BLE Attendance")
        .background(Color.gray.opacity(0.07).ignoresSafeArea())
        .onAppear {
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                if timeLeft > 0 { timeLeft -= 1 } else { timer?.invalidate() }
            }
        }
        .onDisappear { timer?.invalidate() }
    }

    private var timeString: String {
        String(format: "%d:%02d", timeLeft / 60, timeLeft % 60)
    }
}

// MARK: - Manual Session View

struct ProfManualSessionView: View {
    let cls: ScheduledClass
    // TODO: fetch from backend
    @State private var students: [(name: String, roll: String, present: Bool)] = [
        ("Sreehith Sanam",  "CS22BTECH11050", false),
        ("Arjun Reddy",     "CS22BTECH11023", false),
        ("Priya Sharma",    "CS22BTECH11031", false),
        ("Kiran Kumar",     "CS22BTECH11044", false),
        ("Ananya Singh",    "CS22BTECH11012", false),
        ("Rahul Verma",     "CS22BTECH11067", false),
    ]

    private let gBlue = Color(red: 0.102, green: 0.451, blue: 0.910)

    var body: some View {
        VStack(spacing: 0) {
            // Summary bar
            HStack {
                Text("\(students.filter { $0.present }.count) / \(students.count) present")
                    .font(.subheadline).bold()
                Spacer()
                Button("Mark All") {
                    for i in students.indices { students[i].present = true }
                }
                .font(.subheadline).foregroundColor(gBlue)
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(Color.white)
            .shadow(color: Color.black.opacity(0.05), radius: 3, x: 0, y: 1)

            List {
                ForEach(students.indices, id: \.self) { i in
                    HStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(students[i].name).font(.subheadline).fontWeight(.medium)
                            Text(students[i].roll).font(.caption).foregroundColor(.secondary)
                        }
                        Spacer()
                        Button(action: { students[i].present.toggle() }) {
                            Image(systemName: students[i].present ? "checkmark.circle.fill" : "circle")
                                .font(.title2)
                                .foregroundColor(students[i].present ? Color(red: 0.204, green: 0.659, blue: 0.325) : .gray)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    .padding(.vertical, 4)
                }
            }
            .listStyle(.plain)

            Button(action: { /* TODO: POST attendance to backend */ }) {
                Text("Submit Attendance")
                    .font(.headline).foregroundColor(.white)
                    .frame(maxWidth: .infinity).padding()
                    .background(gBlue).cornerRadius(10)
            }
            .padding(16)
            .background(Color.white)
        }
        .navigationTitle("Manual Attendance")
        .background(Color.gray.opacity(0.07).ignoresSafeArea())
    }
}

// MARK: - Professor Session Tab (quick-start without picking a class)
struct ProfessorSessionView: View {
    // Today's classes — TODO: filter from backend by current day
    let todayClasses: [ScheduledClass] = [
        ScheduledClass(name: "Swift App Dev",    code: "CS5.401", room: "Room 304", timing: "10:00 – 11:00 AM", days: ["Mon", "Wed", "Fri"], bannerColor: Color(red: 0.102, green: 0.451, blue: 0.910)),
        ScheduledClass(name: "Backend Dev",      code: "CS5.501", room: "Room 202", timing: "02:00 – 03:00 PM", days: ["Mon", "Thu"],         bannerColor: Color(red: 0.984, green: 0.467, blue: 0.094)),
    ]

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Today's Classes")
                        .font(.subheadline).foregroundColor(.secondary)
                        .padding(.horizontal)

                    ForEach(todayClasses) { cls in
                        NavigationLink(destination: ClassDetailView(cls: cls)) {
                            ScheduleCard(cls: cls)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
                .padding(.vertical)
            }
            .background(Color.gray.opacity(0.1))
            .navigationTitle("Session")
        }
    }
}

// MARK: - Professor Analytics

struct StudentRecord: Identifiable {
    let id = UUID()
    let name: String
    let roll: String
    let attended: Int
    let total: Int
    var percentage: Double { total > 0 ? Double(attended) / Double(total) * 100 : 0 }
}

struct CourseAnalytics: Identifiable {
    let id = UUID()
    let cls: ScheduledClass
    let students: [StudentRecord]
    var overallPercentage: Double {
        guard !students.isEmpty else { return 0 }
        return students.reduce(0) { $0 + $1.percentage } / Double(students.count)
    }
}

struct ProfessorAnalyticsView: View {
    // TODO: fetch from backend
    let courses: [CourseAnalytics] = [
        CourseAnalytics(cls: ScheduledClass(name: "Swift App Dev", code: "CS5.401", room: "Room 304", timing: "10:00 – 11:00 AM", days: ["Mon","Wed","Fri"], bannerColor: Color(red: 0.102, green: 0.451, blue: 0.910)),
            students: [
                StudentRecord(name: "Sreehith Sanam", roll: "CS22BTECH11050", attended: 9,  total: 10),
                StudentRecord(name: "Arjun Reddy",    roll: "CS22BTECH11023", attended: 7,  total: 10),
                StudentRecord(name: "Priya Sharma",   roll: "CS22BTECH11031", attended: 10, total: 10),
                StudentRecord(name: "Kiran Kumar",    roll: "CS22BTECH11044", attended: 6,  total: 10),
            ]),
        CourseAnalytics(cls: ScheduledClass(name: "Machine Learning", code: "CS5.301", room: "Room 101", timing: "11:30 – 12:30 PM", days: ["Tue","Thu"], bannerColor: Color(red: 0.204, green: 0.659, blue: 0.325)),
            students: [
                StudentRecord(name: "Sreehith Sanam", roll: "CS22BTECH11050", attended: 18, total: 20),
                StudentRecord(name: "Arjun Reddy",    roll: "CS22BTECH11023", attended: 14, total: 20),
                StudentRecord(name: "Priya Sharma",   roll: "CS22BTECH11031", attended: 20, total: 20),
            ]),
    ]

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    ForEach(courses) { course in
                        NavigationLink(destination: CourseAnalyticsDetailView(course: course)) {
                            CourseAnalyticsCard(course: course)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
                .padding(.vertical)
            }
            .background(Color.gray.opacity(0.1))
            .navigationTitle("Analytics")
        }
    }
}

struct CourseAnalyticsCard: View {
    let course: CourseAnalytics
    private var pct: Double { course.overallPercentage }
    private var statusColor: Color { pct >= 75 ? Color(red: 0.204, green: 0.659, blue: 0.325) : pct >= 60 ? Color(red: 0.984, green: 0.467, blue: 0.094) : .red }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                course.cls.bannerColor.frame(height: 56)
                Text(course.cls.name)
                    .font(.headline).bold().foregroundColor(.white)
                    .padding([.leading, .bottom], 12)
            }
            .clipShape(CornerShape(radius: 15, corners: [.topLeft, .topRight]))

            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(course.cls.code).font(.caption).foregroundColor(.secondary)
                    Text("\(course.students.count) students").font(.caption).foregroundColor(.secondary)
                    ProgressView(value: pct, total: 100)
                        .progressViewStyle(LinearProgressViewStyle(tint: statusColor))
                        .frame(width: 160)
                }
                Spacer()
                Text(String(format: "%.0f%%", pct))
                    .font(.title2).bold().foregroundColor(statusColor)
            }
            .padding(14)
            .background(Color.white)
            .clipShape(CornerShape(radius: 15, corners: [.bottomLeft, .bottomRight]))
        }
        .shadow(color: Color.black.opacity(0.08), radius: 5, x: 0, y: 2)
        .padding(.horizontal)
    }
}

struct CourseAnalyticsDetailView: View {
    let course: CourseAnalytics

    var body: some View {
        List {
            ForEach(course.students) { student in
                let pct = student.percentage
                let color: Color = pct >= 75 ? Color(red: 0.204, green: 0.659, blue: 0.325) : pct >= 60 ? Color(red: 0.984, green: 0.467, blue: 0.094) : .red
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(student.name).font(.subheadline).fontWeight(.medium)
                        Text(student.roll).font(.caption).foregroundColor(.secondary)
                        ProgressView(value: pct, total: 100)
                            .progressViewStyle(LinearProgressViewStyle(tint: color))
                            .frame(width: 140)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(String(format: "%.0f%%", pct)).font(.title3).bold().foregroundColor(color)
                        Text("\(student.attended)/\(student.total)").font(.caption).foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .listStyle(.plain)
        .navigationTitle(course.cls.name)
    }
}
