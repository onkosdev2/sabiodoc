"""Agrega especialidades faltantes del catálogo

Revision ID: 027
Revises: 026
Create Date: 2026-10-08 00:00:00.000000

Solo incorpora las especialidades que no existían y normaliza el nombre de las
que ya estaban con una denominación equivalente. Las 15 especialidades
originales siguen viniendo del seed; esta migración garantiza que las bases de
datos ya desplegadas reciban las nuevas sin volver a ejecutar todo el seed.
"""
import json

from alembic import op
import sqlalchemy as sa


revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


# Especialidades nuevas con su descripción y palabras clave.
NEW_SPECIALTIES = [
    {
        "slug": "geriatria",
        "name": "Geriatría",
        "description": "Especialidad médica dedicada a la atención integral de las personas mayores, enfocada en la prevención, diagnóstico y tratamiento de las enfermedades propias del envejecimiento, así como en el manejo de la fragilidad y la dependencia.",
        "keywords": ["geriatra", "geriatría", "geriatria", "adulto mayor", "tercera edad", "anciano", "anciana", "envejecimiento", "fragilidad", "demencia", "caidas", "caídas", "polifarmacia"],
        "is_top": False,
    },
    {
        "slug": "hematologia",
        "name": "Hematología",
        "description": "Especialidad médica que estudia la sangre, los órganos hematopoyéticos y los trastornos asociados, como anemias, coagulopatías, leucemias y linfomas.",
        "keywords": ["hematologo", "hematóloga", "hematólogo", "hematologia", "hematología", "sangre", "anemia", "coagulacion", "coagulación", "plaquetas", "leucemia", "linfoma", "hemofilia", "transfusion", "transfusión"],
        "is_top": False,
    },
    {
        "slug": "medicina-infecciosas-tropicales",
        "name": "Medicina de Enfermedades Infecciosas y Tropicales",
        "description": "Especialidad médica que se ocupa del diagnóstico, tratamiento y prevención de las enfermedades causadas por agentes infecciosos, incluidas las infecciones emergentes y las enfermedades tropicales desatendidas.",
        "keywords": ["infectologo", "infectóloga", "infectólogo", "infectologia", "infectología", "infecciones", "enfermedades infecciosas", "tropicales", "dengue", "malaria", "tuberculosis", "vih", "sida", "fiebre", "parasitos", "parásitos", "zika", "chikungunya"],
        "is_top": False,
    },
    {
        "slug": "neumologia",
        "name": "Neumología",
        "description": "Especialidad médica que estudia el aparato respiratorio y sus enfermedades, como asma, EPOC, neumonías, tuberculosis y trastornos del sueño.",
        "keywords": ["neumologo", "neumóloga", "neumólogo", "neumologia", "neumología", "pulmones", "pulmon", "pulmón", "respiratorio", "asma", "epoc", "bronquitis", "neumonia", "neumonía", "tos", "falta de aire", "apnea", "tuberculosis"],
        "is_top": False,
    },
    {
        "slug": "reumatologia",
        "name": "Reumatología",
        "description": "Especialidad médica que se dedica al diagnóstico y tratamiento de las enfermedades autoinmunes y del aparato locomotor, como artritis, lupus, gota y osteoporosis.",
        "keywords": ["reumatologo", "reumatóloga", "reumatólogo", "reumatologia", "reumatología", "artritis", "artrosis", "lupus", "gota", "osteoporosis", "reuma", "enfermedades autoinmunes", "dolor articular", "fibromialgia"],
        "is_top": False,
    },
    {
        "slug": "cirugia-general",
        "name": "Cirugía General",
        "description": "Especialidad quirúrgica que se ocupa de la evaluación, diagnóstico y tratamiento operatorio de las enfermedades del abdomen, la pared abdominal, el tiroides, la mama y otras áreas del cuerpo.",
        "keywords": ["cirujano", "cirujana", "cirugia general", "cirugía general", "cirugia", "cirugía", "abdomen", "hernia", "apendicitis", "vesicula", "vesícula", "tiroides", "mama", "operacion", "operación", "pared abdominal"],
        "is_top": False,
    },
    {
        "slug": "cirugia-pediatrica",
        "name": "Cirugía Pediátrica",
        "description": "Especialidad quirúrgica dedicada al diagnóstico y tratamiento quirúrgico de malformaciones congénitas y enfermedades quirúrgicas en niños y recién nacidos.",
        "keywords": ["cirujano pediatrico", "cirujano pediátrico", "cirugia pediatrica", "cirugía pediátrica", "cirugia infantil", "malformaciones", "congenito", "congénito", "hernia inguinal", "criptorquidia", "niños", "recien nacido", "recién nacido"],
        "is_top": False,
    },
    {
        "slug": "cirugia-plastica-reconstructiva",
        "name": "Cirugía Plástica y Reconstructiva",
        "description": "Especialidad quirúrgica que se encarga de la corrección de defectos congénitos, la reconstrucción de tejidos tras un trauma o cirugía oncológica y los procedimientos estéticos.",
        "keywords": ["cirujano plastico", "cirujano plástico", "cirugia plastica", "cirugía plástica", "reconstructiva", "estetica", "estética", "reconstruccion", "reconstrucción", "quemaduras", "cicatrices", "injertos", "colgajos"],
        "is_top": False,
    },
    {
        "slug": "cirugia-toracica-cardiovascular",
        "name": "Cirugía Torácica y Cardiovascular",
        "description": "Especialidad quirúrgica que trata mediante cirugía las enfermedades del corazón, los grandes vasos, los pulmones, el mediastino y la pared torácica.",
        "keywords": ["cirujano cardiovascular", "cirugia cardiovascular", "cirugía cardiovascular", "cirugia toracica", "cirugía torácica", "corazon", "corazón", "bypass", "valvulas", "válvulas", "pulmon", "pulmón", "mediastino", "torax", "tórax", "aneurisma", "aorta"],
        "is_top": False,
    },
    {
        "slug": "cirugia-cabeza-cuello-maxilofacial",
        "name": "Cirugía de Cabeza Cuello y Maxilofacial",
        "description": "Especialidad quirúrgica que se ocupa de las enfermedades y malformaciones de la cara, los maxilares, la cavidad oral, el cuello y las vías aerodigestivas superiores.",
        "keywords": ["cirujano maxilofacial", "maxilofacial", "cabeza y cuello", "cirugia de cabeza y cuello", "cirugía de cabeza y cuello", "mandibula", "mandíbula", "maxilar", "fractura facial", "cara", "oral", "ortognatica", "ortognática", "lengua", "cuello"],
        "is_top": False,
    },
    {
        "slug": "neurocirugia",
        "name": "Neurocirugía",
        "description": "Especialidad quirúrgica que se dedica al diagnóstico y tratamiento quirúrgico de las enfermedades del sistema nervioso central y periférico, incluyendo tumores, traumatismos y malformaciones vasculares.",
        "keywords": ["neurocirujano", "neurocirujana", "neurocirugia", "neurocirugía", "cerebro", "columna", "medula", "médula", "tumor cerebral", "aneurisma cerebral", "hidrocefalia", "hernia discal", "craneo", "cráneo", "traumatismo craneoencefalico"],
        "is_top": False,
    },
    {
        "slug": "anestesiologia",
        "name": "Anestesiología",
        "description": "Especialidad médica que se ocupa del alivio del dolor, la sedación y la anestesia durante procedimientos quirúrgicos y diagnósticos, así como del manejo perioperatorio del paciente.",
        "keywords": ["anestesiologo", "anestesióloga", "anestesiólogo", "anestesiologia", "anestesiología", "anestesia", "sedacion", "sedación", "dolor", "dolor postoperatorio", "analgesia", "perioperatorio", "anestesista"],
        "is_top": False,
    },
    {
        "slug": "medicina-emergencias-desastres",
        "name": "Medicina de Emergencias y Desastres",
        "description": "Especialidad médica que se encarga de la atención inmediata de pacientes con enfermedades agudas o traumatismos graves, así como de la respuesta sanitaria ante emergencias y desastres.",
        "keywords": ["emergenciologo", "emergenciólogo", "emergencias", "urgencias", "medicina de emergencia", "medicina de emergencias", "desastres", "trauma", "politraumatismo", "reanimacion", "reanimación", "paro cardiaco", "paro cardíaco", "shock", "triaje"],
        "is_top": False,
    },
    {
        "slug": "medicina-intensiva",
        "name": "Medicina Intensiva",
        "description": "Especialidad médica que se dedica al cuidado integral del paciente crítico o en riesgo vital, mediante monitorización, soporte de órganos y manejo avanzado de la vía aérea y la ventilación.",
        "keywords": ["intensivista", "medicina intensiva", "cuidados intensivos", "uci", "terapia intensiva", "paciente critico", "paciente crítico", "ventilacion mecanica", "ventilación mecánica", "sepsis", "soporte vital"],
        "is_top": False,
    },
    {
        "slug": "medicina-familiar-comunitaria",
        "name": "Medicina Familiar y Comunitaria",
        "description": "Especialidad médica que brinda atención integral y continua a la persona y su familia en la comunidad, actuando como puerta de entrada al sistema de salud y coordinando la atención longitudinal.",
        "keywords": ["medico familiar", "médico familiar", "medicina familiar", "medicina comunitaria", "medicina familiar y comunitaria", "medico de cabecera", "médico de cabecera", "atencion primaria", "atención primaria", "familia", "comunidad", "prevencion", "prevención", "control niño sano"],
        "is_top": False,
    },
    {
        "slug": "oncologia-quirurgica",
        "name": "Oncología Quirúrgica",
        "description": "Subespecialidad de la oncología dedicada al manejo quirúrgico del cáncer, que incluye la estadificación, la resección del tumor primario y de las metástasis resecables, y el seguimiento oncológico del paciente.",
        "keywords": ["oncologia quirurgica", "oncología quirúrgica", "cirujano oncologo", "cirujano oncólogo", "estadificacion", "estadificación", "reseccion", "resección", "tumor primario", "metastasis", "metástasis"],
        "is_top": False,
    },
    {
        "slug": "patologia-clinica",
        "name": "Patología Clínica",
        "description": "Especialidad médica que se encarga del estudio de muestras biológicas mediante análisis de laboratorio para apoyar el diagnóstico, el pronóstico y el seguimiento de las enfermedades.",
        "keywords": ["patologo clinico", "patólogo clínico", "patologia clinica", "patología clínica", "laboratorio", "analisis clinicos", "análisis clínicos", "examenes de sangre", "exámenes de sangre", "bioquimica", "bioquímica", "hematologia de laboratorio", "microbiologia", "microbiología"],
        "is_top": False,
    },
    {
        "slug": "anatomia-patologica",
        "name": "Anatomía Patológica",
        "description": "Especialidad médica que estudia las alteraciones morfológicas de las células y los tejidos mediante el examen microscópico de biopsias y piezas quirúrgicas para establecer el diagnóstico.",
        "keywords": ["anatomopatologo", "anatomopatólogo", "anatomia patologica", "anatomía patológica", "patologia", "patología", "biopsia", "citologia", "citología", "histologia", "histología", "microscopio", "necropsia", "autopsia"],
        "is_top": False,
    },
    {
        "slug": "radiologia",
        "name": "Radiología",
        "description": "Especialidad médica que utiliza radiaciones ionizantes, ultrasonido, resonancia magnética y otras técnicas de imagen para el diagnóstico y, en algunos casos, el tratamiento de enfermedades.",
        "keywords": ["radiologo", "radióloga", "radiólogo", "radiologia", "radiología", "imagenes", "imágenes", "rayos x", "tomografia", "tomografía", "resonancia magnetica", "resonancia magnética", "ecografia", "ecografía", "ultrasonido", "tac", "rmn", "intervencionismo"],
        "is_top": False,
    },
    {
        "slug": "neonatologia",
        "name": "Neonatología",
        "description": "Especialidad médica que se ocupa de la atención integral del recién nacido, especialmente del prematuro y del neonato con patología, desde el nacimiento hasta los primeros meses de vida.",
        "keywords": ["neonatologo", "neonatóloga", "neonatólogo", "neonatologia", "neonatología", "recien nacido", "recién nacido", "prematuro", "bebe", "bebé", "neonatal", "incubadora", "ictericia", "lactante"],
        "is_top": False,
    },
    {
        "slug": "cirugia-oncologica",
        "name": "Cirugía Oncológica",
        "description": "Especialidad quirúrgica enfocada en la extirpación de tumores y de los ganglios asociados, con énfasis en la resección completa, la preservación de la función y la integración con tratamientos oncológicos complementarios.",
        "keywords": ["cirujano oncologo", "cirujano oncólogo", "cirugia oncologica", "cirugía oncológica", "oncologia quirurgica", "oncología quirúrgica", "extirpacion de tumores", "extirpación de tumores", "cancer", "cáncer", "reseccion", "resección", "ganglio centinela"],
        "is_top": False,
    },
]

