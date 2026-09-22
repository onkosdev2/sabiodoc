"""Validacion de franjas de disponibilidad medica (rangos y solapamientos)."""

from datetime import time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.appointment import DoctorAvailabilitySlotInput
from app.services.appointment_service import appointment_service


def _slot(weekday: int, start: str, end: str, is_active: bool = True) -> DoctorAvailabilitySlotInput:
    return DoctorAvailabilitySlotInput(
        weekday=weekday,
        start_time=time.fromisoformat(start),
        end_time=time.fromisoformat(end),
        is_active=is_active,
    )


def test_validate_slots_accepts_non_overlapping():
    appointment_service.validate_slots(
        [_slot(0, "09:00", "12:00"), _slot(0, "14:00", "18:00")]
    )


def test_validate_slots_accepts_touching_ranges():
    appointment_service.validate_slots(
        [_slot(0, "09:00", "12:00"), _slot(0, "12:00", "14:00")]
    )


def test_validate_slots_rejects_overlap_same_day():
    with pytest.raises(HTTPException) as exc:
        appointment_service.validate_slots(
            [_slot(0, "09:00", "12:00"), _slot(0, "11:00", "15:00")]
        )
    assert exc.value.status_code == 400


def test_validate_slots_ignores_inactive_overlap():
    appointment_service.validate_slots(
        [_slot(0, "09:00", "12:00"), _slot(0, "11:00", "15:00", is_active=False)]
    )


def test_validate_slots_allows_same_range_on_different_days():
    appointment_service.validate_slots(
        [_slot(0, "09:00", "12:00"), _slot(1, "09:00", "12:00")]
    )


def test_validate_slots_rejects_invalid_range():
    with pytest.raises(HTTPException):
        appointment_service.validate_slots([_slot(0, "12:00", "09:00")])


def test_validate_slots_rejects_invalid_weekday():
    # El schema ya lo impide, pero mantenemos la defensa a nivel de servicio.
    invalid = SimpleNamespace(weekday=7, start_time=time(9, 0), end_time=time(12, 0), is_active=True)
    with pytest.raises(HTTPException):
        appointment_service.validate_slots([invalid])
