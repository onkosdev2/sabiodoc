"""Detección de perfiles de prueba publicados."""

from app.services.seed_guard import is_seed_identity


def test_detecta_por_marca_is_seed():
    assert is_seed_identity("Dra. Valeria Ríos", "valeria@clinica.pe", is_seed=True) is True


def test_detecta_por_nombre():
    assert is_seed_identity("Dr. Test", "doctor@clinica.pe") is True
    assert is_seed_identity("Dra. Demo", "doctor@clinica.pe") is True


def test_detecta_por_correo_demo():
    assert is_seed_identity("Dra. Valeria Ríos", "cardio.demo@sabiodoc.app") is True
    assert is_seed_identity("Dr. Mateo Sosa", "derma.demo@sabiodoc.app") is True
    assert is_seed_identity("QA Bot", "qa@example.com") is True


def test_no_marca_medicos_reales():
    assert is_seed_identity("Dra. Valeria Ríos", "valeria@clinica.pe") is False
    assert is_seed_identity("Dr. Mateo Sosa", "mateo@sabiodoc.app") is False
