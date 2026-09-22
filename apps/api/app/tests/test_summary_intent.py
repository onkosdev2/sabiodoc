"""Detección de intención para el cierre automático de la pre-consulta IA."""

from app.services.specialist_assistant import (
    is_affirmative,
    is_summary_offer,
    sanitize_summary_text,
)


def test_is_affirmative_accepts_short_confirmations():
    for message in (
        "sí",
        "si",
        "Sí, por favor",
        "claro que sí",
        "ok",
        "dale",
        "sí, genéralo",
        "perfecto, gracias",
        "sí quiero el resumen",
    ):
        assert is_affirmative(message), f"debería ser afirmativo: {message!r}"


def test_is_affirmative_rejects_negatives_and_long_messages():
    for message in (
        "no",
        "no, gracias",
        "no por ahora",
        "espera",
        "",
        "sí, pero tengo dolor en el pecho desde ayer",
    ):
        assert not is_affirmative(message), f"no debería ser afirmativo: {message!r}"


def test_is_summary_offer_detects_questions_and_offers():
    for message in (
        "¿Quieres que genere el resumen de esta conversación para el médico?",
        "Puedo generar un resumen para el médico si quieres.",
        "Te preparo el resumen de la consulta",
    ):
        assert is_summary_offer(message), f"debería ser oferta de resumen: {message!r}"


def test_is_summary_offer_ignores_unrelated_messages():
    for message in (
        "Cuéntame más sobre tu dolor",
        "El resumen del sistema es importante",
        "Aquí tienes el resumen de tu consulta. ¿Hay algo más que quieras añadir?",
        "",
    ):
        assert not is_summary_offer(message), f"no debería ser oferta: {message!r}"


def test_sanitize_summary_removes_unresolved_date_placeholder():
    summary = (
        "## Resumen de pre-consulta\n"
        "Fecha: [fecha de la consulta]\n"
        "\n"
        "**Motivo de consulta**: dolor de cabeza\n"
        "- Náuseas\n"
    )

    cleaned = sanitize_summary_text(summary)

    assert "[fecha de la consulta]" not in cleaned
    assert "dolor de cabeza" in cleaned
    assert "Náuseas" in cleaned


def test_sanitize_summary_keeps_real_content():
    summary = "**Motivo de consulta**: dolor de cabeza\nLa consulta fue el 11/09/2025."
    assert sanitize_summary_text(summary) == summary


def test_sanitize_summary_handles_none():
    assert sanitize_summary_text(None) is None
