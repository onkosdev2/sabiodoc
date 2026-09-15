from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.specialty import Specialty
from app.models.triage_request import TriageRequest
from app.models.user import User
from app.services.llm_client import llm_client
from app.core.logging import get_logger

logger = get_logger(__name__)

MAX_GUIDE_STEPS = 5
DEFAULT_SPECIALTY_SLUG = "medicina-interna"
DEFAULT_DISCLAIMER = (
    "Esta recomendación es solo orientativa. Un profesional de la salud debe "
    "evaluar tu caso. Si los síntomas son severos o empeoran, acude a urgencias."
)

WIZARD_QUESTIONS = [
    {
        "id": "body_area",
        "question": "¿En qué parte del cuerpo sientes las molestias principalmente?",
        "options": [
            {"value": "head", "label": "Cabeza (incluyendo ojos, oídos, nariz, garganta)"},
            {"value": "chest", "label": "Pecho o corazón"},
            {"value": "abdomen", "label": "Abdomen o estómago"},
            {"value": "skin", "label": "Piel"},
            {"value": "bones_joints", "label": "Huesos, articulaciones o músculos"},
            {"value": "urinary", "label": "Sistema urinario o genital"},
            {"value": "mental", "label": "Estado de ánimo o salud mental"},
            {"value": "general", "label": "Malestar general o no sé ubicarlo"},
        ],
    },
    {
        "id": "patient_type",
        "question": "¿Para quién es la consulta?",
        "options": [
            {"value": "adult", "label": "Adulto (mayor de 18 años)"},
            {"value": "child", "label": "Niño o adolescente (menor de 18 años)"},
            {"value": "pregnant", "label": "Mujer embarazada"},
        ],
    },
    {
        "id": "duration",
        "question": "¿Hace cuánto tiempo tienes estos síntomas?",
        "options": [
            {"value": "hours", "label": "Menos de 24 horas"},
            {"value": "days", "label": "Algunos días (1-7 días)"},
            {"value": "weeks", "label": "Semanas (más de 7 días)"},
            {"value": "months", "label": "Meses o más"},
        ],
    },
    {
        "id": "severity",
        "question": "¿Cómo calificarías la intensidad de tus síntomas?",
        "options": [
            {"value": "mild", "label": "Leve - puedo hacer mis actividades normales"},
            {"value": "moderate", "label": "Moderado - me molesta pero puedo funcionar"},
            {"value": "severe", "label": "Severo - me impide hacer actividades normales"},
        ],
    },
]

RECOMMENDATION_RULES = {
    ("head", "adult"): "neurologia",
    ("head", "child"): "pediatria",
    ("chest", "adult"): "cardiologia",
    ("chest", "child"): "pediatria",
    ("abdomen", "adult"): "gastroenterologia",
    ("abdomen", "child"): "pediatria",
    ("skin", "adult"): "dermatologia",
    ("skin", "child"): "dermatologia",
    ("bones_joints", "adult"): "traumatologia",
    ("bones_joints", "child"): "pediatria",
    ("urinary", "adult"): "urologia",
    ("urinary", "child"): "pediatria",
    ("mental", "adult"): "psiquiatria",
    ("mental", "child"): "psiquiatria",
    ("general", "adult"): "medicina-interna",
    ("general", "child"): "pediatria",
    ("head", "pregnant"): "ginecologia",
    ("chest", "pregnant"): "ginecologia",
    ("abdomen", "pregnant"): "ginecologia",
    ("skin", "pregnant"): "dermatologia",
    ("bones_joints", "pregnant"): "traumatologia",
    ("urinary", "pregnant"): "ginecologia",
    ("mental", "pregnant"): "psiquiatria",
    ("general", "pregnant"): "ginecologia",
}

