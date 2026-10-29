import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import decode_access_token
from app.core.config import settings
from app.core.logging import get_logger
from app.models.appointment import AppointmentStatus
from app.models.consultation import ConsultationStatus
from app.models.user import User
from app.models.video_session import PaymentStatus, VideoSession, VideoSessionStatus
from app.models.payment import ConsultationCharge, PaymentTransaction, PaymentTransactionStatus, PaymentTransactionType
from app.models.video_session_event import VideoSessionEvent
from app.schemas.video_session import (
    JitsiEventRequest,
    VideoSessionCompleteRequest,
    VideoSessionDoctorNoteRequest,
    VideoSessionExtendRequest,
    VideoSessionFileResponse,
    VideoSessionStatusResponse,
)
from app.services import session_file_service
from app.services.audit_service import audit_service
from app.services.notification_service import notification_service
from app.services.patient_profile_service import get_patient_display_name
from app.services.video_session_service import video_session_service
from app.services.payments.charge_service import ChargeError, charge_service

router = APIRouter(prefix="/video-sessions", tags=["video-sessions"])
logger = get_logger(__name__)


def _resolve_participant_role(video_session: VideoSession, current_user: User) -> str:
    if video_session.patient_id == current_user.id:
        return "patient"
    if video_session.doctor and video_session.doctor.user_id == current_user.id:
        return "doctor"
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes acceder a esta videoconsulta")


