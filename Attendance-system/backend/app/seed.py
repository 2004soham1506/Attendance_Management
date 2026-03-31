from .database import SessionLocal
from .models import User, Course, Classroom, Beacon, Classroom2Beacon, Session, Attendance, Enrollment
from datetime import datetime, timedelta, timezone
import random

db = SessionLocal()

# # ─────────────────────────────────────────────
# # USERS
# # ─────────────────────────────────────────────

students = []
for i in range(1, 51):
    students.append(User(
        name=f"Student {i}",
        email=f"student{i}@test.com",
        role="student",
        password="password123"
    ))

profs = [
    User(name="Prof A", email="profA@test.com", role="prof", password="password123"),
    User(name="Prof B", email="profB@test.com", role="prof", password="password123"),
    User(name="Prof C", email="profC@test.com", role="prof", password="password123"),
]

admin = User(name="Admin", email="admin@test.com", role="admin", password="password123")

db.add_all(students + profs + [admin])
db.commit()

# # ─────────────────────────────────────────────
# # CLASSROOMS
# # ─────────────────────────────────────────────

rooms = [
    Classroom(name="Room 101"),
    Classroom(name="Room 102"),
    Classroom(name="Room 103"),
]

db.add_all(rooms)
db.commit()

# # ─────────────────────────────────────────────
# # BEACONS + MAPPING
# # ─────────────────────────────────────────────

beacons = [
    Beacon(uuid="uuid-1", major=1001),
    Beacon(uuid="uuid-2", major=1002),
    Beacon(uuid="uuid-3", major=1003),
]

db.add_all(beacons)
db.commit()

for i in range(3):
    db.add(Classroom2Beacon(
        classroom_id=rooms[i].id,
        major=beacons[i].major
    ))

db.commit()

# # ─────────────────────────────────────────────
# # COURSES (2 per prof)
# # ─────────────────────────────────────────────

courses = [
    Course(name="CN", professor_id=profs[0].id, default_classroom_id=rooms[0].id),
    Course(name="OS", professor_id=profs[0].id, default_classroom_id=rooms[1].id),

    Course(name="ML", professor_id=profs[1].id, default_classroom_id=rooms[1].id),
    Course(name="DL", professor_id=profs[1].id, default_classroom_id=rooms[2].id),

    Course(name="DBMS", professor_id=profs[2].id, default_classroom_id=rooms[0].id),
    Course(name="RL", professor_id=profs[2].id, default_classroom_id=rooms[2].id),
]

db.add_all(courses)
db.commit()

# # ─────────────────────────────────────────────
# # ENROLLMENTS (IMPORTANT)
# # ─────────────────────────────────────────────

for course in courses:
    enrolled = random.sample(students, random.randint(20, 35))
    for s in enrolled:
        # Check for duplicates before adding
        exists = db.query(Enrollment).filter_by(course_id=course.id, student_id=s.id).first()
        if not exists:
            db.add(Enrollment(course_id=course.id, student_id=s.id))

db.commit()

# # ─────────────────────────────────────────────
# # SESSIONS + ATTENDANCE
# # ─────────────────────────────────────────────

now = datetime.now(timezone.utc)

for course in courses:
    enrolled_students = db.query(Enrollment).filter(
        Enrollment.course_id == course.id
    ).all()

    student_ids = [e.student_id for e in enrolled_students]

    # create 10 sessions per course
    for i in range(10):
        session_time = now - timedelta(days=10 - i)

        session = Session(
            course_id=course.id,
            classroom_id=course.default_classroom_id,
            major=random.choice(beacons).major,
            start_time=session_time,
            end_time=session_time + timedelta(hours=1),
            is_active=False,
            mode=random.choice(["ble", "qr", "hybrid"])
        )

        db.add(session)
        db.commit()

        # attendance distribution
        for sid in student_ids:
            # probability depends on "type" of student
            r = random.random()

            if r < 0.2:
                prob = 0.9   # high attendance
            elif r < 0.6:
                prob = 0.6   # medium
            else:
                prob = 0.3   # low

            if random.random() < prob:
                db.add(Attendance(
                    session_id=session.id,
                    student_id=sid,
                    timestamp=session_time + timedelta(minutes=random.randint(0, 30))
                ))

        db.commit()

# # ─────────────────────────────────────────────
# # DEBUG STATS PRINT (VERY IMPORTANT)
# # ─────────────────────────────────────────────

print("\n📊 DEBUG STATS\n")

for course in courses:
    sessions = db.query(Session).filter(Session.course_id == course.id).count()
    attendance = db.query(Attendance).filter(
    Attendance.session_id.in_(
        db.query(Session.id).filter(Session.course_id == course.id)
    )).count()

    print(f"{course.name}: sessions={sessions}, attendance={attendance}, avg={round(attendance/sessions,2) if sessions else 0}")

print("\n✅ Seed complete\n")