# Especialidades que ya existían y se renombran a la denominación del catálogo.
RENAMED_SPECIALTIES = {
    "ginecologia": {
        "name": "Ginecología y Obstetricia",
        "description": "Especialidad médica dedicada al cuidado integral de la salud de la mujer, incluyendo el embarazo, el parto, el puerperio y las enfermedades del aparato reproductor femenino.",
    },
    "traumatologia": {
        "name": "Ortopedia y Traumatología",
        "description": "Especialidad médica y quirúrgica que se dedica al estudio y tratamiento de las lesiones y enfermedades del aparato locomotor: huesos, articulaciones, músculos, tendones y ligamentos.",
    },
    "oncologia": {
        "name": "Oncología Médica",
        "description": "Especialidad médica que se dedica al diagnóstico y tratamiento no quirúrgico del cáncer, incluyendo quimioterapia, inmunoterapia y terapias dirigidas.",
    },
}


def upgrade() -> None:
    connection = op.get_bind()

    for specialty in NEW_SPECIALTIES:
        connection.execute(
            sa.text(
                """
                INSERT INTO specialties (slug, name, description, keywords, is_top, created_at)
                SELECT :slug, :name, :description, CAST(:keywords AS jsonb), :is_top, now()
                WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE slug = :slug)
                """
            ),
            {
                "slug": specialty["slug"],
                "name": specialty["name"],
                "description": specialty["description"],
                "keywords": json.dumps(specialty["keywords"], ensure_ascii=False),
                "is_top": specialty["is_top"],
            },
        )

    for slug, data in RENAMED_SPECIALTIES.items():
        connection.execute(
            sa.text(
                "UPDATE specialties SET name = :name, description = :description "
                "WHERE slug = :slug"
            ),
            {"name": data["name"], "description": data["description"], "slug": slug},
        )


def downgrade() -> None:
    connection = op.get_bind()
    slugs = [specialty["slug"] for specialty in NEW_SPECIALTIES]

    # Solo se eliminan si no están referenciadas; si un médico o una cita ya
    # las usa, se conservan para no romper integridad referencial.
    connection.execute(
        sa.text(
            """
            DELETE FROM specialties
            WHERE slug = ANY(:slugs)
              AND id NOT IN (SELECT specialty_id FROM doctor_specialties)
              AND id NOT IN (SELECT specialty_id FROM appointments WHERE specialty_id IS NOT NULL)
              AND id NOT IN (SELECT specialty_id FROM consultations WHERE specialty_id IS NOT NULL)
            """
        ),
        {"slugs": slugs},
    )

    revert = {
        "ginecologia": "Ginecología",
        "traumatologia": "Traumatología",
        "oncologia": "Oncología",
    }
    for slug, name in revert.items():
        connection.execute(
            sa.text("UPDATE specialties SET name = :name WHERE slug = :slug"),
            {"name": name, "slug": slug},
        )