def _resolve_user_from_token(db: Session, token: str) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    if int(payload.get("ver", 1)) != int(user.session_version or 1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida")
    return user


def _sync_doctor_presence_from_video_sessions(db: Session, doctor_id: int) -> None:
    video_session_service.sync_doctor_presence(db, doctor_id)


def _expire_if_needed(db: Session, video_session: VideoSession) -> None:
    if video_session_service.expire_session_if_stale(db, video_session):
        video_session_service.sync_doctor_presence(db, video_session.doctor_id)


def _heartbeat_and_reconcile(db: Session, video_session: VideoSession, participant_role: str) -> None:
    """Registra la presencia del que consulta y pausa el cronómetro si falta alguien.

    El tiempo adicional se solicita y se cobra con una ampliación; no se
    cobra automáticamente por minuto.
    """
    if video_session.status not in {
        VideoSessionStatus.prepared,
        VideoSessionStatus.active,
        VideoSessionStatus.extension_pending,
    }:
        return
    now = datetime.now(timezone.utc)
    video_session_service.touch_participant(video_session, participant_role, now)
    video_session_service.reconcile_timer(video_session, now)
    db.commit()
    db.refresh(video_session)


def _serialize_status(
    video_session: VideoSession,
    participant_role: str,
    *,
    files: list | None = None,
    payment_state: str = "pending",
    payment_amount_cents: int = 0,
    payment_minutes: int = 0,
    payment_failure_code: str | None = None,
    payment_failure_message: str | None = None,
    payment_next_action: str | None = None,
    payment_fee_cents: int | None = None,
    payment_doctor_amount_cents: int | None = None,
    extension_request_pending: bool = False,
    extension_requested_minutes: int = 0,
    extension_requested_amount_cents: int = 0,
    extension_request_expires_at: datetime | None = None,
) -> VideoSessionStatusResponse:
    reference_end = video_session.ended_at or datetime.now(timezone.utc)
    billable_seconds = video_session.billable_seconds or 0
    elapsed_seconds = billable_seconds
    if video_session.started_at:
        elapsed_seconds += max(0, int((reference_end - video_session.started_at).total_seconds()))

    target_seconds = max(0, video_session.estimated_minutes * 60)
    remaining_seconds = max(0, target_seconds - elapsed_seconds)

    price_per_min_cents = video_session.doctor_price_per_min_cents or 0
    platform_fee_cents = (
        payment_fee_cents
        if payment_fee_cents is not None
        else payment_amount_cents * settings.PLATFORM_FEE_BPS // 10000
    )
    doctor_amount_cents = (
        payment_doctor_amount_cents
        if payment_doctor_amount_cents is not None
        else max(0, payment_amount_cents - platform_fee_cents)
    )

    now = datetime.now(timezone.utc)
    patient_present = video_session_service.participant_present(video_session, "patient", now)
    doctor_present = video_session_service.participant_present(video_session, "doctor", now)
    both_present = patient_present and doctor_present
    jitsi_required = video_session_service.requires_jitsi(video_session)
    jitsi_patient_present = bool(getattr(video_session, "jitsi_patient_present", False))
    jitsi_doctor_present = bool(getattr(video_session, "jitsi_doctor_present", False))
    both_in_jitsi = jitsi_patient_present and jitsi_doctor_present

    return VideoSessionStatusResponse(
        video_session_id=video_session.id,
        consultation_id=video_session.consultation_id,
        appointment_id=video_session.appointment_id,
        patient_id=video_session.patient_id,
        patient_email=video_session.patient.email if video_session.patient else "",
        patient_name=get_patient_display_name(video_session.patient),
        status=video_session.status,
        provider=video_session.provider,
        participant_role=participant_role,
        room_name=video_session.provider_room_name,
        started_at=video_session.started_at,
        ended_at=video_session.ended_at,
        joined_patient_at=video_session.joined_patient_at,
        joined_doctor_at=video_session.joined_doctor_at,
        expires_at=video_session.expires_at,
        estimated_minutes=video_session.estimated_minutes,
        billable_seconds=billable_seconds,
        elapsed_seconds=elapsed_seconds,
        remaining_seconds=remaining_seconds,
        price_per_min_cents=price_per_min_cents,
        platform_fee_cents=platform_fee_cents,
        doctor_amount_cents=doctor_amount_cents,
        platform_fee_bps=settings.PLATFORM_FEE_BPS,
        patient_present=patient_present,
        doctor_present=doctor_present,
        both_present=both_present,
        jitsi_required=jitsi_required,
        jitsi_patient_present=jitsi_patient_present,
        jitsi_doctor_present=jitsi_doctor_present,
        both_in_jitsi=both_in_jitsi,
        jitsi_patient_joined_at=getattr(video_session, "jitsi_patient_joined_at", None),
        jitsi_doctor_joined_at=getattr(video_session, "jitsi_doctor_joined_at", None),
        files_enabled=settings.cloudinary_enabled,
        files=files or [],
        payment_state=payment_state,
        payment_amount_cents=payment_amount_cents,
        payment_minutes=payment_minutes,
        payment_failure_code=payment_failure_code,
        payment_failure_message=payment_failure_message,
        payment_next_action=payment_next_action,
        extension_request_pending=extension_request_pending,
        extension_requested_minutes=extension_requested_minutes,
        extension_requested_amount_cents=extension_requested_amount_cents,
        extension_request_expires_at=extension_request_expires_at,
        doctor_note=video_session.doctor_note,
        followup_instructions=video_session.followup_instructions,
        intro_script=video_session.intro_script,
        closed_reason=video_session.closed_reason,
    )


def _serialize_status_with_billing(
    db: Session, video_session: VideoSession, participant_role: str
) -> VideoSessionStatusResponse:
    """Serializa la sesión con los datos del cobro asociado a la cita."""
    appointment = video_session.appointment
    payment_state = "pending"
    payment_amount_cents = video_session.payment_amount_cents or 0
    payment_minutes = video_session.estimated_minutes or 0
    payment_failure_code = None
    payment_failure_message = None
    payment_next_action = None
    payment_fee_cents = None
    payment_doctor_amount_cents = None

    if appointment is not None:
        charge = (
            db.query(ConsultationCharge)
            .filter(ConsultationCharge.appointment_id == appointment.id)
            .first()
        )
        if charge:
            # Si ya se cobró, mostramos el total cobrado (inicial + ampliaciones).
            payment_amount_cents = charge.paid_amount_cents or charge.quoted_amount_cents
            payment_minutes = charge.paid_minutes or charge.quoted_minutes
            payment_fee_cents = charge.platform_fee_cents or 0
            payment_doctor_amount_cents = charge.doctor_net_cents or 0

        pending_transaction = (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.appointment_id == appointment.id,
                PaymentTransaction.status == PaymentTransactionStatus.requires_action,
            )
            .order_by(PaymentTransaction.id.desc())
            .first()
        )
        latest_transaction = pending_transaction or (
            db.query(PaymentTransaction)
            .filter(PaymentTransaction.appointment_id == appointment.id)
            .order_by(PaymentTransaction.id.desc())
            .first()
        )
        if latest_transaction:
            payment_failure_code = latest_transaction.failure_code
            payment_failure_message = latest_transaction.failure_message

        if pending_transaction is not None:
            payment_state = "requires_action"
            payment_next_action = (
                "mock_3ds" if pending_transaction.provider == "mock" else "provider_action"
            )
        elif video_session.payment_status == PaymentStatus.captured:
            payment_state = "paid"
        elif video_session.payment_status == PaymentStatus.authorized:
            payment_state = "requires_action"
        elif video_session.payment_status == PaymentStatus.failed:
            payment_state = "failed"
        else:
            payment_state = "pending"

    return _serialize_status(
        video_session,
        participant_role,
        files=session_file_service.list_session_files(db, video_session.id),
        payment_state=payment_state,
        payment_amount_cents=payment_amount_cents,
        payment_minutes=payment_minutes,
        payment_failure_code=payment_failure_code,
        payment_failure_message=payment_failure_message,
        payment_next_action=payment_next_action,
        payment_fee_cents=payment_fee_cents,
        payment_doctor_amount_cents=payment_doctor_amount_cents,
        extension_request_pending=video_session.extension_requested_at is not None,
        extension_requested_minutes=video_session.extension_requested_minutes or 0,
        extension_requested_amount_cents=video_session.extension_requested_amount_cents or 0,
        extension_request_expires_at=video_session.extension_request_expires_at,
    )


