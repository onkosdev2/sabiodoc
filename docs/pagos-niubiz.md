# Integración Niubiz — preparación

**Estado:** scaffolding. No hay cuenta ni credenciales todavía. El sistema sigue usando `PAYMENT_PROVIDER=mock`.

## Variables previstas

```env
PAYMENT_PROVIDER=niubiz
NIUBIZ_MERCHANT_ID=
NIUBIZ_API_USER=
NIUBIZ_API_PASSWORD=
NIUBIZ_SECURITY_KEY=
NIUBIZ_PUBLIC_KEY=
NIUBIZ_BASE_URL=https://apisandbox.vnforappstest.com
NIUBIZ_WEBHOOK_SECRET=
```

## Contrato ya implementado

`NiubizPaymentProvider` implementa la interfaz `PaymentProvider`:

- crear cliente;
- setup/tokenización;
- alta, baja y predeterminado de tarjeta;
- cobro off-session;
- confirmación 3DS;
- reembolso;
- payout;
- verificación de webhook.

Sin credenciales lanza `NiubizNotConfiguredError` con un mensaje claro.

## Qué pedir/confirmar a Niubiz

1. Credenciales sandbox y producción.
2. Producto habilitado para **tokenización** y **cobros sin presencia del cliente**.
3. Flujo de **3DS/autenticación**.
4. API de **reembolsos**.
5. Mecanismo de **payouts** a médicos o cuenta de comercio.
6. Documentación de **webhooks** y firma.
7. Moneda y comercio configurados en **USD**.
8. Endpoints exactos de:
   - sesión de tokenización,
   - alta de tarjeta,
   - cobro,
   - confirmación,
   - reembolso,
   - payout.
9. Ambiente sandbox y tarjetas de prueba.

## Pendiente de implementar

- Cliente HTTP con autenticación Niubiz.
- Flujo de sesión/tokenización en frontend.
- Mapeo de estados Niubiz a `PaymentTransactionStatus`.
- Verificación real de webhooks.
- Pruebas sandbox de cobro, 3DS, rechazo, reembolso y payout.

No se deben inventar endpoints ni almacenar datos de tarjeta. La integración real se hará cuando Niubiz entregue credenciales y documentación.
