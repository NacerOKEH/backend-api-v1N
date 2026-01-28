from sqlalchemy import Column, String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from config.database import Base
import uuid

class DeviceStatus(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    ERROR = "ERROR"
    MAINTENANCE = "MAINTENANCE"

class Device(Base):
    __tablename__ = "devices"

    device_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    type = Column(String, nullable=True) # e.g. "SENSOR", "ACTUATOR"
    status = Column(Enum(DeviceStatus), default=DeviceStatus.OFFLINE)
    ip_address = Column(String, nullable=True)
    mac_address = Column(String, nullable=True)
    firmware_version = Column(String, nullable=True)
    
    # Location fields (simplified for now, could be a separate table/relation)
    latitude = Column(String, nullable=True)
    longitude = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, nullable=True)

    # owner_id = Column(String, ForeignKey("users.id")) # If we have users service

    def __repr__(self):
        return f"<Device(id={self.device_id}, name={self.name}, status={self.status})>"
