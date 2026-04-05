from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.specialty import Specialty
from app.core.logging import get_logger

logger = get_logger(__name__)

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
            {"value": "general", "label": "Malestar general o no sé ubicarlo"}
        ]
    },
    {
        "id": "patient_type",
        "question": "¿Para quién es la consulta?",
        "options": [
            {"value": "adult", "label": "Adulto (mayor de 18 años)"},
            {"value": "child", "label": "Niño o adolescente (menor de 18 años)"},
            {"value": "pregnant", "label": "Mujer embarazada"}
        ]
    },
    {
        "id": "duration",
        "question": "¿Hace cuánto tiempo tienes estos síntomas?",
        "options": [
            {"value": "hours", "label": "Menos de 24 horas"},
            {"value": "days", "label": "Algunos días (1-7 días)"},
            {"value": "weeks", "label": "Semanas (más de 7 días)"},
            {"value": "months", "label": "Meses o más"}
        ]
    },
    {
        "id": "severity",
        "question": "¿Cómo calificarías la intensidad de tus síntomas?",
        "options": [
            {"value": "mild", "label": "Leve - puedo hacer mis actividades normales"},
            {"value": "moderate", "label": "Moderado - me molesta pero puedo funcionar"},
            {"value": "severe", "label": "Severo - me impide hacer actividades normales"}
        ]
    }
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


class GuideService:
    def get_questions(self) -> List[Dict]:
        return WIZARD_QUESTIONS
    
    def get_recommendation(self, db: Session, answers: List[Dict]) -> Dict:
        answers_dict = {a["question_id"]: a["answer"] for a in answers}
        
        body_area = answers_dict.get("body_area", "general")
        patient_type = answers_dict.get("patient_type", "adult")
        duration = answers_dict.get("duration", "days")
        severity = answers_dict.get("severity", "moderate")
        
        key = (body_area, patient_type)
        recommended_slug = RECOMMENDATION_RULES.get(key, "medicina-interna")
        
        specialty = db.query(Specialty).filter(Specialty.slug == recommended_slug).first()
        
        if not specialty:
            specialty = db.query(Specialty).filter(Specialty.slug == "medicina-interna").first()
            recommended_slug = "medicina-interna"
        
        confidence = "alta" if severity == "severe" or duration in ["weeks", "months"] else "media"
        
        reason = self._build_reason(body_area, patient_type, duration, severity)
        
        return {
            "recommended_specialty_slug": recommended_slug,
            "recommended_specialty_name": specialty.name if specialty else "Medicina Interna",
            "confidence": confidence,
            "reason": reason,
            "disclaimer": "Esta recomendación es solo orientativa. Un profesional de la salud debe evaluar tu caso. Si los síntomas son severos o empeoran, acude a urgencias."
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
            "general": "síntomas generales"
        }
        
        patient_names = {
            "adult": "un adulto",
            "child": "un menor de edad",
            "pregnant": "una mujer embarazada"
        }
        
        area = area_names.get(body_area, "el área indicada")
        patient = patient_names.get(patient_type, "el paciente")
        
        return f"Basado en que las molestias están en {area} y la consulta es para {patient}, esta especialidad es la más adecuada para una primera evaluación."


guide_service = GuideService()
