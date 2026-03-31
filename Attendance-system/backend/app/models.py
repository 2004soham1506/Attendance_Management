from sqlalchemy import Column, Integer, DateTime, Boolean, String, UniqueConstraint, ForeignKey
from .database import Base

class BeaconLog(Base):
    __tablename__ = "beacon_logs"

    id = Column(Integer, primary_key=True)
    major = Column(Integer)
    minor = Column(Integer)
    timestamp = Column(DateTime)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer)
    classroom_id = Column(Integer)
    major = Column(Integer)
    start_time = Column(DateTime)
    end_time = Column(DateTime, nullable=True)
    is_active = Column(Boolean)
    mode = Column(String)


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer)
    student_id = Column(Integer)
    timestamp = Column(DateTime)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    email = Column(String)
    role = Column(String)  # "prof" or "admin" or "student"
    password = Column(String)

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    professor_id = Column(Integer, ForeignKey("users.id"))
    default_classroom_id = Column(Integer)

class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer)
    student_id = Column(Integer)  # FK to User.id

    __table_args__ = (
        UniqueConstraint('course_id', 'student_id', name='unique_course_student'),
    )

class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True)
    name = Column(String)

class Classroom2Beacon(Base):
    __tablename__ = "classroom2beacon"

    id = Column(Integer, primary_key=True)
    classroom_id = Column(Integer)
    major = Column(Integer)

class Beacon(Base):
    __tablename__ = "beacons"

    id = Column(Integer, primary_key=True)
    uuid = Column(String)
    major = Column(Integer)

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    professor_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
