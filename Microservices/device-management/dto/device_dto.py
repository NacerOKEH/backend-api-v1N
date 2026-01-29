from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

class DeviceStatus(str, Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    ERROR = "ERROR"
    MAINTENANCE = "MAINTENANCE"

class DeviceBase(BaseModel):
    name: str
    type: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    firmware_version: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[DeviceStatus] = None
    ip_address: Optional[str] = None
    firmware_version: Optional[str] = None
    city: Optional[str] = None
    last_seen: Optional[datetime] = None

class DeviceResponse(DeviceBase):
    device_id: str
    status: DeviceStatus
    created_at: datetime
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True
