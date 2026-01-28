from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "monitoring_db")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
collection = db["device_events"]

def get_db():
    return db
