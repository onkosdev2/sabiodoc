import os
import json
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI

load_dotenv()

router = APIRouter(prefix="/emergency", tags=["Emergency"])

DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    """Crea el cliente de DeepSeek de forma perezosa y valida la API key."""
    global _client
    if _client is None:
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="Servicio de IA no configurado: falta DEEPSEEK_API_KEY",
            )
        _client = OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)
    return _client

class HospitalItem(BaseModel):
    name: str
    address: str
    google_maps_query: str

class EmergencyInfoRequest(BaseModel):
    location: str

class EmergencyInfoResponse(BaseModel):
    emergencias_medicas: str
    cruz_roja_o_ambulancia: str
    bomberos: str
    policia: str
    region: str
    hospitals: List[HospitalItem]

@router.post("/contacts", response_model=EmergencyInfoResponse)
async def get_emergency_contacts(payload: EmergencyInfoRequest):
    prompt = f"""
    Eres un sistema de despacho médico y geolocalización de urgencias.

    UBICACIÓN DEL PACIENTE: "{payload.location}"

    TU TAREA:
    1. Extrae el país, ciudad y DISTRITO/ZONA exacta de la ubicación del paciente.
    2. Define los teléfonos de emergencia oficiales locales.
    3. Encuentra de 2 a 3 centros con servicio de EMERGENCIA/URGENCIAS 24/7 que estén UBICADOS FÍSICAMENTE EN ESE MISMO DISTRITO o inmediatamente en sus límites distritales colindantes.

    REGLAS ESTRICTAS DE PROXIMIDAD GEOGRÁFICA:
    - PRIORIDAD DISTRITAL: Si el usuario está en un distrito concreto (ej. San Borja, Surco, San Isidro, etc.), NO sugieras hospitales generales que queden a kilómetros de distancia en otros distritos (como Cercado de Lima o Jesús María) a menos que no exista ninguna otra opción médica en la zona.
    - TIPO DE ESTABLECIMIENTO: Incluye hospitales públicos, institutos especializados y CLÍNICAS PRIVADAS RECONOCIDAS con servicio de trauma shock y emergencia médica 24/7 del distrito (ej. clínicas privadas acreditadas o institutos nacionales del distrito).
    - CERO CONFUSIÓN DE DIRECCIONES: El campo "address" DEBE ser la dirección física real y conocida de la sede del centro médico, NUNCA la dirección que ingresó el paciente.

    REGLAS TELEFÓNICAS (Si es Perú):
    - emergencias_medicas: "106 (SAMU) / 117 (EsSalud)"
    - bomberos: "116"
    - policia: "105"
    - cruz_roja_o_ambulancia: "01 266 0481 (Cruz Roja)"

    Devuelve ÚNICAMENTE un JSON válido con esta estructura:
    {{
      "emergencias_medicas": "string",
      "cruz_roja_o_ambulancia": "string",
      "bomberos": "string",
      "policia": "string",
      "region": "Distrito identificado, Ciudad, País",
      "hospitals": [
        {{
          "name": "Nombre de la clínica, hospital o centro de urgencias 24/7",
          "address": "Dirección real y oficial de la sede en el distrito",
          "google_maps_query": "Nombre del centro médico + Distrito + Ciudad"
        }}
      ]
    }}
    """

    try:
        completion = _get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Eres un asistente de rescate médico local. Priorizas cercanía hiperlocal distrital (hospitales y clínicas con emergencia 24/7 en el mismo distrito). Devuelve JSON estricto."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            response_format={"type": "json_object"}
        )

        data = json.loads(completion.choices[0].message.content)
        return data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando el servicio: {str(e)}")