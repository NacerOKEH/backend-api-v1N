from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Use Environment variables for DB connection
USER_DB = os.getenv("POSTGRES_USER", "admin")
PASSWORD_DB = os.getenv("POSTGRES_PASSWORD", "1234")
SERVER_DB = os.getenv("SERVER_DB", "localhost")
NAME_DB = os.getenv("NAME_DB", "device_db")

SQLALCHEMY_DATABASE_URL = f"postgresql://{USER_DB}:{PASSWORD_DB}@{SERVER_DB}:5432/{NAME_DB}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
