from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from dto.device_dto import DeviceCreate, DeviceResponse, DeviceUpdate
from config.database import get_db
from business.device_service import DeviceService
from typing import List

router = APIRouter(
    prefix="/devices",
    tags=["devices"]
)

@router.post("/", response_model=DeviceResponse)
def create_device(device: DeviceCreate, db: Session = Depends(get_db)):
    service = DeviceService(db)
    return service.create_device(device)

@router.get("/", response_model=List[DeviceResponse])
def read_devices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = DeviceService(db)
    return service.get_all_devices(skip, limit)

@router.get("/{device_id}", response_model=DeviceResponse)
def read_device(device_id: str, db: Session = Depends(get_db)):
    service = DeviceService(db)
    db_device = service.get_device(device_id)
    if db_device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return db_device

@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(device_id: str, device: DeviceUpdate, db: Session = Depends(get_db)):
    service = DeviceService(db)
    updated_device = service.update_device(device_id, device)
    if updated_device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return updated_device

@router.delete("/{device_id}")
def delete_device(device_id: str, db: Session = Depends(get_db)):
    service = DeviceService(db)
    deleted_device = service.delete_device(device_id)
    if deleted_device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"message": "Device deleted successfully"}
