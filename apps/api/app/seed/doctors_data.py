DOCTORS_DATA = [
    {
        "email": "cardio.demo@sabiodoc.app",
        "password": "DemoDoctor123!",
        "display_name": "Dra. Valeria Rios",
        "professional_title": "Cardiologa clinica",
        "bio_short": "Cardiologa clinica enfocada en hipertension, palpitaciones y evaluacion preventiva.",
        "price_per_min_cents": 2200,
        "license_number": "COL-CARD-1001",
        "license_country": "Colombia",
        "country": "Colombia",
        "city": "Bogota",
        "timezone": "America/Bogota",
        "government_id": "CC-1002003001",
        "years_experience": 12,
        "specialty_slugs": ["cardiologia", "medicina-interna"],
        "availability_slots": [
            {"weekday": 0, "start": "09:00", "end": "12:00"},
            {"weekday": 2, "start": "14:00", "end": "18:00"},
            {"weekday": 4, "start": "09:00", "end": "12:00"}
        ],
        "presence_status": "online",
        "presence_message": "En linea - Disponible ahora",
        "rating_avg": 4.8,
        "rating_count": 124,
        "status": "approved",
    },
    {
        "email": "derma.demo@sabiodoc.app",
        "password": "DemoDoctor123!",
        "display_name": "Dr. Mateo Sosa",
        "professional_title": "Dermatologo",
        "bio_short": "Dermatologo con enfoque practico en acne, dermatitis y seguimiento de lesiones.",
        "price_per_min_cents": 1800,
        "license_number": "COL-DERM-2040",
        "license_country": "Colombia",
        "country": "Colombia",
        "city": "Medellin",
        "timezone": "America/Bogota",
        "government_id": "CC-1010101010",
        "years_experience": 9,
        "specialty_slugs": ["dermatologia"],
        "availability_slots": [
            {"weekday": 1, "start": "10:00", "end": "13:00"},
            {"weekday": 3, "start": "15:00", "end": "19:00"}
        ],
        "presence_status": "busy",
        "presence_message": "En linea - En consulta",
        "rating_avg": 4.6,
        "rating_count": 89,
        "status": "approved",
    },
    {
        "email": "neuro.demo@sabiodoc.app",
        "password": "DemoDoctor123!",
        "display_name": "Dra. Camila Ortega",
        "professional_title": "Neurologa",
        "bio_short": "Neurologa para cefalea, mareo, trastornos del sueno y sintomas neurologicos iniciales.",
        "price_per_min_cents": 2600,
        "license_number": "COL-NEU-3099",
        "license_country": "Colombia",
        "country": "Colombia",
        "city": "Cali",
        "timezone": "America/Bogota",
        "government_id": "CC-1098765432",
        "years_experience": 14,
        "specialty_slugs": ["neurologia"],
        "availability_slots": [
            {"weekday": 0, "start": "08:00", "end": "11:00"},
            {"weekday": 5, "start": "09:00", "end": "13:00"}
        ],
        "presence_status": "offline",
        "presence_message": "Desconectado",
        "rating_avg": 4.9,
        "rating_count": 203,
        "status": "approved",
    },
]


# Dos perfiles deterministas por especialidad para probar búsquedas, filtros,
# disponibilidad y agendamiento sin depender de médicos reales.
from app.seed.specialties_data import SPECIALTIES_DATA

_DUMMY_DOCTOR_NAMES = [
    ("Dra.", "Ana Torres"),
    ("Dr.", "Bruno Castillo"),
    ("Dra.", "Carla Mendoza"),
    ("Dr.", "Diego Vargas"),
    ("Dra.", "Elena Navarro"),
    ("Dr.", "Fabian Rojas"),
    ("Dra.", "Gabriela Salas"),
    ("Dr.", "Hector Paredes"),
    ("Dra.", "Irene Campos"),
    ("Dr.", "Javier Molina"),
    ("Dra.", "Karina Fuentes"),
    ("Dr.", "Luis Herrera"),
    ("Dra.", "Mariana Vega"),
    ("Dr.", "Nicolas Soto"),
    ("Dra.", "Olivia Reyes"),
    ("Dr.", "Pablo Leon"),
    ("Dra.", "Renata Silva"),
    ("Dr.", "Sergio Acosta"),
    ("Dra.", "Teresa Flores"),
    ("Dr.", "Uriel Cabrera"),
    ("Dra.", "Valentina Cruz"),
    ("Dr.", "Walter Espinoza"),
    ("Dra.", "Ximena Ponce"),
    ("Dr.", "Yago Miranda"),
    ("Dra.", "Zoe Guzman"),
    ("Dr.", "Alonso Prieto"),
    ("Dra.", "Beatriz Lozano"),
    ("Dr.", "Cesar Quintana"),
    ("Dra.", "Daniela Mendez"),
    ("Dr.", "Esteban Arias"),
]


def _build_dummy_doctors():
    dummy_doctors = []
    for specialty_index, specialty in enumerate(SPECIALTIES_DATA):
        for variant in range(2):
            serial = specialty_index * 2 + variant + 1
            title, name = _DUMMY_DOCTOR_NAMES[serial - 1]
            slug = specialty["slug"]
            specialty_name = specialty["name"]
            dummy_doctors.append(
                {
                    "email": f"dummy.{slug}.{variant + 1}@sabiodoc.app",
                    "password": "DummyDoctor123!",
                    "display_name": f"{title} {name} (Demo {specialty_name})",
                    "professional_title": f"Especialista en {specialty_name}",
                    "bio_short": f"Perfil dummy para pruebas de {specialty_name.lower()}, búsqueda y agendamiento.",
                    "price_per_min_cents": 1500 + (specialty_index * 100) + (variant * 200),
                    "license_number": f"DUMMY-{slug.upper()}-{variant + 1:02d}",
                    "license_country": "Peru",
                    "country": "Peru",
                    "city": "Lima",
                    "timezone": "America/Lima",
                    "government_id": f"DUMMY-{serial:04d}",
                    "years_experience": 5 + variant,
                    "specialty_slugs": [slug],
                    "availability_slots": (
                        [
                            {"weekday": 0, "start": "09:00", "end": "13:00"},
                            {"weekday": 3, "start": "14:00", "end": "18:00"},
                        ]
                        if variant == 0
                        else [
                            {"weekday": 1, "start": "10:00", "end": "14:00"},
                            {"weekday": 4, "start": "15:00", "end": "19:00"},
                        ]
                    ),
                    "presence_status": "online" if variant == 0 else "offline",
                    "presence_message": "Disponible para pruebas" if variant == 0 else "Demo - No disponible",
                    "rating_avg": 4.5 + (variant * 0.2),
                    "rating_count": 20 + (specialty_index * 3) + (variant * 10),
                    "status": "approved",
                }
            )
    return dummy_doctors


DOCTORS_DATA.extend(_build_dummy_doctors())
