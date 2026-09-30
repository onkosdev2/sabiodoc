"""Reportes y moderación de reseñas."""

import uuid

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.consultation_review import ConsultationReview
from app.models.review_report import ReviewReport
from app.models.user import User

client = TestClient(app)

PATIENT_EMAIL = "paciente.demo@sabiodoc.app"
PATIENT_PASSWORD = "PatientDemo123!"
ADMIN_EMAIL = "admin.demo@sabiodoc.app"
ADMIN_PASSWORD = "AdminDemo123!"


def _login(email: str, password: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _any_review() -> tuple[int, int]:
    db = SessionLocal()
    try:
        review = db.query(ConsultationReview).first()
        assert review is not None, "el seed debería tener reseñas"
        return review.id, review.doctor_id
    finally:
        db.close()


def test_reportar_y_moderar_resena():
    review_id, doctor_id = _any_review()
    reviewer_email = f"reporter_{uuid.uuid4().hex[:8]}@example.com"
    registered = client.post(
        "/auth/register", json={"email": reviewer_email, "password": "Report123!"}
    )
    assert registered.status_code == 201, registered.text
    reviewer_user_id = registered.json()["user"]["id"]
    reviewer = _headers(registered.json()["access_token"])
    admin = _headers(_login(ADMIN_EMAIL, ADMIN_PASSWORD))
    created_report_id: int | None = None

    try:
        # Un paciente reporta una reseña ajena.
        response = client.post(
            f"/reviews/{review_id}/report",
            json={"reason": "Contenido ofensivo (prueba)"},
            headers=reviewer,
        )
        assert response.status_code == 201, response.text
        created_report_id = response.json()["id"]
        assert response.json()["status"] == "pending"

        # No se puede reportar dos veces la misma reseña.
        assert (
            client.post(f"/reviews/{review_id}/report", json={}, headers=reviewer).status_code
            == 400
        )

        # El autor de la reseña no puede reportar la suya.
        author = _headers(_login(PATIENT_EMAIL, PATIENT_PASSWORD))
        db = SessionLocal()
        try:
            author_user = db.query(User).filter(User.email == PATIENT_EMAIL).first()
            owned_review = (
                db.query(ConsultationReview)
                .filter(ConsultationReview.patient_id == author_user.id)
                .first()
            )
            assert owned_review is not None
            owned_review_id = owned_review.id
        finally:
            db.close()
        assert (
            client.post(
                f"/reviews/{owned_review_id}/report", json={}, headers=author
            ).status_code
            == 400
        )

        # Un usuario normal no puede ver el panel de moderación.
        assert client.get("/admin/review-reports", headers=reviewer).status_code in (401, 403)

        # El admin ve el reporte pendiente.
        listing = client.get(
            "/admin/review-reports", params={"report_status": "pending"}, headers=admin
        )
        assert listing.status_code == 200, listing.text
        assert any(item["id"] == created_report_id for item in listing.json()["reports"])

        # Ocultar la reseña la quita del perfil público y resuelve el reporte.
        hide = client.post(
            f"/admin/reviews/{review_id}/hide",
            json={"reason": "Moderación de prueba"},
            headers=admin,
        )
        assert hide.status_code == 200, hide.text
        assert hide.json()["is_hidden"] is True

        detail = client.get(f"/doctors/{doctor_id}")
        assert detail.status_code == 200
        assert review_id not in [item["id"] for item in detail.json()["reviews"]]

        resolved = client.get(
            "/admin/review-reports", params={"report_status": "resolved"}, headers=admin
        )
        assert any(item["id"] == created_report_id for item in resolved.json()["reports"])

        # Restaurar la reseña la vuelve a mostrar.
        unhide = client.post(f"/admin/reviews/{review_id}/unhide", headers=admin)
        assert unhide.status_code == 200, unhide.text
        assert unhide.json()["is_hidden"] is False
        detail = client.get(f"/doctors/{doctor_id}")
        assert review_id in [item["id"] for item in detail.json()["reviews"]]
    finally:
        # Limpia lo creado por el test.
        db = SessionLocal()
        try:
            if created_report_id is not None:
                db.query(ReviewReport).filter(ReviewReport.id == created_report_id).delete()
            db.query(User).filter(User.id == reviewer_user_id).delete()
            db.commit()
        finally:
            db.close()
