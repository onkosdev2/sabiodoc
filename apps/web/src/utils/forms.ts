/**
 * Mueve el foco al primer campo con error de un formulario.
 *
 * Los campos usan `aria-invalid` cuando tienen error (ver `components/ui/Field`),
 * así que basta con buscar el primero. Se ejecuta en el siguiente frame para que
 * los mensajes ya estén renderizados.
 */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  if (!form) return
  requestAnimationFrame(() => {
    const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]')
    invalid?.focus()
  })
}