GUIDE_SYSTEM_PROMPT_TEMPLATE = """Eres "SabioDoc Guía", un asistente médico que orienta a pacientes hacia la especialidad médica adecuada mediante preguntas de opción múltiple.

TU OBJETIVO:
- Hacer preguntas cortas, claras y fáciles de responder.
- El paciente SOLO puede elegir entre las opciones que tú proporciones. NUNCA pidas texto libre.
- Elegir la especialidad más adecuada de la lista permitida.
- Cuidar la seguridad: si detectas una posible emergencia, marca urgency="emergency".

ESPECIALIDADES PERMITIDAS (usa EXACTAMENTE estos slugs en recommended_specialty_slug y alternatives):
{specialties}

REGLAS:
1. Haz UNA sola pregunta por turno.
2. Cada pregunta debe incluir entre 3 y 6 opciones excluyentes y concretas.
3. Cada opción tiene "value" (snake_case, sin espacios) y "label" (texto visible en español).
4. No repitas preguntas ya respondidas ni preguntes datos que ya tengas.
5. Haz entre 3 y {max_steps} preguntas en total. En cuanto tengas información suficiente, entrega la recomendación.
6. No des diagnósticos ni recetas: solo orientas hacia una especialidad.
7. Responde SIEMPRE con un único objeto JSON válido, sin texto fuera del JSON.

FORMATO SI AÚN NECESITAS PREGUNTAR:
{{
  "status": "question",
  "question": "¿...?",
  "options": [
    {{"value": "opcion_1", "label": "Texto de la opción 1"}},
    {{"value": "opcion_2", "label": "Texto de la opción 2"}}
  ]
}}

FORMATO SI YA PUEDES RECOMENDAR:
{{
  "status": "recommendation",
  "recommended_specialty_slug": "slug-de-la-lista",
  "confidence": "alta|media|baja",
  "reason": "explicación breve y empática",
  "rationale_bullets": ["razón 1", "razón 2"],
  "clarifying_questions": ["pregunta útil para comentar con el médico"],
  "alternatives": [{{"specialty_slug": "slug-de-la-lista", "reason": "motivo"}}],
  "urgency": "low|medium|high|emergency",
  "red_flags_detected": ["señal de alarma detectada, si existe"],
  "disclaimer": "{disclaimer}"
}}"""


