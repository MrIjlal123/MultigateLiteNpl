import Swal from 'sweetalert2'

function showFeedback(icon: 'success' | 'error', title: string, message: string) {
  const iconHtml = icon === 'success'
    ? '<svg viewBox="0 0 48 48" focusable="false"><path d="m13 25 8 8 16-18" /></svg>'
    : '<svg viewBox="0 0 48 48" focusable="false"><path d="m16 16 16 16M32 16 16 32" /></svg>'

  return Swal.fire({
    icon,
    iconHtml,
    title,
    text: message,
    confirmButtonText: 'OK',
    buttonsStyling: false,
    customClass: {
      popup: 'feedback-popup',
      title: 'feedback-title',
      htmlContainer: 'feedback-message',
      icon: `feedback-icon feedback-icon-${icon}`,
      confirmButton: 'feedback-button',
    },
    showClass: { popup: 'swal2-show feedback-popup-show' },
    hideClass: { popup: 'swal2-hide feedback-popup-hide' },
  })
}

export function showSuccess(message: string) {
  return showFeedback('success', 'Berhasil', message)
}

export function showError(message: string) {
  return showFeedback('error', 'Gagal', message)
}
