import os
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@db:5432/attendance"
)

Base = declarative_base()

# Retry logic (VERY important for Docker)
for i in range(10):
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(bind=engine)
        print("DB connected")
        break
    except Exception as e:
        print("DB not ready, retrying...")
        time.sleep(2)