class GuideService:
    # --- Flujo determinista (compatibilidad y modo mock) --------------------------

    def get_questions(self) -> List[Dict]:
        return WIZARD_QUESTIONS

    def get_recommendation(self, db: Session, answers: List[Dict]) -> Dict:
        answers_dict = {a["question_id"]: a["answer"] for a in answers}

        body_area = answers_dict.get("body_area", "general")
        patient_type = answers_dict.get("patient_type", "adult")
        duration = answers_dict.get("duration", "days")
        severity = answers_dict.get("severity", "moderate")

        key = (body_area, patient_type)
        recommended_slug = RECOMMENDATION_RULES.get(key, DEFAULT_SPECIALTY_SLUG)

        specialty = db.query(Specialty).filter(Specialty.slug == recommended_slug).first()

        if not specialty:
            specialty = db.query(Specialty).filter(Specialty.slug == DEFAULT_SPECIALTY_SLUG).first()
            recommended_slug = DEFAULT_SPECIALTY_SLUG

        confidence = "alta" if severity == "severe" or duration in ["weeks", "months"] else "media"

        reason = self._build_reason(body_area, patient_type, duration, severity)

        return {
            "recommended_specialty_slug": recommended_slug,
            "recommended_specialty_name": specialty.name if specialty else "Medicina Interna",
            "confidence": confidence,
            "reason": reason,
            "disclaimer": DEFAULT_DISCLAIMER,
        }

    def _build_reason(self, body_area: str, patient_type: str, duration: str, severity: str) -> str:
        area_names = {
            "head": "la cabeza",
            "chest": "el pecho",
            "abdomen": "el abdomen",
            "skin": "la piel",
            "bones_joints": "huesos o articulaciones",
            "urinary": "el sistema urinario",
            "mental": "la salud mental",
            "general": "síntomas generales",
        }

        patient_names = {
            "adult": "un adulto",
            "child": "un menor de edad",
            "pregnant": "una mujer embarazada",
        }

        area = area_names.get(body_area, "el área indicada")
        patient = patient_names.get(patient_type, "el paciente")

        return (
            f"Basado en que las molestias están en {area} y la consulta es para {patient}, "
            "esta especialidad es la más adecuada para una primera evaluación."
        )

    # --- Flujo conversacional con IA ----------------------------------------------

    def step(self, db: Session, history: List[Dict]) -> Dict:
        """Devuelve la siguiente pregunta (con opciones) o la recomendación final.

        Usa la IA cuando está disponible y cae al árbol determinista en modo mock
        o si la IA falla.
        """
        ai_result = self._get_ai_step(db, history)
        if ai_result is not None:
            return ai_result
        return self._get_mock_step(db, history)

    def _get_ai_step(self, db: Session, history: List[Dict]) -> Optional[Dict]:
        specialties = db.query(Specialty).order_by(Specialty.name).all()
        if not specialties:
            return None

        system_prompt = GUIDE_SYSTEM_PROMPT_TEMPLATE.format(
            specialties="\n".join(f"- {s.slug}: {s.name}" for s in specialties),
            max_steps=MAX_GUIDE_STEPS,
            disclaimer=DEFAULT_DISCLAIMER,
        )
        user_message = self._build_user_message(history)

        payload = llm_client.chat_json(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.4,
            max_tokens=800,
        )
        if not payload:
            return None

        status = str(payload.get("status", "")).lower()
        if status == "recommendation":
            return self._build_ai_recommendation(db, payload, history)
        if status == "question":
            return self._build_ai_question(payload, history)
        return None

    def _build_user_message(self, history: List[Dict]) -> str:
        if not history:
            return "Inicia la guía con la primera pregunta."

        lines = ["Respuestas del paciente hasta ahora:"]
        for index, item in enumerate(history, start=1):
            lines.append(f"{index}. Pregunta: {item.get('question', '')}")
            lines.append(f"   Respuesta: {item.get('answer_label') or item.get('answer', '')}")

        if len(history) >= MAX_GUIDE_STEPS:
            lines.append(
                "\nYa cuentas con información suficiente. Devuelve AHORA la recomendación "
                "en formato JSON (status=\"recommendation\")."
            )
        else:
            lines.append("\nHaz la siguiente pregunta en formato JSON (status=\"question\").")

        return "\n".join(lines)

    def _build_ai_question(self, payload: Dict[str, Any], history: List[Dict]) -> Optional[Dict]:
        question = str(payload.get("question") or "").strip()
        raw_options = payload.get("options")

        options: List[Dict[str, str]] = []
        if isinstance(raw_options, list):
            for option in raw_options:
                if not isinstance(option, dict):
                    continue
                value = str(option.get("value") or "").strip()
                label = str(option.get("label") or "").strip()
                if not value or not label:
                    continue
                options.append({"value": value, "label": label})

        if not question or len(options) < 2:
            return None

        question_id = str(payload.get("question_id") or f"ai_q{len(history) + 1}")
        return {
            "status": "question",
            "step": len(history) + 1,
            "max_steps": MAX_GUIDE_STEPS,
            "question_id": question_id,
            "question": question,
            "options": options[:6],
        }

    def _build_ai_recommendation(self, db: Session, payload: Dict[str, Any], history: List[Dict]) -> Dict:
        specialty = self._resolve_specialty(
            db,
            payload.get("recommended_specialty_slug"),
            payload.get("recommended_specialty_name"),
        )
        if specialty is None:
            specialty = (
                db.query(Specialty).filter(Specialty.slug == DEFAULT_SPECIALTY_SLUG).first()
            )

        valid_slugs = {s.slug for s in db.query(Specialty).all()}

        alternatives: List[Dict[str, str]] = []
        raw_alternatives = payload.get("alternatives")
        if isinstance(raw_alternatives, list):
            for alt in raw_alternatives:
                if not isinstance(alt, dict):
                    continue
                slug = str(alt.get("specialty_slug") or "").strip()
                reason = str(alt.get("reason") or "").strip()
                if slug in valid_slugs and slug != (specialty.slug if specialty else None) and reason:
                    alternatives.append({"specialty_slug": slug, "reason": reason})

        urgency = str(payload.get("urgency") or "medium").lower()
        if urgency not in {"low", "medium", "high", "emergency"}:
            urgency = "medium"

        confidence = str(payload.get("confidence") or "media").lower()
        if confidence not in {"alta", "media", "baja"}:
            confidence = "media"

        reason = str(payload.get("reason") or "").strip() or self._default_ai_reason(specialty)
        disclaimer = str(payload.get("disclaimer") or "").strip() or DEFAULT_DISCLAIMER

        return {
            "status": "recommendation",
            "step": len(history),
            "max_steps": MAX_GUIDE_STEPS,
            "recommended_specialty_slug": specialty.slug if specialty else DEFAULT_SPECIALTY_SLUG,
            "recommended_specialty_name": specialty.name if specialty else "Medicina Interna",
            "confidence": confidence,
            "reason": reason,
            "rationale_bullets": self._normalize_string_list(payload.get("rationale_bullets"))[:4],
            "clarifying_questions": self._normalize_string_list(payload.get("clarifying_questions"))[:4],
            "alternatives": alternatives[:2],
            "urgency": urgency,
            "red_flags_detected": self._normalize_string_list(payload.get("red_flags_detected"))[:4],
            "disclaimer": disclaimer,
        }

    def _resolve_specialty(
        self,
        db: Session,
        slug: Optional[Any],
        name: Optional[Any],
    ) -> Optional[Specialty]:
        slug_text = str(slug or "").strip().lower()
        if slug_text:
            specialty = db.query(Specialty).filter(Specialty.slug == slug_text).first()
            if specialty:
                return specialty

        name_text = str(name or "").strip()
        if name_text:
            return db.query(Specialty).filter(Specialty.name.ilike(name_text)).first()

        return None

    def _default_ai_reason(self, specialty: Optional[Specialty]) -> str:
        name = specialty.name if specialty else "Medicina Interna"
        return (
            f"Según tus respuestas, {name} es la especialidad más adecuada para una "
            "primera evaluación."
        )

    def _normalize_string_list(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            candidates = [value]
        elif isinstance(value, list):
            candidates = value
        else:
            candidates = [str(value)]

        normalized: List[str] = []
        for item in candidates:
            text = str(item).strip()
            if text:
                normalized.append(text[:300])
        return normalized

    def _get_mock_step(self, db: Session, history: List[Dict]) -> Dict:
        index = len(history)
        mock_max_steps = len(WIZARD_QUESTIONS)

        if index < mock_max_steps:
            question = WIZARD_QUESTIONS[index]
            return {
                "status": "question",
                "step": index + 1,
                "max_steps": mock_max_steps,
                "question_id": question["id"],
                "question": question["question"],
                "options": question["options"],
            }

        answers = [
            {"question_id": h.get("question_id", ""), "answer": h.get("answer", "")}
            for h in history
        ]
        recommendation = self.get_recommendation(db, answers)

        severity = next((h.get("answer") for h in history if h.get("question_id") == "severity"), None)
        urgency = "high" if severity == "severe" else "medium"

        return {
            "status": "recommendation",
            "step": len(history),
            "max_steps": mock_max_steps,
            "recommended_specialty_slug": recommendation["recommended_specialty_slug"],
            "recommended_specialty_name": recommendation["recommended_specialty_name"],
            "confidence": recommendation["confidence"],
            "reason": recommendation["reason"],
            "rationale_bullets": [],
            "clarifying_questions": [],
            "alternatives": [],
            "urgency": urgency,
            "red_flags_detected": [],
            "disclaimer": recommendation["disclaimer"],
        }

    # --- Persistencia del historial conjunto -------------------------------------

    def record_recommendation(
        self,
        db: Session,
        user: Optional[User],
        history: List[Dict],
        result: Dict,
    ) -> TriageRequest:
        """Guarda la recomendación de la guía en el historial de IA del usuario."""
        record = TriageRequest(
            user_id=user.id if user else None,
            source="guide",
            symptoms_text=self._build_history_summary(history),
            answers_json=history,
            result_json=self._triage_result_payload(result),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.info(f"Guide recommendation saved with id={record.id}")
        return record

    def _build_history_summary(self, history: List[Dict]) -> str:
        labels = [
            str(item.get("answer_label") or item.get("answer") or "").strip()
            for item in history
        ]
        labels = [label for label in labels if label]
        if not labels:
            return "Guía IA de Especialidades"
        return ("Guía IA: " + " · ".join(labels))[:1000]

    def _triage_result_payload(self, result: Dict) -> Dict:
        """Extrae solo los campos compatibles con TriageResult para el historial."""
        return {
            "urgency": result.get("urgency", "medium"),
            "recommended_specialty_slug": result.get("recommended_specialty_slug"),
            "rationale_bullets": result.get("rationale_bullets", []),
            "clarifying_questions": result.get("clarifying_questions", []),
            "alternatives": result.get("alternatives", []),
            "red_flags_detected": result.get("red_flags_detected", []),
            "disclaimer": result.get("disclaimer", DEFAULT_DISCLAIMER),
        }


guide_service = GuideService()