@router.get("/{video_session_id}", response_model=VideoSessionStatusResponse)
def get_video_session_status(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    _expire_if_needed(db, video_session)
    participant_role = _resolve_participant_role(video_session, current_user)
    _heartbeat_and_reconcile(db, video_session, participant_role)
    charge_service.check_time_exhausted(db, video_session)
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.get("/{video_session_id}/files", response_model=list[VideoSessionFileResponse])
def list_video_session_files(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")
    _resolve_participant_role(video_session, current_user)
    return session_file_service.list_session_files(db, video_session_id)


@router.post(
    "/{video_session_id}/files",
    response_model=VideoSessionFileResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_video_session_file(
    video_session_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")
    participant_role = _resolve_participant_role(video_session, current_user)
    if video_session.status not in {VideoSessionStatus.prepared, VideoSessionStatus.active}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La videoconsulta ya está cerrada."
        )

    record = session_file_service.upload_session_file(
        db, video_session, current_user, participant_role, file
    )
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="file_shared",
            source="backend",
            payload_json=json.dumps({"file_id": record.id, "uploader_role": participant_role}),
        )
    )
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{video_session_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video_session_file(
    video_session_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")
    _resolve_participant_role(video_session, current_user)
    if video_session.status not in {VideoSessionStatus.prepared, VideoSessionStatus.active}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La videoconsulta ya está cerrada."
        )
    session_file_service.delete_session_file(db, video_session, current_user, file_id)


@router.post("/{video_session_id}/join", response_model=VideoSessionStatusResponse)
def join_video_session(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    _expire_if_needed(db, video_session)
    participant_role = _resolve_participant_role(video_session, current_user)
    if video_session.status in {VideoSessionStatus.completed, VideoSessionStatus.cancelled, VideoSessionStatus.expired, VideoSessionStatus.failed}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta videoconsulta ya no está disponible")

    # Entrar a la sala NO inicia el cronómetro: solo registra la conexion y la
    # presencia. El tiempo de consulta lo controla el médico (iniciar/pausar/finalizar)
    # y solo corre cuando ambos están presentes.
    now = datetime.now(timezone.utc)
    video_session_service.set_participant_presence(video_session, participant_role, True, now)
    if participant_role == "patient":
        video_session.joined_patient_at = video_session.joined_patient_at or now
        if video_session.appointment:
            video_session.appointment.joined_patient_at = video_session.appointment.joined_patient_at or now
    else:
        video_session.joined_doctor_at = video_session.joined_doctor_at or now
        if video_session.appointment:
            video_session.appointment.joined_doctor_at = video_session.appointment.joined_doctor_at or now

    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="participant_joined_app",
            source="backend",
            payload_json=json.dumps({"participant_role": participant_role, "user_id": current_user.id}),
        )
    )
    _sync_doctor_presence_from_video_sessions(db, video_session.doctor_id)
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/jitsi-event", status_code=status.HTTP_204_NO_CONTENT)
def report_jitsi_event(
    video_session_id: int,
    payload: JitsiEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra la entrada/salida real de un participante en la conferencia de Jitsi.

    El cronómetro y el cobro exigen que ambos roles estén dentro de la sala.
    """
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if video_session.status in {
        VideoSessionStatus.completed,
        VideoSessionStatus.cancelled,
        VideoSessionStatus.expired,
        VideoSessionStatus.failed,
    }:
        return None

    now = datetime.now(timezone.utc)
    if payload.event == "heartbeat":
        video_session_service.touch_jitsi_participant(video_session, participant_role, now)
    else:
        present = payload.event == "joined"
        video_session_service.set_jitsi_presence(video_session, participant_role, present, now)
        # Entrar o salir de la conferencia también actualiza la presencia en la app.
        # Así una salida real detiene el cronómetro sin depender del botón "Salir".
        video_session_service.set_participant_presence(video_session, participant_role, present, now)
    charge_service.maybe_start_timer(db, video_session)
    video_session_service.reconcile_timer(video_session, now)
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type=f"jitsi_{payload.event}",
            source="client",
            payload_json=json.dumps(
                {"participant_role": participant_role, "user_id": current_user.id}
            ),
        )
    )
    db.commit()
    return None


@router.post("/{video_session_id}/presence-beacon", status_code=status.HTTP_204_NO_CONTENT)
def report_presence_beacon(
    video_session_id: int,
    token: str = Form(...),
    event: str = Form("left"),
    db: Session = Depends(get_db),
):
    """Cierre de pestaña/navegación: marca salida real sin depender de headers.

    Usa ``navigator.sendBeacon`` con FormData para evitar el preflight CORS que
    puede cancelarse cuando el navegador abandona la página.
    """
    current_user = _resolve_user_from_token(db, token)
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")
    participant_role = _resolve_participant_role(video_session, current_user)
    if video_session.status in {
        VideoSessionStatus.completed,
        VideoSessionStatus.cancelled,
        VideoSessionStatus.expired,
        VideoSessionStatus.failed,
    }:
        return None

    now = datetime.now(timezone.utc)
    if event == "left":
        video_session_service.set_jitsi_presence(video_session, participant_role, False, now)
        video_session_service.set_participant_presence(video_session, participant_role, False, now)
    video_session_service.reconcile_timer(video_session, now)
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type=f"presence_beacon_{event}",
            source="client",
            payload_json=json.dumps(
                {"participant_role": participant_role, "user_id": current_user.id}
            ),
        )
    )
    db.commit()
    return None


@router.post("/{video_session_id}/extend", response_model=VideoSessionStatusResponse)
def request_video_session_extension(
    video_session_id: int,
    payload: VideoSessionExtendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Solicita minutos adicionales. No cobra hasta que el paciente confirme."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")
    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el médico puede solicitar una ampliación")
    try:
        charge_service.request_extension(db, video_session, payload.minutes)
    except ChargeError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.message) from error
    notification_service.create(
        db,
        user_id=video_session.patient_id,
        notification_type="video_extension_requested",
        title="Ampliación de videoconsulta",
        body=f"El médico solicita {video_session.extension_requested_minutes} minutos adicionales. Confirma el cobro para continuar.",
        action_url="/video-room",
        metadata={"video_session_id": video_session.id, "action_label": "Revisar ampliación"},
    )
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_extension_requested",
            source="backend",
            payload_json=json.dumps(
                {
                    "minutes": video_session.extension_requested_minutes,
                    "amount_cents": video_session.extension_requested_amount_cents,
                }
            ),
        )
    )
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/extend/confirm", response_model=VideoSessionStatusResponse)
def confirm_video_session_extension(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El paciente confirma la ampliación y se ejecuta el cobro."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")
    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "patient":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el paciente puede confirmar la ampliación")
    try:
        result = charge_service.confirm_extension(db, video_session)
    except ChargeError as error:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=error.message) from error
    if result.get("state") == "paid":
        notification_service.create(
            db,
            user_id=video_session.doctor.user_id,
            notification_type="video_extension_confirmed",
            title="Ampliación confirmada",
            body="El paciente confirmó la ampliación y el cobro fue aprobado.",
            action_url="/video-room",
            metadata={"video_session_id": video_session.id, "action_label": "Volver a la consulta"},
        )
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_extension_confirmed",
            source="backend",
            payload_json=json.dumps({"state": result.get("state")}),
        )
    )
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/extend/reject", response_model=VideoSessionStatusResponse)
def reject_video_session_extension(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El paciente rechaza la ampliación. No se realiza ningún cobro."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")
    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "patient":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el paciente puede rechazar la ampliación")
    try:
        charge_service.reject_extension(db, video_session)
    except ChargeError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.message) from error
    notification_service.create(
        db,
        user_id=video_session.doctor.user_id,
        notification_type="video_extension_rejected",
        title="Ampliación rechazada",
        body="El paciente rechazó la ampliación. No se realizó ningún cobro.",
        action_url="/video-room",
        metadata={"video_session_id": video_session.id, "action_label": "Volver a la consulta"},
    )
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_extension_rejected",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id}),
        )
    )
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/extend/cancel", response_model=VideoSessionStatusResponse)
def cancel_video_session_extension(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El médico retira su solicitud antes de que el paciente la confirme."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")
    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el médico puede cancelar la solicitud")
    try:
        charge_service.reject_extension(db, video_session)
    except ChargeError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.message) from error
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_extension_cancelled",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id}),
        )
    )
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/confirm-payment", response_model=VideoSessionStatusResponse)
def confirm_video_session_payment(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El paciente completa la verificación 3DS de un cobro pendiente."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")
    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "patient":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el paciente puede confirmar el cobro")
    try:
        charge_service.confirm_pending_payment(db, video_session)
    except ChargeError as error:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=error.message) from error
    charge_service.maybe_start_timer(db, video_session)
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/intro", response_model=VideoSessionStatusResponse)
def generate_video_session_intro(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera (o recupera) el guión de apertura de la videoconsulta. Solo el médico."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el médico puede ver el guión de apertura",
        )
    if video_session.status in {
        VideoSessionStatus.completed,
        VideoSessionStatus.cancelled,
        VideoSessionStatus.expired,
        VideoSessionStatus.failed,
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta videoconsulta ya no está disponible")

    video_session_service.generate_intro_script(db, video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/start", response_model=VideoSessionStatusResponse)
def start_video_session_timer(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inicia (o reanuda) el cronómetro de la videoconsulta. Solo el médico."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el médico puede controlar el cronómetro de la videoconsulta",
        )
    if video_session.status in {
        VideoSessionStatus.completed,
        VideoSessionStatus.cancelled,
        VideoSessionStatus.expired,
        VideoSessionStatus.failed,
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta videoconsulta ya no está disponible")

    now = datetime.now(timezone.utc)
    if video_session.appointment is not None:
        if video_session.status == VideoSessionStatus.extension_pending:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El tiempo pagado se agotó. Solicita una ampliación para continuar.",
            )
        if video_session.status == VideoSessionStatus.extension_requested:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La ampliación está esperando la confirmación del paciente.",
            )
        if not video_session_service.both_participants_present(video_session, now):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Para iniciar la consulta, el paciente y el médico deben estar en la videollamada",
            )
        try:
            result = charge_service.start_initial_charge(db, video_session)
        except ChargeError as error:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=error.message) from error
        charge_service.resume_timer(db, video_session)
        db.refresh(video_session)
        return _serialize_status_with_billing(db, video_session, participant_role)

    now = datetime.now(timezone.utc)
    video_session_service.touch_participant(video_session, "doctor", now)
    # Limpia primero cualquier tiempo con presencia incompleta.
    video_session_service.reconcile_timer(video_session, now)
    if not video_session_service.both_participants_present(video_session, now):
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Para iniciar la consulta, el paciente y el médico deben estar en la sala",
        )
    if video_session.started_at is None:
        video_session.started_at = now
    # Al iniciar, garantizamos que la sala siga vigente durante la consulta
    # (duracion estimada + margen); así no se expira una sesión legitima.
    minimum_expiry = now + timedelta(minutes=video_session.estimated_minutes + 60)
    if video_session.expires_at < minimum_expiry:
        video_session.expires_at = minimum_expiry
    video_session.status = VideoSessionStatus.active
    _sync_doctor_presence_from_video_sessions(db, video_session.doctor_id)
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_session_timer_started",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id}),
        )
    )
    db.commit()
    db.refresh(video_session)
    logger.info(f"Video session {video_session_id} timer started by doctor (user={current_user.id})")
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/pause", response_model=VideoSessionStatusResponse)
def pause_video_session_timer(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pausa el cronómetro acumulando el tiempo transcurrido. Solo el médico."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el médico puede controlar el cronómetro de la videoconsulta",
        )

    now = datetime.now(timezone.utc)
    video_session_service.touch_participant(video_session, "doctor", now)
    # Acumula solo hasta el último momento con ambos presentes. Si el paciente
    # ya había salido, evita cobrar el tiempo en solitario.
    video_session_service.reconcile_timer(video_session, now)
    video_session_service.pause_timer(video_session, now)
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_session_timer_paused",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id}),
        )
    )
    db.commit()
    db.refresh(video_session)
    logger.info(f"Video session {video_session_id} timer paused by doctor (user={current_user.id})")
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/leave", response_model=VideoSessionStatusResponse)
def leave_video_session(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pausa la sesión al salir de la sala.

    Acumula el tiempo conectado en ``billable_seconds`` y limpia ``started_at``
    para que el cronómetro y el cobro se detengan hasta que se vuelva a entrar.
    """
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)

    now = datetime.now(timezone.utc)
    # El cronómetro solo corre con ambos presentes: al salir cualquiera de los
    # dos, se pausa y se acumula unicamente el tiempo en el que ambos estuvieron.
    # Primero reconciliamos por si el otro ya había dejado de dar señales.
    video_session_service.reconcile_timer(video_session, now)
    video_session_service.set_participant_presence(video_session, participant_role, False, now)
    video_session_service.pause_timer(video_session, now)

    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="participant_left_app",
            source="backend",
            payload_json=json.dumps({"participant_role": participant_role, "user_id": current_user.id}),
        )
    )
    db.commit()
    db.refresh(video_session)
    logger.info(f"Video session {video_session_id} paused by {participant_role} (user={current_user.id})")
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.patch("/{video_session_id}/doctor-note", response_model=VideoSessionStatusResponse)
def update_video_session_doctor_note(
    video_session_id: int,
    payload: VideoSessionDoctorNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el médico puede actualizar notas clinicas")

    video_session.doctor_note = payload.doctor_note
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="doctor_note_updated",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id}),
        )
    )
    audit_service.log(
        db,
        action="video_session.doctor_note_updated",
        entity_type="video_session",
        entity_id=video_session.id,
        actor_user_id=current_user.id,
    )
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/complete", response_model=VideoSessionStatusResponse)
def complete_video_session(
    video_session_id: int,
    payload: VideoSessionCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el médico puede cerrar la videoconsulta")
    if video_session.status in {VideoSessionStatus.completed, VideoSessionStatus.cancelled, VideoSessionStatus.expired, VideoSessionStatus.failed}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta videoconsulta ya fue cerrada")

    if video_session.appointment is not None:
        video_session.doctor_note = payload.doctor_note
        video_session.followup_instructions = payload.followup_instructions
        video_session.ended_by_user_id = current_user.id
        if video_session.appointment:
            video_session.appointment.doctor_note = payload.doctor_note
            video_session.appointment.followup_instructions = payload.followup_instructions
        charge_service.finalize_session(
            db,
            video_session,
            reason=payload.closed_reason or "completed_by_doctor",
        )
        return _serialize_status_with_billing(db, video_session, participant_role)

    now = datetime.now(timezone.utc)
    video_session_service.reconcile_timer(video_session, now)
    video_session_service.pause_timer(video_session, now)
    video_session.patient_present = False
    video_session.doctor_present = False
    video_session.status = VideoSessionStatus.completed
    video_session.ended_at = video_session.ended_at or now
    video_session.ended_by_user_id = current_user.id
    video_session.closed_reason = payload.closed_reason or "completed_by_doctor"
    video_session.doctor_note = payload.doctor_note
    video_session.followup_instructions = payload.followup_instructions

    if video_session.appointment:
        appointment = video_session.appointment
        appointment.status = AppointmentStatus.completed
        appointment.completed_at = appointment.completed_at or now
        appointment.doctor_note = payload.doctor_note
        appointment.followup_instructions = payload.followup_instructions
        if appointment.consultation:
            appointment.consultation.status = ConsultationStatus.closed
            appointment.consultation.closed_at = appointment.consultation.closed_at or now
        notification_service.create(
            db,
            user_id=appointment.patient_id,
            notification_type="appointment_completed",
            title="Videoconsulta completada",
            body=f"Tu videoconsulta con {video_session.doctor.display_name} finalizo. Ya puedes revisar indicaciones y dejar una reseña.",
            action_url="/me/appointments",
            metadata={"appointment_id": appointment.id, "action_label": "Ver cita"},
        )
    elif video_session.consultation:
        consultation = video_session.consultation
        consultation.status = ConsultationStatus.closed
        consultation.closed_at = consultation.closed_at or now
        notification_service.create(
            db,
            user_id=video_session.patient_id,
            notification_type="video_consultation_completed",
            title="Videoconsulta finalizada",
            body=f"La videoconsulta con {video_session.doctor.display_name} ya finalizo.",
            action_url="/me/consultations",
            metadata={"consultation_id": consultation.id, "action_label": "Ver consulta"},
        )

    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_session_completed_by_doctor",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id, "closed_reason": video_session.closed_reason}),
        )
    )
    audit_service.log(
        db,
        action="video_session.completed",
        entity_type="video_session",
        entity_id=video_session.id,
        actor_user_id=current_user.id,
        metadata={"closed_reason": video_session.closed_reason},
    )
    _sync_doctor_presence_from_video_sessions(db, video_session.doctor_id)
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)
