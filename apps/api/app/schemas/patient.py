from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.patient_profile import PatientSex


class PatientProfileUpsert(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=120)
    last_name: Optional[str] = Field(default=None, max_length=120)
    date_of_birth: Optional[date] = None
    sex: Optional[PatientSex] = None
    phone: Optional[str] = Field(default=None, max_length=40)
    country: Optional[str] = Field(default=None, max_length=120)
    city: Optional[str] = Field(default=None, max_length=120)
    timezone: Optional[str] = Field(default=None, max_length=120)
    blood_type: Optional[str] = Field(default=None, max_length=10)
    allergies: Optional[str] = Field(default=None, max_length=2000)
    chronic_conditions: Optional[str] = Field(default=None, max_length=2000)
    current_medications: Optional[str] = Field(default=None, max_length=2000)
    family_history: Optional[str] = Field(default=None, max_length=2000)
    height_cm: Optional[int] = Field(default=None, ge=30, le=260)
    weight_kg: Optional[int] = Field(default=None, ge=2, le=500)
    smoker: Optional[bool] = None
    alcohol: Optional[bool] = None
    emergency_contact_name: Optional[str] = Field(default=None, max_length=160)
    emergency_contact_phone: Optional[str] = Field(default=None, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=2000)


class PatientProfileResponse(PatientProfileUpsert):
    id: Optional[int] = None
    user_id: int
    email: str
    full_name: Optional[str] = None
    age: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
